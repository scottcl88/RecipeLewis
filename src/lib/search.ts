import type { Recipe } from './types';

export type SortKey = 'newest' | 'title' | 'quickest';
export interface Filters { q: string; category: string; tags: string[]; sort: SortKey }

export function parseFilters(sp: URLSearchParams): Filters {
  const sort = sp.get('sort');
  return {
    q: sp.get('q') ?? '',
    category: sp.get('category') ?? '',
    tags: (sp.get('tags') ?? '').split(',').map((t) => t.trim()).filter(Boolean),
    sort: sort === 'title' || sort === 'quickest' ? sort : 'newest',
  };
}
export function filtersToParams(f: Filters): URLSearchParams {
  const sp = new URLSearchParams();
  if (f.q) sp.set('q', f.q);
  if (f.category) sp.set('category', f.category);
  if (f.tags.length) sp.set('tags', f.tags.join(','));
  if (f.sort !== 'newest') sp.set('sort', f.sort);
  return sp;
}
export const hasActiveFilters = (f: Filters) => !!(f.q || f.category || f.tags.length);

export function filterRecipes(recipes: Recipe[], f: Filters): Recipe[] {
  const q = f.q.trim().toLowerCase();
  const out = recipes.filter((r) => {
    if (f.category && r.categoryId !== f.category) return false;
    if (f.tags.length && !f.tags.every((t) => r.tags.includes(t))) return false;
    if (q) {
      const hay = [r.title, r.author, r.description, r.tags.join(' ')].filter(Boolean).join(' ').toLowerCase();
      if (!q.split(/\s+/).every((w) => hay.includes(w))) return false;
    }
    return true;
  });
  const by: Record<string, (a: Recipe, b: Recipe) => number> = {
    newest: (a, b) => (b.updatedAt ?? b.createdAt ?? 0) - (a.updatedAt ?? a.createdAt ?? 0),
    title: (a, b) => a.titleLower.localeCompare(b.titleLower),
    quickest: (a, b) => (a.totalMinutes ?? Infinity) - (b.totalMinutes ?? Infinity) || a.titleLower.localeCompare(b.titleLower),
  };
  return [...out].sort(by[f.sort]);
}
