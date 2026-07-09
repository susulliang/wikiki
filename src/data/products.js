// EXPORTS: IProduct, IPage, SearchResult, getTagColor
const TAG_COLORS = [
    { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-500' },
    { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', dot: 'bg-green-500' },
    { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300', dot: 'bg-purple-500' },
    { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', dot: 'bg-orange-500' },
    { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-700 dark:text-pink-300', dot: 'bg-pink-500' },
    { bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-700 dark:text-teal-300', dot: 'bg-teal-500' },
    { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', dot: 'bg-red-500' },
    { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-300', dot: 'bg-indigo-500' },
];
export function getTagColor(tag) {
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
        hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }
    return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}
/** Normalize imported product data to internal format */
export function normalizeProduct(raw) {
    const now = new Date().toISOString();
    const createdAt = typeof raw.createdAt === 'number'
        ? new Date(raw.createdAt).toISOString()
        : typeof raw.createdAt === 'string'
            ? raw.createdAt
            : now;
    const updatedAt = typeof raw.updatedAt === 'number'
        ? new Date(raw.updatedAt).toISOString()
        : typeof raw.updatedAt === 'string'
            ? raw.updatedAt
            : now;
    const rawPages = Array.isArray(raw.pages) ? raw.pages : [];
    const pages = rawPages.map((pg, idx) => {
        const title = String(pg.title ?? pg.name ?? `Page ${idx + 1}`);
        return {
            id: String(pg.id ?? `page-${Date.now()}-${idx}`),
            title,
            name: title,
            content: String(pg.content ?? ''),
            order: typeof pg.order === 'number' ? pg.order : idx,
            createdAt: typeof pg.createdAt === 'number'
                ? new Date(pg.createdAt).toISOString()
                : String(pg.createdAt ?? now),
            updatedAt: typeof pg.updatedAt === 'number'
                ? new Date(pg.updatedAt).toISOString()
                : String(pg.updatedAt ?? now),
        };
    });
    return {
        id: String(raw.id ?? `product-${Date.now()}`),
        name: String(raw.name ?? 'Untitled'),
        tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
        pages,
        createdAt,
        updatedAt,
        source: typeof raw.source === 'string' ? raw.source : undefined,
    };
}
/** Convert internal product back to export format */
export function denormalizeProduct(product) {
    return {
        id: product.id,
        name: product.name,
        pages: product.pages.map((pg) => ({
            id: pg.id,
            title: pg.title,
            name: pg.name,
            content: pg.content,
        })),
        tags: product.tags,
        createdAt: new Date(product.createdAt).getTime(),
        updatedAt: new Date(product.updatedAt).getTime(),
        source: product.source || 'user',
    };
}
