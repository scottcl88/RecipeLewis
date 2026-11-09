import { describe, expect, it, beforeEach } from 'vitest';
import { computeTotal, formatDuration, splitMinutes, toMinutes } from './time';
import { formatIngredient, parseIngredientList } from './ingredients';
import { isBlankHtml, sanitizeHtml } from './sanitize';
import { roleFromClaims, canWrite, isAdmin } from './roles';
import { filterRecipes, filtersToParams, parseFilters, hasActiveFilters } from './search';
import { clearDraft, loadDraft, saveDraft } from './draft';
import { validateForm, type RecipeForm } from './validate';
import { fitWithin } from './images';
import { normalizeTag, slugify } from './slug';
import { resolveTheme } from './theme';
import type { Recipe } from './types';

describe('time', () => {
  it('converts hours/minutes', () => {
    expect(toMinutes('1', '30')).toBe(90);
    expect(toMinutes('', '45')).toBe(45);
    expect(toMinutes('', '')).toBeNull();
    expect(toMinutes('-1', '0')).toBeNull();
    expect(toMinutes('x', '0')).toBeNull();
  });
  it('splits, formats, totals', () => {
    expect(splitMinutes(135)).toEqual({ hours: '2', minutes: '15' });
    expect(splitMinutes(null)).toEqual({ hours: '', minutes: '' });
    expect(formatDuration(90)).toBe('1 hr 30 min');
    expect(formatDuration(120)).toBe('2 hr');
    expect(formatDuration(5)).toBe('5 min');
    expect(formatDuration(0)).toBeNull();
    expect(computeTotal(10, null)).toBe(10);
    expect(computeTotal(null, null)).toBeNull();
  });
});

describe('ingredient list parsing', () => {
  it('splits quantity, unit, name', () => {
    expect(parseIngredientList('2 cups flour\n1/2 tsp salt\n- 1 1/2 lb chicken thighs\n\nsalt to taste')).toEqual([
      { quantity: '2', unit: 'cups', name: 'flour' },
      { quantity: '1/2', unit: 'tsp', name: 'salt' },
      { quantity: '1 1/2', unit: 'lb', name: 'chicken thighs' },
      { quantity: '', unit: '', name: 'salt to taste' },
    ]);
  });
  it('does not treat a non-unit word as a unit', () => {
    expect(parseIngredientList('3 eggs')).toEqual([{ quantity: '3', unit: '', name: 'eggs' }]);
  });
  it('formats a row', () => { expect(formatIngredient({ quantity: '2', unit: 'cups', name: 'flour' })).toBe('2 cups flour'); });
});

describe('sanitize', () => {
  it('strips scripts, handlers and unknown attributes; hardens links', () => {
    const out = sanitizeHtml('<p onclick="x()">Hi<script>alert(1)</script><a href="https://a.com" onclick="x()">l</a><img src=x></p>');
    expect(out).not.toMatch(/script|onclick|<img/);
    expect(out).toMatch(/rel="noopener noreferrer"/);
  });
  it('blocks javascript: URLs', () => { expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).not.toMatch(/javascript:/); });
  it('detects blank legacy html', () => {
    expect(isBlankHtml('<p><br></p>')).toBe(true);
    expect(isBlankHtml(null)).toBe(true);
    expect(isBlankHtml('<p>x</p>')).toBe(false);
  });
});

describe('roles', () => {
  it('derives role from claims strictly', () => {
    expect(roleFromClaims({ admin: true })).toBe('admin');
    expect(roleFromClaims({ member: true })).toBe('member');
    expect(roleFromClaims({ member: 'true', admin: 1 })).toBe('none');
    expect(roleFromClaims(null)).toBe('none');
    expect(canWrite('member')).toBe(true); expect(canWrite('none')).toBe(false);
    expect(isAdmin('member')).toBe(false);
  });
});

