export type Role = 'admin' | 'member' | 'none';

export interface Ingredient { quantity: string; unit: string; name: string }
export interface StoredFile {
  path: string; name: string; contentType: string; size: number; description?: string; legacyKey?: string;
}
export interface Recipe {
  id: string;
  title: string;
  titleLower: string;
  author?: string | null;
  description?: string | null;
  storage?: string | null;
  yield?: string | null;
  nutrition?: string | null;
  servings?: number | null;
  /** Structured v2 content. */
  ingredients?: Ingredient[];
  steps?: string[];
  /** Legacy (migrated) rich text, sanitized HTML. Shown when structured fields are absent. */
  ingredientsHtml?: string | null;
  directionsHtml?: string | null;
  ingredientsDelta?: string | null;
  directionsDelta?: string | null;
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  totalMinutes?: number | null;
  categoryId: string;
  categoryName: string;
  tags: string[];
  images: StoredFile[];
  attachments: StoredFile[];
  createdAt?: number | null; // epoch ms (converted from Timestamp)
  updatedAt?: number | null;
  createdBy?: string | null;
  updatedBy?: string | null;
  legacyId?: number | null;
}
export interface Category { id: string; name: string; sortOrder: number }
export interface Member { uid: string; displayName: string; email: string; role: string; createdAt?: number | null }
export interface Invite { email: string; invitedBy: string; role: string; createdAt?: number | null }
