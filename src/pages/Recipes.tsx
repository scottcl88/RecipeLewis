import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { listCategories, listRecipes, listTags } from '../lib/data';
import { useAsync } from '../lib/useAsync';
import { filterRecipes, filtersToParams, hasActiveFilters, parseFilters, type Filters, type SortKey } from '../lib/search';
import { useAuth } from '../lib/AuthContext';
import { canWrite } from '../lib/roles';
import { RecipeCard } from '../components/RecipeCard';
import { CardSkeletons, EmptyState, ErrorBanner } from '../components/States';

const PAGE = 24;

export function Recipes() {
  const { role } = useAuth();
  const [sp, setSp] = useSearchParams();
  const f = useMemo(() => parseFilters(sp), [sp]);
  const recipes = useAsync(listRecipes, []);
  const cats = useAsync(listCategories, []);
  const tags = useAsync(listTags, []);
  const spKey = sp.toString();
  const [pageState, setPageState] = useState({ key: spKey, n: PAGE });
  const shown = pageState.key === spKey ? pageState.n : PAGE;
  const setShown = (fn: (n: number) => number) => setPageState({ key: spKey, n: fn(shown) });
  const [q, setQ] = useState(f.q);
  const [seenQ, setSeenQ] = useState(f.q);
  if (seenQ !== f.q) { setSeenQ(f.q); setQ(f.q); } // URL changed externally (back button, clear all)

  // Debounce search input into the URL (shareable, back-button friendly).
  useEffect(() => {
    if (q === f.q) return;
    const t = window.setTimeout(() => setSp(filtersToParams({ ...f, q }), { replace: true }), 250);
    return () => window.clearTimeout(t);
  }, [q, f, setSp]);

  const update = (patch: Partial<Filters>) => setSp(filtersToParams({ ...f, ...patch }));
  const results = useMemo(() => filterRecipes(recipes.data ?? [], f), [recipes.data, f]);
  const total = recipes.data?.length ?? 0;
  const catName = (id: string) => cats.data?.find((c) => c.id === id)?.name ?? id;

  return (
    <div>
      <div className="page-head">
        <h1>Recipes</h1>
        {canWrite(role) && <Link className="btn btn-primary no-print" to="/recipes/new">Add Recipe</Link>}
      </div>
      <div className="toolbar" role="search">
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor="q" className="sr-only">Search recipes</label>
          <input id="q" className="input" type="search" placeholder="Search title, author, tags…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor="cat" className="sr-only">Category</label>
          <select id="cat" className="select" value={f.category} onChange={(e) => update({ category: e.target.value })}>
            <option value="">All categories</option>
            {cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor="tagsel" className="sr-only">Add tag filter</label>
          <select id="tagsel" className="select" value="" onChange={(e) => e.target.value && update({ tags: [...new Set([...f.tags, e.target.value])] })}>
            <option value="">Filter by tag…</option>
            {tags.data?.filter((t) => !f.tags.includes(t)).map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor="sort" className="sr-only">Sort</label>
          <select id="sort" className="select" value={f.sort} onChange={(e) => update({ sort: e.target.value as SortKey })}>
            <option value="newest">Newest</option><option value="title">Title A–Z</option><option value="quickest">Quickest</option>
          </select>
        </div>
      </div>
      {hasActiveFilters(f) && (
        <div className="chips" aria-label="Active filters">
          {f.category && <span className="chip">{catName(f.category)}<button type="button" className="chip-remove" aria-label={'Remove category filter ' + catName(f.category)} onClick={() => update({ category: '' })}>×</button></span>}
          {f.tags.map((t) => <span className="chip" key={t}>{t}<button type="button" className="chip-remove" aria-label={'Remove tag filter ' + t} onClick={() => update({ tags: f.tags.filter((x) => x !== t) })}>×</button></span>)}
          <button type="button" className="btn btn-ghost" onClick={() => { setQ(''); setSp(new URLSearchParams()); }}>Clear all</button>
        </div>
      )}
      {recipes.error && <ErrorBanner message="Couldn’t load recipes. Check your connection." onRetry={recipes.reload} />}
      {recipes.loading && <CardSkeletons />}
      {!recipes.loading && !recipes.error && total === 0 && (
        <EmptyState title={canWrite(role) ? 'Add the first family recipe' : 'Nothing here yet'}>
          {canWrite(role) ? 'Your family’s recipes will show up here.' : 'No recipes have been added.'}
        </EmptyState>
      )}
      {!recipes.loading && !recipes.error && total > 0 && results.length === 0 && (
        <EmptyState title="No recipes match">
          <button type="button" className="btn btn-primary" onClick={() => { setQ(''); setSp(new URLSearchParams()); }}>Clear filters</button>
        </EmptyState>
      )}
      {results.length > 0 && (
        <>
          <p className="muted" role="status">{results.length} {results.length === 1 ? 'recipe' : 'recipes'}</p>
          <ul className="grid">{results.slice(0, shown).map((r) => <li key={r.id}><RecipeCard recipe={r} /></li>)}</ul>
          {results.length > shown && (
            <p style={{ textAlign: 'center', marginTop: 24 }}><button type="button" className="btn" onClick={() => setShown((s) => s + PAGE)}>Load more</button></p>
          )}
        </>
      )}
    </div>
  );
}