const mk = (o: Partial<Recipe>): Recipe => ({ id: o.id ?? 'x', title: 'T', titleLower: (o.title ?? 'T').toLowerCase(), categoryId: 'a', categoryName: 'A', tags: [], images: [], attachments: [], ...o });
describe('search/filter/sort', () => {
  const rs = [
    mk({ id: '1', title: 'Banana Bread', titleLower: 'banana bread', tags: ['baking', 'quick'], categoryId: 'dessert', updatedAt: 10, totalMinutes: 70, author: 'Grandma' }),
    mk({ id: '2', title: 'Apple Pie', titleLower: 'apple pie', tags: ['baking'], categoryId: 'dessert', updatedAt: 30, totalMinutes: 120 }),
    mk({ id: '3', title: 'Chili', titleLower: 'chili', tags: ['dinner'], categoryId: 'main', updatedAt: 20, description: 'spicy beans' }),
  ];
  const f = (p: Partial<ReturnType<typeof parseFilters>>) => ({ ...parseFilters(new URLSearchParams()), ...p });
  it('newest default, title, quickest sorts', () => {
    expect(filterRecipes(rs, f({})).map((r) => r.id)).toEqual(['2', '3', '1']);
    expect(filterRecipes(rs, f({ sort: 'title' })).map((r) => r.id)).toEqual(['2', '1', '3']);
    expect(filterRecipes(rs, f({ sort: 'quickest' })).map((r) => r.id)).toEqual(['1', '2', '3']);
  });
  it('filters by text across title/author/tags/description', () => {
    expect(filterRecipes(rs, f({ q: 'grandma' })).map((r) => r.id)).toEqual(['1']);
    expect(filterRecipes(rs, f({ q: 'beans spicy' })).map((r) => r.id)).toEqual(['3']);
    expect(filterRecipes(rs, f({ q: 'zzz' }))).toEqual([]);
  });
  it('filters by category and all selected tags', () => {
    expect(filterRecipes(rs, f({ category: 'dessert' }))).toHaveLength(2);
    expect(filterRecipes(rs, f({ tags: ['baking', 'quick'] })).map((r) => r.id)).toEqual(['1']);
  });
  it('round-trips URL params', () => {
    const p = filtersToParams({ q: 'x', category: 'main', tags: ['a', 'b'], sort: 'title' });
    expect(p.toString()).toBe('q=x&category=main&tags=a%2Cb&sort=title');
    expect(parseFilters(p)).toEqual({ q: 'x', category: 'main', tags: ['a', 'b'], sort: 'title' });
    expect(parseFilters(new URLSearchParams('sort=bogus')).sort).toBe('newest');
    expect(hasActiveFilters(parseFilters(new URLSearchParams()))).toBe(false);
  });
});

describe('drafts', () => {
  beforeEach(() => localStorage.clear());
  it('saves, loads and clears', () => {
    expect(loadDraft('new')).toBeNull();
    saveDraft('new', { a: 1 }, 123);
    expect(loadDraft<{ a: number }>('new')).toEqual({ savedAt: 123, data: { a: 1 } });
    clearDraft('new');
    expect(loadDraft('new')).toBeNull();
  });
  it('tolerates corrupt storage', () => { localStorage.setItem('rl-draft:x', '{nope'); expect(loadDraft('x')).toBeNull(); });
});

const form = (o: Partial<RecipeForm> = {}): RecipeForm => ({ title: 'T', author: '', categoryId: 'a', yield: '', description: '', tags: [], prepH: '', prepM: '', cookH: '', cookM: '', ingredients: [{ quantity: '', unit: '', name: 'x' }], steps: ['s'], storage: '', nutrition: '', images: [], ...o });
describe('form validation', () => {
  it('requires title and category', () => {
    expect(validateForm(form({ title: ' ' })).errors.title).toMatch(/required/);
    expect(validateForm(form({ title: 'x'.repeat(201) })).errors.title).toMatch(/200/);
    expect(validateForm(form({ categoryId: '' })).errors.category).toBeDefined();
    expect(validateForm(form()).errors).toEqual({});
  });
  it('requires alt text on photos and valid times', () => {
    const img = { path: 'p', name: 'n', contentType: 'image/jpeg', size: 1, description: ' ' };
    expect(validateForm(form({ images: [img] })).errors.photos).toBeDefined();
    expect(validateForm(form({ images: [{ ...img, description: 'Plated' }] })).errors.photos).toBeUndefined();
    expect(validateForm(form({ prepM: '-5' })).errors.time).toBeDefined();
  });
  it('warns, not blocks, on missing ingredients/steps', () => {
    const v = validateForm(form({ ingredients: [{ quantity: '', unit: '', name: '' }], steps: [''] }));
    expect(v.errors).toEqual({}); expect(v.warnings).toEqual({ noIngredients: true, noSteps: true });
  });
});

describe('misc', () => {
  it('fitWithin never upscales', () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });
  it('slug/tag normalization', () => {
    expect(slugify(' Main  Dish! ')).toBe('main-dish');
    expect(normalizeTag('  Quick   Dinner ')).toBe('quick dinner');
  });
  it('theme resolution', () => {
    expect(resolveTheme('system', true)).toBe('dark'); expect(resolveTheme('light', true)).toBe('light');
  });
});
