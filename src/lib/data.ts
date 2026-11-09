import {
  collection, deleteDoc, doc, getDoc, getDocs, orderBy, query, serverTimestamp, setDoc, updateDoc, Timestamp,
  type DocumentData,
} from 'firebase/firestore';
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from './firebase';
import type { Category, Invite, Member, Recipe } from './types';
import { slugify } from './slug';

const ms = (v: unknown): number | null => (v instanceof Timestamp ? v.toMillis() : typeof v === 'number' ? v : null);

export function toRecipe(id: string, d: DocumentData): Recipe {
  return {
    ...(d as Omit<Recipe, 'id'>),
    id,
    title: d.title ?? '',
    titleLower: d.titleLower ?? String(d.title ?? '').toLowerCase(),
    categoryId: d.categoryId ?? '',
    categoryName: d.categoryName ?? '',
    tags: Array.isArray(d.tags) ? d.tags : [],
    images: Array.isArray(d.images) ? d.images : [],
    attachments: Array.isArray(d.attachments) ? d.attachments : [],
    createdAt: ms(d.createdAt),
    updatedAt: ms(d.updatedAt),
  };
}

export async function listRecipes(): Promise<Recipe[]> {
  const snap = await getDocs(query(collection(db, 'recipes'), orderBy('updatedAt', 'desc')));
  return snap.docs.map((s) => toRecipe(s.id, s.data()));
}
export async function getRecipe(id: string): Promise<Recipe | null> {
  const s = await getDoc(doc(db, 'recipes', id));
  return s.exists() ? toRecipe(s.id, s.data()) : null;
}
export type RecipeInput = Omit<Recipe, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy'>;

const clean = <T extends object>(o: T): T => JSON.parse(JSON.stringify(o));

export const newRecipeId = () => doc(collection(db, 'recipes')).id;
export async function createRecipe(id: string, input: RecipeInput, uid: string): Promise<string> {
  await setDoc(doc(db, 'recipes', id), {
    ...clean(input), createdAt: serverTimestamp(), updatedAt: serverTimestamp(), createdBy: uid, updatedBy: uid,
  });
  return id;
}
export async function updateRecipe(id: string, input: RecipeInput, uid: string): Promise<void> {
  await updateDoc(doc(db, 'recipes', id), { ...clean(input), updatedAt: serverTimestamp(), updatedBy: uid });
}
export async function deleteRecipe(r: Recipe): Promise<void> {
  await deleteDoc(doc(db, 'recipes', r.id));
  // Best effort: orphaned files are harmless, so don't fail the delete on cleanup errors.
  await Promise.allSettled([...r.images, ...r.attachments].map((f) => deleteObject(ref(storage, f.path))));
}
export async function ensureTags(tags: string[]): Promise<void> {
  await Promise.allSettled(tags.map((t) => setDoc(doc(db, 'tags', slugify(t) || 'tag'), { name: t })));
}
export async function listTags(): Promise<string[]> {
  const s = await getDocs(collection(db, 'tags'));
  return s.docs.map((d) => String(d.data().name)).sort();
}
export async function listCategories(): Promise<Category[]> {
  const s = await getDocs(collection(db, 'categories'));
  return s.docs
    .map((d) => ({ id: d.id, name: String(d.data().name ?? d.id), sortOrder: Number(d.data().sortOrder ?? 0) }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}
export async function listMembers(): Promise<Member[]> {
  const s = await getDocs(collection(db, 'users'));
  return s.docs.map((d) => {
    const x = d.data();
    return { uid: d.id, displayName: x.displayName ?? '', email: x.email ?? '', role: x.role ?? 'member', createdAt: ms(x.createdAt) };
  });
}
export async function listInvites(): Promise<Invite[]> {
  const s = await getDocs(collection(db, 'invites'));
  return s.docs.map((d) => ({ email: d.id, invitedBy: d.data().invitedBy ?? '', role: d.data().role ?? 'member', createdAt: ms(d.data().createdAt) }));
}
export async function createInvite(email: string, uid: string, role: 'member' | 'admin'): Promise<void> {
  await setDoc(doc(db, 'invites', email.trim().toLowerCase()), { invitedBy: uid, role, createdAt: serverTimestamp() });
}
export async function revokeInvite(email: string): Promise<void> {
  await deleteDoc(doc(db, 'invites', email));
}
export async function updateProfile(uid: string, displayName: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { displayName });
}
export async function uploadRecipeImage(recipeId: string, file: Blob, name: string) {
  const id = crypto.randomUUID();
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = 'recipes/' + recipeId + '/images/' + id + '.' + ext;
  await uploadBytes(ref(storage, path), file, { contentType: file.type });
  return { path, name, contentType: file.type, size: file.size };
}
export const imageUrl = (path: string) => getDownloadURL(ref(storage, path));
