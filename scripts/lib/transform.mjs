// Pure transforms from the legacy SQL export to the v2 Firestore model. No I/O, no PII logging.
import { JSDOM } from 'jsdom';
import createDOMPurify from 'dompurify';

const purify = createDOMPurify(new JSDOM('').window);
const ALLOWED_TAGS = ['p','br','strong','b','em','i','u','s','ul','ol','li','h1','h2','h3','h4','a','blockquote','span'];
export const sanitize = (html) => (html ? purify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR: ['href'], ALLOW_DATA_ATTR: false }) : null);

export const slugify = (s) => String(s).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

/** Legacy "0001-01-01..." and null mean "no date". */
export function parseDate(v) {
  if (!v || String(v).startsWith('0001-')) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
export const isDeleted = (row) => parseDate(row.DeletedDateTime) !== null;

/** SQL time exported as 1970-01-01Thh:mm:ssZ -> minutes. */
export function minutesFromSqlTime(v) {
  if (!v) return null;
  const m = /T(\d{2}):(\d{2})/.exec(String(v));
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
const extFor = (ct, fileName) => ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' }[ct] ?? (String(fileName).split('.').pop() || 'bin').toLowerCase());
export const isImage = (ct) => /^image\/(jpeg|png|webp)$/.test(ct);

/**
 * @param {{categories:any[],tags:any[],recipes:any[],documents:any[],users:any[]}} data
 * @param {(legacyUserId:number)=>string|null} [uidFor]
 */
export function buildPlan(data, uidFor = () => null) {
  const categories = data.categories.filter((c) => !isDeleted(c)).map((c) => ({
    id: slugify(c.Name), data: { name: c.Name, sortOrder: c.CategoryId, legacyId: c.CategoryId },
  }));
  const catById = new Map(data.categories.map((c) => [c.CategoryId, { id: slugify(c.Name), name: c.Name }]));

  const liveRecipes = data.recipes.filter((r) => !isDeleted(r));
  const liveIds = new Set(liveRecipes.map((r) => r.RecipeId));

  const tagsByRecipe = new Map();
  const tagDocs = new Map();
  for (const t of data.tags) {
    if (isDeleted(t) || !liveIds.has(t.RecipeId)) continue;
    const name = String(t.Name).toLowerCase().trim();
    if (!name) continue;
    tagDocs.set(slugify(name) || 'tag', { name });
    const l = tagsByRecipe.get(t.RecipeId) ?? [];
    if (!l.includes(name)) l.push(name);
    tagsByRecipe.set(t.RecipeId, l);
  }

  const docsByRecipe = new Map();
  for (const d of data.documents) {
    if (isDeleted(d) || !liveIds.has(d.RecipeId)) continue;
    const l = docsByRecipe.get(d.RecipeId) ?? [];
    l.push(d); docsByRecipe.set(d.RecipeId, l);
  }

  const recipes = liveRecipes.map((r) => {
    const cat = catById.get(r.CategoryId) ?? { id: 'any', name: 'Any' };
    const files = [];
    const images = []; const attachments = [];
    (docsByRecipe.get(r.RecipeId) ?? []).forEach((d) => {
      const ext = extFor(d.ContentType, d.FileName);
      const kind = isImage(d.ContentType) ? 'images' : d.ContentType === 'application/pdf' ? 'files' : null;
      if (!kind) return;
      const key = String(d.DocumentKey);
      const meta = {
        path: 'recipes/{recipeId}/' + kind + '/' + key.toLowerCase() + '.' + ext,
        name: d.FileName ?? key, contentType: d.ContentType, size: Number(d.ByteSize) || 0, legacyKey: key,
        ...(d.Description ? { description: d.Description } : {}),
      };
      files.push({ localFile: 'documents/' + key + '.' + ext, meta, kind });
      (kind === 'images' ? images : attachments).push(meta);
    });
    const prep = minutesFromSqlTime(r.PrepTime); const cook = minutesFromSqlTime(r.CookTime);
    const total = minutesFromSqlTime(r.TotalTime) ?? (prep == null && cook == null ? null : (prep ?? 0) + (cook ?? 0));
    const doc = {
      title: String(r.Title ?? '').trim(), titleLower: String(r.Title ?? '').trim().toLowerCase(),
      author: r.Author ?? null, description: r.Description ?? null, storage: r.Storage ?? null, yield: r.Yield ?? null,
      nutrition: r.Nutrition ?? null, servings: r.Servings ?? null,
      ingredientsDelta: r.Ingredients ?? null, directionsDelta: r.Directions ?? null,
      ingredientsHtml: sanitize(r.IngredientsHTML), directionsHtml: sanitize(r.DirectionsHTML),
      prepMinutes: prep, cookMinutes: cook, totalMinutes: total,
      categoryId: cat.id, categoryName: cat.name, tags: tagsByRecipe.get(r.RecipeId) ?? [],
      images, attachments,
      createdAt: parseDate(r.CreatedDateTime), updatedAt: parseDate(r.ModifiedDateTime) ?? parseDate(r.CreatedDateTime),
      createdBy: uidFor(r.CreatedByUserId) ?? null, updatedBy: uidFor(r.ModifiedByUserId) ?? null,
      legacyId: r.RecipeId,
    };
    return { legacyId: r.RecipeId, doc, files };
  });

  // Users: name + email only. Roles 3 -> admin, 1/2 -> member, else skipped.
  const users = data.users.filter((u) => !isDeleted(u) && u.Email).map((u) => ({
    legacyId: u.UserId, email: String(u.Email).trim().toLowerCase(), displayName: u.Name ?? '',
    role: u.Role === 3 ? 'admin' : u.Role === 1 || u.Role === 2 ? 'member' : null,
    createdAt: parseDate(u.CreatedDateTime),
  })).filter((u) => u.role);

  return { categories, tags: [...tagDocs].map(([id, data]) => ({ id, data })), recipes, users };
}
