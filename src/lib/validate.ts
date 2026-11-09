import type { Ingredient } from './types';

export interface RecipeForm {
  title: string; author: string; categoryId: string; yield: string; description: string;
  tags: string[]; prepH: string; prepM: string; cookH: string; cookM: string;
  ingredients: Ingredient[]; steps: string[]; storage: string; nutrition: string;
  images: { path: string; name: string; contentType: string; size: number; description: string }[];
}
export type FormErrors = Partial<Record<'title' | 'category' | 'time' | 'photos', string>>;
export interface FormWarnings { noIngredients: boolean; noSteps: boolean }

export function validateForm(f: RecipeForm): { errors: FormErrors; warnings: FormWarnings } {
  const errors: FormErrors = {};
  const t = f.title.trim();
  if (!t) errors.title = 'Title is required.';
  else if (t.length > 200) errors.title = 'Title must be 200 characters or fewer.';
  if (!f.categoryId) errors.category = 'Choose a category.';
  for (const v of [f.prepH, f.prepM, f.cookH, f.cookM]) {
    if (v !== '' && (!Number.isFinite(Number(v)) || Number(v) < 0)) { errors.time = 'Times must be zero or more.'; break; }
  }
  if (f.images.some((i) => !i.description.trim())) errors.photos = 'Every photo needs a short description (alt text).';
  return {
    errors,
    warnings: {
      noIngredients: f.ingredients.every((i) => !i.name.trim()),
      noSteps: f.steps.every((s) => !s.trim()),
    },
  };
}
