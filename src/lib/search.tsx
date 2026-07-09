import type { ReactNode } from 'react';
import type { IProduct, SearchResult } from '@/data/products';

const EXCERPT_RADIUS = 48;

function stripHtml(html: string): string {
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || '').replace(/\s+/g, ' ').trim();
}

function normalizeForSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeQuery(query: string): string[] {
  return Array.from(new Set(normalizeForSearch(query).split(' ').filter(Boolean)));
}

function findBestExcerpt(text: string, query: string, tokens: string[]): string {
  const compactText = text.replace(/\s+/g, ' ').trim();
  if (!compactText) {
    return 'No matching excerpt available.';
  }

  const lowerText = compactText.toLowerCase();
  const phrase = query.trim().toLowerCase();
  const anchorCandidates = [phrase, ...tokens].filter(Boolean);

  let anchorIndex = -1;
  let anchorLength = 0;

  for (const candidate of anchorCandidates) {
    const index = lowerText.indexOf(candidate);
    if (index !== -1) {
      anchorIndex = index;
      anchorLength = candidate.length;
      break;
    }
  }

  if (anchorIndex === -1) {
    return compactText.slice(0, EXCERPT_RADIUS * 2).trimEnd() + (compactText.length > EXCERPT_RADIUS * 2 ? '...' : '');
  }

  const start = Math.max(0, anchorIndex - EXCERPT_RADIUS);
  const end = Math.min(compactText.length, anchorIndex + anchorLength + EXCERPT_RADIUS);
  return `${start > 0 ? '...' : ''}${compactText.slice(start, end).trim()}${end < compactText.length ? '...' : ''}`;
}

function scoreResult(result: SearchResult, query: string, tokens: string[]): number {
  const productName = result.productName.toLowerCase();
  const pageName = result.pageName?.toLowerCase() ?? '';
  const snippet = result.snippet.toLowerCase();
  const phrase = query.toLowerCase().trim();

  let score = 0;

  if (phrase && productName.includes(phrase)) score += 80;
  if (phrase && pageName.includes(phrase)) score += 55;
  if (phrase && snippet.includes(phrase)) score += 30;

  for (const token of tokens) {
    if (productName.includes(token)) score += 20;
    if (pageName.includes(token)) score += 12;
    if (snippet.includes(token)) score += 6;
  }

  if (result.matchType === 'content') score += 12;
  if (result.matchType === 'name') score += 20;
  if (result.matchType === 'tag') score += 8;

  return score;
}

export function searchProducts(products: IProduct[], query: string): SearchResult[] {
  const trimmedQuery = query.trim();
  const tokens = tokenizeQuery(trimmedQuery);

  if (!trimmedQuery || tokens.length === 0) {
    return [];
  }

  const results: SearchResult[] = [];

  for (const product of products) {
    const productNameText = normalizeForSearch(product.name);
    const tagsText = normalizeForSearch(product.tags.join(' '));

    if (tokens.every((token) => productNameText.includes(token))) {
      const baseResult: SearchResult = {
        productId: product.id,
        productName: product.name,
        pageId: null,
        pageIndex: 0,
        pageName: null,
        snippet: product.name,
        matchType: 'name',
        score: 0,
      };
      results.push({
        ...baseResult,
        score: scoreResult(baseResult, trimmedQuery, tokens),
      });
    }

    if (product.tags.length > 0 && tokens.every((token) => tagsText.includes(token))) {
      const matchingTag = product.tags.find((tag) => tokens.every((token) => normalizeForSearch(tag).includes(token)));
      const baseResult: SearchResult = {
        productId: product.id,
        productName: product.name,
        pageId: null,
        pageIndex: 0,
        pageName: null,
        snippet: `Tag match: ${matchingTag ?? product.tags.join(', ')}`,
        matchType: 'tag',
        score: 0,
      };
      results.push({
        ...baseResult,
        score: scoreResult(baseResult, trimmedQuery, tokens),
      });
    }

    product.pages.forEach((page, pageIndex) => {
      const pageText = stripHtml(page.content);
      const searchableText = normalizeForSearch([product.name, product.tags.join(' '), page.name, pageText].join(' '));
      if (!tokens.every((token) => searchableText.includes(token))) {
        return;
      }

      const baseResult: SearchResult = {
        productId: product.id,
        productName: product.name,
        pageId: page.id,
        pageIndex,
        pageName: page.name,
        snippet: findBestExcerpt(pageText || page.name, trimmedQuery, tokens),
        matchType: 'content',
        score: 0,
      };
      results.push({
        ...baseResult,
        score: scoreResult(baseResult, trimmedQuery, tokens),
      });
    });
  }

  return results
    .sort((left, right) => right.score - left.score || left.productName.localeCompare(right.productName))
    .slice(0, 12);
}

export function highlightSearchText(text: string, query: string): ReactNode {
  const tokens = tokenizeQuery(query);
  if (!text || tokens.length === 0) {
    return text;
  }

  const pattern = new RegExp(`(${tokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'ig');
  const parts = text.split(pattern);

  return parts.map((part, index) =>
    tokens.some((token) => part.toLowerCase() === token.toLowerCase()) ? (
      <mark key={`${part}-${index}`} className="rounded-sm bg-primary/20 px-1 text-foreground">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}
