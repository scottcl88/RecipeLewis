import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { createRecipe, deleteRecipe, ensureTags, getRecipe, listCategories, listTags, newRecipeId, updateRecipe, uploadRecipeImage } from '../lib/data';
import { useAsync } from '../lib/useAsync';
import { useAuth } from '../lib/AuthContext';
import { clearDraft, loadDraft, saveDraft } from '../lib/draft';
import { COMMON_UNITS, parseIngredientList } from '../lib/ingredients';
import { resizeImage } from '../lib/images';
import { computeTotal, splitMinutes, toMinutes } from '../lib/time';
import { validateForm, type RecipeForm } from '../lib/validate';
import type { Recipe } from '../lib/types';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { ErrorBanner } from '../components/States';
import { StorageImage } from '../components/StorageImage';
import { TagInput } from '../components/TagInput';
import { useToast } from '../components/Toast';
import { NotFound } from './Static';

const emptyForm = (author: string): RecipeForm => ({
  title: '', author, categoryId: '', yield: '', description: '', tags: [], prepH: '', prepM: '', cookH: '', cookM: '',
  ingredients: [{ quantity: '', unit: '', name: '' }], steps: [''], storage: '', nutrition: '', images: [],
});
function fromRecipe(r: Recipe): RecipeForm {
  const p = splitMinutes(r.prepMinutes); const c = splitMinutes(r.cookMinutes);
  return {
    title: r.title, author: r.author ?? '', categoryId: r.categoryId, yield: r.yield ?? '', description: r.description ?? '', tags: r.tags,
    prepH: p.hours, prepM: p.minutes, cookH: c.hours, cookM: c.minutes,
    ingredients: r.ingredients?.length ? r.ingredients : [{ quantity: '', unit: '', name: '' }],
    steps: r.steps?.length ? r.steps : [''], storage: r.storage ?? '', nutrition: r.nutrition ?? '',
    images: r.images.map((i) => ({ path: i.path, name: i.name, contentType: i.contentType, size: i.size, description: i.description ?? '' })),
  };
}
function move<T>(a: T[], i: number, d: number): T[] {
  const j = i + d; if (j < 0 || j >= a.length) return a;
  const c = [...a]; [c[i], c[j]] = [c[j], c[i]]; return c;
}

export function RecipeEdit() {
  const { id } = useParams();
  const recipe = useAsync(() => (id ? getRecipe(id) : Promise.resolve(null)), [id]);
  if (id && recipe.loading) return <p role="status" className="muted">Loading recipe…</p>;
  if (id && recipe.error) return <ErrorBanner message="Couldn’t load this recipe." onRetry={recipe.reload} />;
  if (id && !recipe.data) return <NotFound message="That recipe doesn’t exist." />;
  return <RecipeFormView key={id ?? 'new'} id={id} recipe={recipe.data} />;
}

