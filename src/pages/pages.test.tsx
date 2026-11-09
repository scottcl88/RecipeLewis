import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Recipe } from '../lib/types';

const recipes: Recipe[] = [
  { id: 'a', title: 'Banana Bread', titleLower: 'banana bread', categoryId: 'dessert', categoryName: 'Dessert', tags: ['baking'], images: [], attachments: [], author: 'Grandma', updatedAt: 2,
    ingredients: [{ quantity: '3', unit: '', name: 'bananas' }], steps: ['Mash.', 'Bake.'], prepMinutes: 10, cookMinutes: 60, totalMinutes: 70 },
  { id: 'b', title: 'Chili', titleLower: 'chili', categoryId: 'main', categoryName: 'Main', tags: [], images: [], attachments: [], updatedAt: 1,
    ingredientsHtml: '<p>beans<script>alert(1)</script></p>', directionsHtml: '<p>Simmer</p>' },
];
const state = { role: 'member' as 'member' | 'admin' | 'none', list: recipes, fail: false };

vi.mock('../lib/data', () => ({
  listRecipes: vi.fn(async () => { if (state.fail) throw new Error('boom'); return state.list; }),
  listCategories: vi.fn(async () => [{ id: 'dessert', name: 'Dessert', sortOrder: 1 }, { id: 'main', name: 'Main', sortOrder: 2 }]),
  listTags: vi.fn(async () => ['baking']),
  getRecipe: vi.fn(async (id: string) => state.list.find((r) => r.id === id) ?? null),
  deleteRecipe: vi.fn(async () => undefined),
  imageUrl: vi.fn(async () => 'blob:x'),
}));
vi.mock('../lib/AuthContext', () => ({ useAuth: () => ({ user: { uid: 'u', email: 'u@x.com' }, role: state.role, loading: false, signOut: vi.fn(), refresh: vi.fn() }) }));

import { Recipes } from './Recipes';
import { RecipeView } from './RecipeView';
import { ToastProvider } from '../components/Toast';
import { signInMessage } from './SignIn';

const renderAt = (url: string) => render(
  <ToastProvider><MemoryRouter initialEntries={[url]}>
    <Routes><Route path="/recipes" element={<Recipes />} /><Route path="/recipes/:id" element={<RecipeView />} /></Routes>
  </MemoryRouter></ToastProvider>);

beforeEach(() => { state.role = 'member'; state.list = recipes; state.fail = false; });

describe('Recipes page', () => {
  it('shows skeleton then cards', async () => {
    renderAt('/recipes');
    expect(screen.getByLabelText('Loading recipes')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Banana Bread/ })).toHaveAttribute('href', '/recipes/a');
    expect(screen.getByRole('link', { name: 'Add Recipe' })).toBeInTheDocument();
  });
  it('hides Add Recipe from readers without write access', async () => {
    state.role = 'none';
    renderAt('/recipes');
    await screen.findByText('Banana Bread');
    expect(screen.queryByRole('link', { name: 'Add Recipe' })).toBeNull();
  });
  it('filters from URL and shows no-match empty state with clear', async () => {
    renderAt('/recipes?q=zzzz');
    expect(await screen.findByText('No recipes match')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(await screen.findByText('Chili')).toBeInTheDocument();
  });
  it('shows empty-library state', async () => {
    state.list = [];
    renderAt('/recipes');
    expect(await screen.findByText('Add the first family recipe')).toBeInTheDocument();
  });
  it('shows an error banner with retry', async () => {
    state.fail = true;
    renderAt('/recipes');
    const alert = await screen.findByRole('alert');
    expect(within(alert).getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    state.fail = false;
    await userEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Chili')).toBeInTheDocument();
  });
});

describe('Recipe view', () => {
  it('renders structured recipe, actions for members, and cooking mode steps', async () => {
    renderAt('/recipes/a');
    expect(await screen.findByRole('heading', { level: 1, name: 'Banana Bread' })).toBeInTheDocument();
    expect(screen.getByLabelText('3 bananas')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/recipes/a/edit');
    await userEvent.click(screen.getByRole('button', { name: 'Cooking mode' }));
    const dlg = screen.getByRole('dialog', { name: /Cooking mode/ });
    expect(within(dlg).getByText('Mash.')).toBeInTheDocument();
    await userEvent.keyboard('{ArrowRight}');
    expect(within(dlg).getByText('Bake.')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Cooking mode/ })).toBeNull());
  });
  it('renders legacy sanitized html without scripts', async () => {
    renderAt('/recipes/b');
    await screen.findByRole('heading', { level: 1, name: 'Chili' });
    expect(screen.getByText('beans')).toBeInTheDocument();
    expect(document.querySelector('script')).toBeNull();
  });
  it('hides edit/delete from read-only users and shows not-found', async () => {
    state.role = 'none';
    renderAt('/recipes/a');
    await screen.findByRole('heading', { level: 1, name: 'Banana Bread' });
    expect(screen.queryByRole('link', { name: 'Edit' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
  });
  it('shows not found for missing recipe', async () => {
    renderAt('/recipes/zzz');
    expect(await screen.findByText('Page not found')).toBeInTheDocument();
  });
});

describe('sign-in messages', () => {
  it('does not reveal whether the account exists', () => {
    expect(signInMessage('auth/user-not-found')).toBe(signInMessage('auth/wrong-password'));
    expect(signInMessage('auth/invalid-credential')).toMatch(/didn’t match/);
    expect(signInMessage('auth/too-many-requests')).toMatch(/Too many/);
  });
});
