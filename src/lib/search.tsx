import type { ReactNode } from 'react';
import type { IProduct, SearchResult } from '@/data/products';

const EXCERPT_RADIUS = 80;

/** Extended SearchResult with all matching paragraphs for expanded view */
export interface ExtendedSearchResult extends SearchResult {
  /** All matching paragraphs/excerpts in this result */
  matchingParagraphs: MatchingParagraph[];
  /** Whether this page is a mindmap */
  isMindmap?: boolean;
}

export interface MatchingParagraph {
  /** The excerpt text with context */
  excerpt: string;
  /** Start position of the match in original content */
  matchStart: number;
  /** Which tokens matched in this paragraph */
  matchedTokens: string[];
  /** Score of this paragraph match */
  score: number;
}

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

/** Tokenize query into individual words */
function tokenizeQuery(query: string): string[] {
  return Array.from(new Set(normalizeForSearch(query).split(' ').filter(Boolean)));
}

/** Check if a word matches exactly (whole word match) */
function isWholeWordMatch(text: string, word: string): boolean {
  const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(word)}([^\\p{L}\\p{N}]|$)`, 'iu');
  return pattern.test(text);
}

/** Escape special regex characters */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Find all positions where whole words match */
function findAllWordMatches(text: string, tokens: string[]): Array<{ token: string; index: number }> {
  const matches: Array<{ token: string; index: number }> = [];
  const lowerText = text.toLowerCase();
  
  for (const token of tokens) {
    const pattern = new RegExp(`(^|[^\\p{L}\\p{N}])(${escapeRegExp(token)})([^\\p{L}\\p{N}]|$)`, 'giu');
    let match;
    while ((match = pattern.exec(lowerText)) !== null) {
      matches.push({ token, index: match.index + match[1].length });
    }
  }
  
  return matches.sort((a, b) => a.index - b.index);
}

/** Calculate how well the tokens match in sequence in the text */
function calculateSequenceScore(text: string, tokens: string[]): number {
  const normalizedText = normalizeForSearch(text);
  const phrase = tokens.join(' ');
  
  // Check if the entire phrase appears as-is (best match)
  if (normalizedText.includes(phrase)) {
    return 100;
  }
  
  // Check for partial sequences
  let maxSequenceLength = 0;
  let currentSequence = 0;
  
  for (let i = 0; i < tokens.length - 1; i++) {
    const pair = `${tokens[i]} ${tokens[i + 1]}`;
    if (normalizedText.includes(pair)) {
      currentSequence++;
      maxSequenceLength = Math.max(maxSequenceLength, currentSequence);
    } else {
      currentSequence = 0;
    }
  }
  
  return maxSequenceLength * 20;
}

/** Find all matching paragraphs in content */
function findAllMatchingParagraphs(content: string, tokens: string[], query: string): MatchingParagraph[] {
  const text = stripHtml(content);
  if (!text || tokens.length === 0) return [];
  
  const paragraphs: MatchingParagraph[] = [];
  const normalizedText = normalizeForSearch(text);
  
  // Check if any tokens actually match (whole word)
  const hasMatch = tokens.some(token => isWholeWordMatch(normalizedText, token));
  if (!hasMatch) return [];
  
  // Find all word match positions
  const matches = findAllWordMatches(text, tokens);
  if (matches.length === 0) return [];
  
  // Group nearby matches into excerpts
  const processedRanges = new Set<number>();
  
  for (const match of matches) {
    if (processedRanges.has(match.index)) continue;
    
    // Find all matches within EXCERPT_RADIUS of this match
    const nearbyMatches = matches.filter(m => 
      Math.abs(m.index - match.index) <= EXCERPT_RADIUS * 2
    );
    
    // Calculate excerpt bounds
    const minIndex = Math.max(0, Math.min(...nearbyMatches.map(m => m.index)) - EXCERPT_RADIUS);
    const maxIndex = Math.min(text.length, Math.max(...nearbyMatches.map(m => m.index + m.token.length)) + EXCERPT_RADIUS);
    
    // Mark as processed
    nearbyMatches.forEach(m => processedRanges.add(m.index));
    
    // Extract excerpt
    const excerpt = `${minIndex > 0 ? '...' : ''}${text.slice(minIndex, maxIndex).trim()}${maxIndex < text.length ? '...' : ''}`;
    
    // Calculate score for this paragraph
    const matchedTokensInExcerpt = [...new Set(nearbyMatches.map(m => m.token))];
    let paragraphScore = matchedTokensInExcerpt.length * 10;
    
    // Bonus for sequence matches
    const sequenceBonus = calculateSequenceScore(excerpt, tokens);
    paragraphScore += sequenceBonus;
    
    // Bonus for more matches close together
    paragraphScore += nearbyMatches.length * 5;
    
    paragraphs.push({
      excerpt,
      matchStart: match.index,
      matchedTokens: matchedTokensInExcerpt,
      score: paragraphScore,
    });
  }
  
  return paragraphs.sort((a, b) => b.score - a.score);
}

function scoreResult(result: ExtendedSearchResult, query: string, tokens: string[]): number {
  const productName = result.productName.toLowerCase();
  const pageName = result.pageName?.toLowerCase() ?? '';
  const snippet = result.snippet.toLowerCase();
  const phrase = query.toLowerCase().trim();

  let score = 0;

  // EXACT PHRASE MATCH - Highest priority (massive boost)
  // This ensures "cleaning tray error" as a phrase ranks above "cleaning" and "error" separately
  if (phrase) {
    // Check if the exact phrase appears anywhere in the searchable content
    const normalizedSnippet = normalizeForSearch(snippet);
    const normalizedProductName = normalizeForSearch(productName);
    const normalizedPageName = normalizeForSearch(pageName);
    
    // Exact phrase in product name - highest score
    if (normalizedProductName.includes(phrase)) {
      score += 500;
    }
    // Exact phrase in page name - very high score
    if (pageName && normalizedPageName.includes(phrase)) {
      score += 400;
    }
    // Exact phrase in snippet - high score
    if (normalizedSnippet.includes(phrase)) {
      score += 300;
    }
  }

  // Individual token matches (whole word)
  for (const token of tokens) {
    if (isWholeWordMatch(productName, token)) score += 30;
    else if (productName.includes(token)) score += 15;
    
    if (isWholeWordMatch(pageName, token)) score += 20;
    else if (pageName.includes(token)) score += 10;
    
    if (isWholeWordMatch(snippet, token)) score += 12;
    else if (snippet.includes(token)) score += 6;
  }

  // Sequence bonus (for partial matches)
  score += calculateSequenceScore(productName, tokens);
  score += calculateSequenceScore(pageName, tokens) * 0.7;
  score += calculateSequenceScore(snippet, tokens) * 0.5;

  // Match type bonuses
  if (result.matchType === 'content') score += 8;
  if (result.matchType === 'name') score += 25;
  if (result.matchType === 'tag') score += 15;

  // Number of matching paragraphs bonus
  score += Math.min(result.matchingParagraphs.length * 5, 30);

  return score;
}

export function searchProducts(products: IProduct[], query: string): ExtendedSearchResult[] {
  const trimmedQuery = query.trim();
  const tokens = tokenizeQuery(trimmedQuery);

  if (!trimmedQuery || tokens.length === 0) {
    return [];
  }

  const results: ExtendedSearchResult[] = [];

  for (const product of products) {
    const productNameText = normalizeForSearch(product.name);
    const tagsText = normalizeForSearch(product.tags.join(' '));

    // Check product name match (all tokens must match as whole words)
    const productNameMatches = tokens.every(token => isWholeWordMatch(productNameText, token));
    
    if (productNameMatches) {
      const baseResult: ExtendedSearchResult = {
        productId: product.id,
        productName: product.name,
        productTags: product.tags,
        pageId: null,
        pageIndex: 0,
        pageName: null,
        snippet: product.name,
        matchType: 'name',
        score: 0,
        matchingParagraphs: [{
          excerpt: product.name,
          matchStart: 0,
          matchedTokens: tokens,
          score: 100,
        }],
      };
      results.push({
        ...baseResult,
        score: scoreResult(baseResult, trimmedQuery, tokens),
      });
    }

    // Check tag matches (all tokens must match at least one tag)
    if (product.tags.length > 0) {
      const matchingTags = product.tags.filter(tag => 
        tokens.every(token => isWholeWordMatch(normalizeForSearch(tag), token))
      );
      
      if (matchingTags.length > 0) {
        const baseResult: ExtendedSearchResult = {
          productId: product.id,
          productName: product.name,
          productTags: product.tags,
          pageId: null,
          pageIndex: 0,
          pageName: null,
          snippet: `Tag match: ${matchingTags.join(', ')}`,
          matchType: 'tag',
          score: 0,
          matchingParagraphs: matchingTags.map(tag => ({
            excerpt: `Tag: ${tag}`,
            matchStart: 0,
            matchedTokens: tokens,
            score: 50,
          })),
        };
        results.push({
          ...baseResult,
          score: scoreResult(baseResult, trimmedQuery, tokens),
        });
      }
    }

    // Search page content
    product.pages.forEach((page, pageIndex) => {
      const pageNameText = normalizeForSearch(page.name);
      const pageContent = stripHtml(page.content);
      const searchableText = normalizeForSearch([page.name, pageContent].join(' '));
      
      // All tokens must match somewhere in the page (whole word)
      const allTokensMatch = tokens.every(token => 
        isWholeWordMatch(pageNameText, token) || isWholeWordMatch(searchableText, token)
      );
      
      if (!allTokensMatch) return;

      // Find all matching paragraphs
      const matchingParagraphs = findAllMatchingParagraphs(page.content, tokens, trimmedQuery);
      
      // Also check page name matches
      const pageNameMatches = tokens.filter(token => isWholeWordMatch(pageNameText, token));
      if (pageNameMatches.length > 0) {
        matchingParagraphs.unshift({
          excerpt: `Page: ${page.name}`,
          matchStart: 0,
          matchedTokens: pageNameMatches,
          score: 80,
        });
      }

      if (matchingParagraphs.length === 0) return;

      const bestParagraph = matchingParagraphs[0];
      const baseResult: ExtendedSearchResult = {
        productId: product.id,
        productName: product.name,
        productTags: product.tags,
        pageId: page.id,
        pageIndex,
        pageName: page.name,
        snippet: bestParagraph.excerpt,
        matchType: 'content',
        score: 0,
        matchingParagraphs,
        // Detect if this page has mindmap content
        isMindmap: page.content.includes('<div') && (
          page.content.includes('mindmap') || 
          page.content.includes('data-mindmap') ||
          page.content.includes('Mermaid')
        ),
      };
      results.push({
        ...baseResult,
        score: scoreResult(baseResult, trimmedQuery, tokens),
      });
    });
  }

  // Sort by score (descending) - higher score = better match = displayed first (top in radial)
  return results
    .sort((left, right) => right.score - left.score || left.productName.localeCompare(right.productName))
    .slice(0, 16);
}

export function highlightSearchText(text: string, query: string): ReactNode {
  const tokens = tokenizeQuery(query);
  if (!text || tokens.length === 0) {
    return text;
  }

  // Create pattern for whole word matching
  const pattern = new RegExp(
    `(^|[^\\p{L}\\p{N}])(${tokens.map(t => escapeRegExp(t)).join('|')})([^\\p{L}\\p{N}]|$)`,
    'giu'
  );

  const parts: Array<string | ReactNode> = [];
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    
    // Add prefix (non-word char before match)
    if (match[1]) {
      parts.push(match[1]);
    }
    
    // Add highlighted match
    parts.push(
      <mark
        key={`${match.index}-${match[2]}`}
        className="search-highlight rounded-sm bg-primary/20 px-0.5 text-foreground"
      >
        {match[2]}
      </mark>
    );
    
    // Add suffix (non-word char after match)
    if (match[3]) {
      parts.push(match[3]);
    }
    
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}