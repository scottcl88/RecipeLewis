import { describe, expect, it } from 'vitest';
import { buildPlan, isDeleted, minutesFromSqlTime, parseDate, sanitize, slugify } from './transform.mjs';

const base = {
  categories: [{ CategoryId: 1, Name: 'Any' }, { CategoryId: 3, Name: 'Main Dish', DeletedDateTime: null }],
  tags: [
    { Name: 'Pasta', RecipeId: 1 }, { Name: 'pasta', RecipeId: 2 }, { Name: 'Gone', RecipeId: 9 },
    { Name: 'Old', RecipeId: 1, DeletedDateTime: '2022-01-01T00:00:00Z' },
  ],
  recipes: [
    { RecipeId: 1, Title: ' Lasagna ', CategoryId: 3, PrepTime: '1970-01-01T00:20:00.000Z', CookTime: '1970-01-01T01:10:00.000Z', TotalTime: null,
      IngredientsHTML: '<p>2 cups <script>alert(1)</script><strong>flour</strong></p>', DirectionsHTML: '<p><br></p>',
      CreatedDateTime: '2022-05-21T02:30:24.515Z', ModifiedDateTime: null, DeletedDateTime: null, CreatedByUserId: 4 },
    { RecipeId: 2, Title: 'Soup', CategoryId: 1, DeletedDateTime: '0001-01-01T05:00:00.000Z' },
    { RecipeId: 9, Title: 'Deleted', CategoryId: 1, DeletedDateTime: '2022-10-15T19:20:00.000Z' },
  ],
  documents: [
    { RecipeId: 1, DocumentKey: 'AAAA-1', FileName: 'a.jpg', ContentType: 'image/jpeg', ByteSize: '100', Description: 'Top view' },
    { RecipeId: 1, DocumentKey: 'BBBB-2', FileName: 'card.pdf', ContentType: 'application/pdf', ByteSize: '50' },
    { RecipeId: 1, DocumentKey: 'CCCC-3', FileName: 'd.jpg', ContentType: 'image/jpeg', ByteSize: '1', DeletedDateTime: '2022-05-24T16:17:13Z' },
    { RecipeId: 9, DocumentKey: 'DDDD-4', FileName: 'e.png', ContentType: 'image/png', ByteSize: '1' },
  ],
  users: [
    { UserId: 4, Name: 'Admin Person', Email: 'A@Example.com', Role: 3 },
    { UserId: 5, Name: 'Fam', Email: 'f@example.com', Role: 1 },
    { UserId: 6, Name: 'Nobody', Email: 'n@example.com', Role: 0 },
    { UserId: 7, Name: 'Removed', Email: 'r@example.com', Role: 1, DeletedDateTime: '2023-01-01T00:00:00Z' },
  ],
};

describe('helpers', () => {
  it('parses SQL time as minutes', () => {
    expect(minutesFromSqlTime('1970-01-01T12:55:00.000Z')).toBe(775);
    expect(minutesFromSqlTime(null)).toBeNull();
    expect(minutesFromSqlTime('garbage')).toBeNull();
  });
  it('treats 0001 dates as null and flags deleted rows', () => {
    expect(parseDate('0001-01-01T05:00:00.000Z')).toBeNull();
    expect(parseDate('2022-05-21T02:30:24.515Z')).toBeInstanceOf(Date);
    expect(isDeleted({ DeletedDateTime: '0001-01-01T00:00:00Z' })).toBe(false);
    expect(isDeleted({ DeletedDateTime: '2022-10-15T19:20:00Z' })).toBe(true);
  });
  it('slugifies and sanitizes', () => {
    expect(slugify('Main Dish!')).toBe('main-dish');
    expect(sanitize('<p>x</p><script>alert(1)</script><img src=x onerror=alert(1)>')).toBe('<p>x</p>');
  });
});

describe('buildPlan', () => {
  const plan = buildPlan(base, (id) => (id === 4 ? 'uid-4' : null));
  it('skips soft-deleted recipes, documents, tags', () => {
    // recipe 2 has a 0001 date (= not deleted); recipe 9 is really soft-deleted and is skipped
    expect(plan.recipes.map((r) => r.legacyId)).toEqual([1, 2]);
    expect(plan.recipes[0].files).toHaveLength(2);
    expect(plan.tags.map((t) => t.id)).toEqual(['pasta']);
  });
  it('maps recipe fields', () => {
    const d = plan.recipes[0].doc;
    expect(d.title).toBe('Lasagna');
    expect(d.categoryId).toBe('main-dish');
    expect(d.prepMinutes).toBe(20); expect(d.cookMinutes).toBe(70); expect(d.totalMinutes).toBe(90);
    expect(d.tags).toEqual(['pasta']);
    expect(d.ingredientsHtml).toBe('<p>2 cups <strong>flour</strong></p>');
    expect(d.createdBy).toBe('uid-4'); expect(d.updatedBy).toBeNull();
    expect(d.updatedAt).toEqual(d.createdAt);
    expect(d.images).toHaveLength(1); expect(d.images[0].description).toBe('Top view');
    expect(d.attachments).toHaveLength(1);
    expect(plan.recipes[0].files[0].localFile).toBe('documents/AAAA-1.jpg');
    expect(plan.recipes[0].files[1].meta.path).toBe('recipes/{recipeId}/files/bbbb-2.pdf');
  });
  it('maps users to roles without secrets and skips deleted/unknown roles', () => {
    expect(plan.users.map((u) => [u.email, u.role])).toEqual([['a@example.com', 'admin'], ['f@example.com', 'member']]);
    expect(Object.keys(plan.users[0]).sort()).toEqual(['createdAt', 'displayName', 'email', 'legacyId', 'role']);
  });
});
