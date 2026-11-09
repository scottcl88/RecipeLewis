import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { deleteRecipe, getRecipe } from '../lib/data';
import { useAsync } from '../lib/useAsync';
import { useAuth } from '../lib/AuthContext';
import { canWrite } from '../lib/roles';
import { computeTotal, formatDuration } from '../lib/time';
import { formatIngredient } from '../lib/ingredients';
import { isBlankHtml, sanitizeHtml } from '../lib/sanitize';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { CookingMode } from '../components/CookingMode';
import { ErrorBanner, RecipeSkeleton } from '../components/States';
import { StorageImage } from '../components/StorageImage';
import { useToast } from '../components/Toast';
import { NotFound } from './Static';

export function RecipeView() {
  const { id = '' } = useParams();
  const { role } = useAuth();
  const nav = useNavigate();
  const { notify } = useToast();
  const { data: r, loading, error, reload } = useAsync(() => getRecipe(id), [id]);
  const [cooking, setCooking] = useState(false);
  const [confirm, setConfirm] = useState(false);

  if (loading) return <RecipeSkeleton />;
  if (error) return <div className="reading"><ErrorBanner message="Couldn’t load this recipe. Check your connection." onRetry={reload} /></div>;
  if (!r) return <NotFound message="That recipe doesn’t exist or was deleted." />;

  const total = r.totalMinutes ?? computeTotal(r.prepMinutes, r.cookMinutes);
  const meta: [string, string | null][] = [
    ['Yield', r.yield || (r.servings ? r.servings + ' servings' : null)],
    ['Prep', formatDuration(r.prepMinutes)], ['Cook', formatDuration(r.cookMinutes)], ['Total', formatDuration(total)],
  ];
  const shownMeta = meta.filter(([, v]) => v);
  const hasStructuredIng = (r.ingredients ?? []).some((i) => i.name.trim());
  const steps = (r.steps ?? []).filter((s) => s.trim());
  const doDelete = async () => {
    try { await deleteRecipe(r); notify('Recipe deleted.'); nav('/recipes', { replace: true }); }
    catch { notify('Couldn’t delete the recipe. Try again.'); setConfirm(false); }
  };
  const updated = r.updatedAt ? new Date(r.updatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : null;

  return (
    <article className="reading">
      <p className="no-print"><Link to="/recipes">← All recipes</Link></p>
      <h1 className="recipe-title">{r.title}</h1>
      <p className="muted">{[r.author && 'By ' + r.author, r.categoryName, updated && 'Updated ' + updated].filter(Boolean).join(' · ')}</p>
      {r.tags.length > 0 && <div className="chips">{r.tags.map((t) => <Link key={t} className="chip" to={'/recipes?tags=' + encodeURIComponent(t)}>{t}</Link>)}</div>}
      <div className="row no-print" style={{ marginBottom: 8 }}>
        <button type="button" className="btn btn-primary" onClick={() => setCooking(true)}>Cooking mode</button>
        <button type="button" className="btn" onClick={() => window.print()}>Print</button>
        {canWrite(role) && <Link className="btn" to={'/recipes/' + r.id + '/edit'}>Edit</Link>}
        {canWrite(role) && <button type="button" className="btn btn-danger" onClick={() => setConfirm(true)}>Delete</button>}
      </div>
      {r.images[0] && <div className="hero"><StorageImage path={r.images[0].path} alt={r.images[0].description || r.title} /></div>}
      {shownMeta.length > 0 && (
        <dl className="meta-strip">{shownMeta.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      )}
      <div className="recipe-cols">
        <section className="ingredients-col" aria-labelledby="ing-h">
          <h2 id="ing-h">Ingredients</h2>
          {hasStructuredIng ? (
            <ul className="checklist">{r.ingredients!.filter((i) => i.name.trim()).map((i, n) => (
              <li key={n}><input type="checkbox" id={'ing' + n} /><label htmlFor={'ing' + n}>{formatIngredient(i)}</label></li>
            ))}</ul>
          ) : !isBlankHtml(r.ingredientsHtml) ? (
            <div className="rich" dangerouslySetInnerHTML={{ __html: sanitizeHtml(r.ingredientsHtml) }} />
          ) : <p className="muted">No ingredients listed.</p>}
        </section>
        <section aria-labelledby="steps-h">
          <h2 id="steps-h">Directions</h2>
          {steps.length > 0 ? <ol className="steps">{steps.map((s, n) => <li key={n}>{s}</li>)}</ol>
            : !isBlankHtml(r.directionsHtml) ? <div className="rich" dangerouslySetInnerHTML={{ __html: sanitizeHtml(r.directionsHtml) }} />
            : <p className="muted">No directions listed.</p>}
        </section>
      </div>
      {r.description && <details className="section" open><summary>Description</summary><p>{r.description}</p></details>}
      {r.storage && <details className="section"><summary>Storage</summary><p>{r.storage}</p></details>}
      {r.nutrition && <details className="section"><summary>Nutrition</summary><p>{r.nutrition}</p></details>}
      {r.images.length > 1 && (
        <section className="no-print" aria-labelledby="ph-h"><h2 id="ph-h">Photos</h2>
          <ul className="gallery">{r.images.slice(1).map((im) => <li key={im.path}><StorageImage path={im.path} alt={im.description || r.title + ' photo'} /></li>)}</ul></section>
      )}
      {r.attachments.length > 0 && (
        <section className="no-print"><h2>Attachments</h2><ul>{r.attachments.map((a) => <li key={a.path}><AttachmentLink path={a.path} name={a.name} /></li>)}</ul></section>
      )}
      {cooking && <CookingMode title={r.title} steps={steps.length ? steps : (r.directionsHtml ? sanitizeHtml(r.directionsHtml).replace(/<\/(p|li)>/g, '\n').replace(/<[^>]*>/g, '').split('\n').map((s) => s.trim()).filter(Boolean) : [])} ingredients={r.ingredients ?? []} onClose={() => setCooking(false)} />}
      <ConfirmDialog open={confirm} title="Delete this recipe?" confirmLabel="Delete recipe" danger requireText={r.title}
        onConfirm={doDelete} onCancel={() => setConfirm(false)}>
        <p>This permanently removes “{r.title}” and its photos for everyone.</p>
      </ConfirmDialog>
    </article>
  );
}

import { imageUrl } from '../lib/data';
function AttachmentLink({ path, name }: { path: string; name: string }) {
  return <a href="#download" onClick={async (e) => { e.preventDefault(); window.open(await imageUrl(path), '_blank', 'noopener'); }}>{name}</a>;
}