function RecipeFormView({ id, recipe }: { id: string | undefined; recipe: Recipe | null }) {
  const editing = !!id;
  const { user } = useAuth();
  const nav = useNavigate();
  const { notify } = useToast();
  const baseId = useId();
  const draftKey = id ?? 'new';
  const cats = useAsync(listCategories, []);
  const tags = useAsync(listTags, []);
  const [init] = useState(() => {
    const base = recipe ? fromRecipe(recipe) : emptyForm(user?.displayName ?? '');
    const d = loadDraft<RecipeForm>(id ?? 'new');
    const useDraft = !!d && JSON.stringify(d.data) !== JSON.stringify(base);
    return { base, form: useDraft ? d!.data : base, restored: useDraft };
  });
  const [form, setForm] = useState<RecipeForm>(init.form);
  const [errors, setErrors] = useState<ReturnType<typeof validateForm>['errors']>({});
  const [saveError, setSaveError] = useState('');
  const [saving, setSaving] = useState(false);
  const [paste, setPaste] = useState('');
  const [restored, setRestored] = useState(init.restored);
  const [uploading, setUploading] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [newId] = useState(newRecipeId);
  const dirty = useRef(false);
  const recipeId = id ?? newId;
  const summaryRef = useRef<HTMLDivElement>(null);

  // Autosave a local draft every ~10s while there are unsaved changes.
  useEffect(() => {
    const t = window.setInterval(() => { if (dirty.current) { saveDraft(draftKey, form); dirty.current = false; } }, 10000);
    return () => window.clearInterval(t);
  }, [form, draftKey]);
  const set = (patch: Partial<RecipeForm>) => { dirty.current = true; setForm((f) => ({ ...f, ...patch })); };

  const total = computeTotal(toMinutes(form.prepH, form.prepM), toMinutes(form.cookH, form.cookM));
  const categoryName = useMemo(() => cats.data?.find((c) => c.id === form.categoryId)?.name ?? '', [cats.data, form.categoryId]);


  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const { errors: errs, warnings } = validateForm(form);
    setErrors(errs); setSaveError('');
    if (Object.keys(errs).length) { window.setTimeout(() => summaryRef.current?.focus(), 0); return; }
    if ((warnings.noIngredients || warnings.noSteps) && !window.confirm('This recipe has no ' + [warnings.noIngredients && 'ingredients', warnings.noSteps && 'steps'].filter(Boolean).join(' or ') + '. Save anyway?')) return;
    if (!user) return;
    setSaving(true);
    try {
      const prep = toMinutes(form.prepH, form.prepM); const cook = toMinutes(form.cookH, form.cookM);
      const existing = recipe;
      const input = {
        title: form.title.trim(), titleLower: form.title.trim().toLowerCase(), author: form.author.trim() || null,
        description: form.description.trim() || null, storage: form.storage.trim() || null, yield: form.yield.trim() || null,
        nutrition: form.nutrition.trim() || null, servings: existing?.servings ?? null,
        ingredients: form.ingredients.filter((i) => i.name.trim()), steps: form.steps.map((s) => s.trim()).filter(Boolean),
        ingredientsHtml: existing?.ingredientsHtml ?? null, directionsHtml: existing?.directionsHtml ?? null,
        ingredientsDelta: existing?.ingredientsDelta ?? null, directionsDelta: existing?.directionsDelta ?? null,
        prepMinutes: prep, cookMinutes: cook, totalMinutes: computeTotal(prep, cook),
        categoryId: form.categoryId, categoryName, tags: form.tags,
        images: form.images.map((i) => ({ ...i, description: i.description.trim() })),
        attachments: existing?.attachments ?? [], legacyId: existing?.legacyId ?? null,
      };
      if (editing) await updateRecipe(recipeId, input, user.uid); else await createRecipe(recipeId, input, user.uid);
      await ensureTags(form.tags);
      clearDraft(draftKey);
      notify('Recipe saved.');
      nav('/recipes/' + recipeId);
    } catch {
      setSaveError('Couldn’t save the recipe. Your changes are kept on this device — check your connection and try again.');
      saveDraft(draftKey, form);
    } finally { setSaving(false); }
  };

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true); setSaveError('');
    try {
      const added = [];
      for (const f of Array.from(files)) {
        if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { setSaveError('Only JPEG, PNG or WebP photos are supported.'); continue; }
        const blob = await resizeImage(f);
        const up = await uploadRecipeImage(recipeId, blob, f.name);
        added.push({ ...up, description: '' });
      }
      if (added.length) set({ images: [...form.images, ...added] });
    } catch { setSaveError('A photo couldn’t be uploaded. The recipe can still be saved without it.'); }
    finally { setUploading(false); }
  };

  const errList = Object.entries(errors);
  const f = (k: string) => baseId + k;
  return (
    <form onSubmit={submit} noValidate className="reading" style={{ maxWidth: 860 }}>
      <h1>{editing ? 'Edit recipe' : 'Add recipe'}</h1>
      {restored && (
        <div className="banner banner-info" role="status"><span>Draft restored from this device.</span>
          <button type="button" className="btn" onClick={() => { clearDraft(draftKey); setForm(init.base); setRestored(false); }}>Discard draft</button></div>
      )}
      {errList.length > 0 && (
        <div className="error-summary" role="alert" tabIndex={-1} ref={summaryRef}>
          <strong>Fix {errList.length} {errList.length === 1 ? 'problem' : 'problems'} to save:</strong>
          <ul>{errList.map(([k, m]) => <li key={k}><a href={'#' + f(k === 'category' ? 'cat' : k)}>{m}</a></li>)}</ul>
        </div>
      )}
      {saveError && <ErrorBanner message={saveError} />}

      <fieldset className="form-section fieldset-reset"><legend>Basics</legend>
        <div className="field"><label htmlFor={f('title')}>Title *</label>
          <input id={f('title')} className="input" value={form.title} maxLength={200} aria-invalid={!!errors.title} aria-describedby={errors.title ? f('title') + '-e' : undefined}
            onChange={(e) => set({ title: e.target.value })} onBlur={() => setErrors(validateForm(form).errors)} />
          {errors.title && <span id={f('title') + '-e'} className="error-text">{errors.title}</span>}</div>
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div className="field" style={{ flex: '1 1 200px' }}><label htmlFor={f('author')}>Author</label>
            <input id={f('author')} className="input" value={form.author} onChange={(e) => set({ author: e.target.value })} /></div>
          <div className="field" style={{ flex: '1 1 200px' }}><label htmlFor={f('cat')}>Category *</label>
            <select id={f('cat')} className="select" value={form.categoryId} aria-invalid={!!errors.category} aria-describedby={errors.category ? f('cat') + '-e' : undefined} onChange={(e) => set({ categoryId: e.target.value })}>
              <option value="">Select…</option>{cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            {errors.category && <span id={f('cat') + '-e'} className="error-text">{errors.category}</span>}</div>
          <div className="field" style={{ flex: '1 1 160px' }}><label htmlFor={f('yield')}>Yield</label>
            <input id={f('yield')} className="input" value={form.yield} onChange={(e) => set({ yield: e.target.value })} placeholder="e.g. 8 servings" /></div>
        </div>
        <div className="field"><label htmlFor={f('desc')}>Description</label>
          <textarea id={f('desc')} className="textarea" value={form.description} onChange={(e) => set({ description: e.target.value })} /></div>
      </fieldset>

      <fieldset className="form-section fieldset-reset"><legend>Tags</legend>
        <label htmlFor={f('tags')} className="sr-only">Tags</label>
        <TagInput id={f('tags')} value={form.tags} onChange={(t) => set({ tags: t })} suggestions={tags.data ?? []} />
      </fieldset>

      <fieldset className="form-section fieldset-reset"><legend>Times</legend>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          {([['prep', 'Prep'], ['cook', 'Cook']] as const).map(([k, label]) => (
            <div key={k} className="row" style={{ gap: 8 }}>
              <div className="field" style={{ width: 90, margin: 0 }}><label htmlFor={f(k + 'H')}>{label} hours</label>
                <input id={f(k + 'H')} className="input" inputMode="numeric" value={form[k === 'prep' ? 'prepH' : 'cookH']} onChange={(e) => set(k === 'prep' ? { prepH: e.target.value } : { cookH: e.target.value })} /></div>
              <div className="field" style={{ width: 90, margin: 0 }}><label htmlFor={f(k + 'M')}>{label} min</label>
                <input id={f(k + 'M')} className="input" inputMode="numeric" value={form[k === 'prep' ? 'prepM' : 'cookM']} onChange={(e) => set(k === 'prep' ? { prepM: e.target.value } : { cookM: e.target.value })} /></div>
            </div>
          ))}
          <p style={{ margin: 0 }} aria-live="polite"><span className="muted">Total: </span><strong>{total != null ? Math.floor(total / 60) + ' hr ' + (total % 60) + ' min' : '—'}</strong></p>
        </div>
        {errors.time && <span id={f('time')} className="error-text">{errors.time}</span>}
      </fieldset>

      <fieldset className="form-section fieldset-reset"><legend>Ingredients</legend>
        {form.ingredients.map((ing, i) => (
          <div className="ing-row" key={i} role="group" aria-label={'Ingredient ' + (i + 1)}>
            <input className="input" aria-label={'Quantity, ingredient ' + (i + 1)} inputMode="decimal" placeholder="Qty" value={ing.quantity} onChange={(e) => set({ ingredients: form.ingredients.map((x, n) => n === i ? { ...x, quantity: e.target.value } : x) })} />
            <input className="input" aria-label={'Unit, ingredient ' + (i + 1)} list={f('units')} placeholder="Unit" value={ing.unit} onChange={(e) => set({ ingredients: form.ingredients.map((x, n) => n === i ? { ...x, unit: e.target.value } : x) })} />
            <input className="input" aria-label={'Name, ingredient ' + (i + 1)} placeholder="Ingredient" value={ing.name} onChange={(e) => set({ ingredients: form.ingredients.map((x, n) => n === i ? { ...x, name: e.target.value } : x) })} />
            <div className="ing-actions">
              <button type="button" className="btn btn-ghost icon-btn" aria-label={'Move ingredient ' + (i + 1) + ' up'} disabled={i === 0} onClick={() => set({ ingredients: move(form.ingredients, i, -1) })}>↑</button>
              <button type="button" className="btn btn-ghost icon-btn" aria-label={'Move ingredient ' + (i + 1) + ' down'} disabled={i === form.ingredients.length - 1} onClick={() => set({ ingredients: move(form.ingredients, i, 1) })}>↓</button>
              <button type="button" className="btn btn-ghost icon-btn" aria-label={'Delete ingredient ' + (i + 1)} onClick={() => set({ ingredients: form.ingredients.length > 1 ? form.ingredients.filter((_, n) => n !== i) : [{ quantity: '', unit: '', name: '' }] })}>×</button>
            </div>
          </div>
        ))}
        <datalist id={f('units')}>{COMMON_UNITS.filter(Boolean).map((u) => <option key={u} value={u} />)}</datalist>
        <button type="button" className="btn" onClick={() => set({ ingredients: [...form.ingredients, { quantity: '', unit: '', name: '' }] })}>Add ingredient</button>
        <details style={{ marginTop: 16 }}><summary style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center' }}>Paste a list</summary>
          <div className="field"><label htmlFor={f('paste')}>One ingredient per line</label>
            <textarea id={f('paste')} className="textarea" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'2 cups flour\n1 tsp salt'} /></div>
          <button type="button" className="btn" disabled={!paste.trim()} onClick={() => {
            const rows = parseIngredientList(paste);
            const keep = form.ingredients.filter((i) => i.name.trim());
            set({ ingredients: [...keep, ...rows] }); setPaste(''); notify('Added ' + rows.length + ' ingredients.');
          }}>Add to ingredients</button>
        </details>
      </fieldset>

      <fieldset className="form-section fieldset-reset"><legend>Steps</legend>
        {form.steps.map((s, i) => (
          <div className="step-row" key={i}>
            <span className="step-num" aria-hidden="true">{i + 1}.</span>
            <div>
              <label htmlFor={f('step' + i)} className="sr-only">Step {i + 1}</label>
              <textarea id={f('step' + i)} className="textarea" style={{ minHeight: 72 }} value={s} onChange={(e) => set({ steps: form.steps.map((x, n) => n === i ? e.target.value : x) })} />
              <div className="row" style={{ gap: 4 }}>
                <button type="button" className="btn btn-ghost" aria-label={'Move step ' + (i + 1) + ' up'} disabled={i === 0} onClick={() => set({ steps: move(form.steps, i, -1) })}>↑ Up</button>
                <button type="button" className="btn btn-ghost" aria-label={'Move step ' + (i + 1) + ' down'} disabled={i === form.steps.length - 1} onClick={() => set({ steps: move(form.steps, i, 1) })}>↓ Down</button>
                <button type="button" className="btn btn-ghost" aria-label={'Delete step ' + (i + 1)} onClick={() => set({ steps: form.steps.length > 1 ? form.steps.filter((_, n) => n !== i) : [''] })}>Delete</button>
              </div>
            </div>
          </div>
        ))}
        <button type="button" className="btn" onClick={() => set({ steps: [...form.steps, ''] })}>Add step</button>
      </fieldset>

      <fieldset className="form-section fieldset-reset" id={f('photos')}><legend>Photos</legend>
        {errors.photos && <p className="error-text" role="alert">{errors.photos}</p>}
        {form.images.map((im, i) => (
          <div className="photo-row" key={im.path}>
            <div style={{ width: 96 }}><StorageImage path={im.path} alt="" /></div>
            <div className="field" style={{ margin: 0 }}><label htmlFor={f('alt' + i)}>{i === 0 ? 'Cover photo description (required)' : 'Photo description (required)'}</label>
              <input id={f('alt' + i)} className="input" value={im.description} onChange={(e) => set({ images: form.images.map((x, n) => n === i ? { ...x, description: e.target.value } : x) })} placeholder="What does the photo show?" /></div>
            <button type="button" className="btn btn-ghost" aria-label={'Remove photo ' + (i + 1)} onClick={() => set({ images: form.images.filter((_, n) => n !== i) })}>Remove</button>
          </div>
        ))}
        <div className="field"><label htmlFor={f('file')}>Add photos</label>
          <input id={f('file')} className="input" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={uploading} onChange={(e) => { void onFiles(e.target.files); e.target.value = ''; }} />
          <span className="help" role="status">{uploading ? 'Resizing and uploading…' : 'Photos are resized before upload. The first photo is the cover.'}</span></div>
      </fieldset>

      <details className="form-section"><summary style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center', fontWeight: 600 }}>Extras: storage and nutrition</summary>
        <div className="field"><label htmlFor={f('storage')}>Storage</label><textarea id={f('storage')} className="textarea" value={form.storage} onChange={(e) => set({ storage: e.target.value })} /></div>
        <div className="field"><label htmlFor={f('nutrition')}>Nutrition</label><textarea id={f('nutrition')} className="textarea" value={form.nutrition} onChange={(e) => set({ nutrition: e.target.value })} /></div>
      </details>

      {editing && (
        <section className="form-section" aria-labelledby={f('danger')}><h2 id={f('danger')} style={{ color: 'var(--color-danger)' }}>Danger zone</h2>
          <p className="muted">Deleting removes this recipe and its photos for everyone.</p>
          <button type="button" className="btn btn-danger" onClick={() => setConfirmDel(true)}>Delete recipe</button></section>
      )}
      <div className="sticky-actions">
        <Link to={editing ? '/recipes/' + recipeId : '/recipes'} className="btn">Cancel</Link>
        <button type="submit" className="btn btn-primary" disabled={saving || uploading}>{saving ? 'Saving…' : 'Save recipe'}</button>
      </div>
      {editing && recipe && (
        <ConfirmDialog open={confirmDel} title="Delete this recipe?" confirmLabel="Delete recipe" danger requireText={recipe.title}
          onCancel={() => setConfirmDel(false)}
          onConfirm={async () => { try { await deleteRecipe(recipe); clearDraft(draftKey); notify('Recipe deleted.'); nav('/recipes', { replace: true }); } catch { setConfirmDel(false); setSaveError('Couldn’t delete the recipe.'); } }}>
          <p>This permanently removes “{recipe.title}”.</p>
        </ConfirmDialog>
      )}
    </form>
  );
}
