import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage';

let env: RulesTestEnvironment;
const ADMIN = { admin: true };
const MEMBER = { member: true };

const recipe = (uid: string, over: Record<string, unknown> = {}) => ({
  title: 'Lasagna', titleLower: 'lasagna', tags: ['pasta'], categoryId: 'dinner', categoryName: 'Dinner',
  createdBy: uid, updatedBy: uid, ...over,
});

beforeAll(async () => {
  const [fh, fp] = (process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080').split(':');
  const [sh, sp] = (process.env.FIREBASE_STORAGE_EMULATOR_HOST ?? '127.0.0.1:9199').split(':');
  env = await initializeTestEnvironment({
    projectId: 'demo-recipelewis',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: fh, port: Number(fp) },
    storage: { rules: readFileSync('storage.rules', 'utf8'), host: sh, port: Number(sp) },
  });
});
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'recipes/r1'), recipe('someone'));
    await setDoc(doc(db, 'categories/dinner'), { name: 'Dinner', sortOrder: 1 });
    await setDoc(doc(db, 'tags/pasta'), { name: 'pasta' });
    await setDoc(doc(db, 'users/m1'), { displayName: 'Mem', email: 'm@x.com', role: 'member' });
    await setDoc(doc(db, 'users/o1'), { displayName: 'Other', email: 'o@x.com', role: 'member' });
    await setDoc(doc(db, 'invites/a@x.com'), { invitedBy: 'admin1', role: 'member' });
  });
});

const anon = () => env.unauthenticatedContext().firestore();
const as = (uid: string, claims: Record<string, unknown>) => env.authenticatedContext(uid, claims).firestore();

describe('recipes', () => {
  it('anonymous cannot read or write', async () => {
    await assertFails(getDoc(doc(anon(), 'recipes/r1')));
    await assertFails(getDocs(collection(anon(), 'recipes')));
    await assertFails(setDoc(doc(anon(), 'recipes/x'), recipe('a')));
  });
  it('signed-in user without claim cannot read or write', async () => {
    const db = as('nobody', {});
    await assertFails(getDoc(doc(db, 'recipes/r1')));
    await assertFails(setDoc(doc(db, 'recipes/x'), recipe('nobody')));
  });
  it('member can read, create (as self), edit anyone\'s recipe, and delete', async () => {
    const db = as('m1', MEMBER);
    await assertSucceeds(getDoc(doc(db, 'recipes/r1')));
    await assertSucceeds(setDoc(doc(db, 'recipes/new'), recipe('m1')));
    await assertSucceeds(updateDoc(doc(db, 'recipes/r1'), { title: 'Better lasagna' }));
    await assertSucceeds(deleteDoc(doc(db, 'recipes/r1')));
  });
  it('member cannot forge createdBy or change it', async () => {
    const db = as('m1', MEMBER);
    await assertFails(setDoc(doc(db, 'recipes/f'), recipe('someone-else')));
    await assertFails(updateDoc(doc(db, 'recipes/r1'), { createdBy: 'm1' }));
  });
  it('rejects invalid titles and too many tags', async () => {
    const db = as('m1', MEMBER);
    await assertFails(setDoc(doc(db, 'recipes/a'), recipe('m1', { title: '' })));
    await assertFails(setDoc(doc(db, 'recipes/b'), recipe('m1', { title: 'x'.repeat(201) })));
    await assertFails(setDoc(doc(db, 'recipes/c'), recipe('m1', { title: 5 })));
    await assertFails(setDoc(doc(db, 'recipes/d'), recipe('m1', { tags: Array.from({ length: 31 }, (_, i) => 't' + i) })));
    await assertFails(updateDoc(doc(db, 'recipes/r1'), { title: '' }));
  });
  it('admin has member powers', async () => {
    const db = as('admin1', ADMIN);
    await assertSucceeds(getDoc(doc(db, 'recipes/r1')));
    await assertSucceeds(setDoc(doc(db, 'recipes/n2'), recipe('admin1')));
    await assertSucceeds(deleteDoc(doc(db, 'recipes/r1')));
  });
  it('claims cannot be spoofed with a false value', async () => {
    await assertFails(getDoc(doc(as('x', { member: false, admin: false }), 'recipes/r1')));
    await assertFails(getDoc(doc(as('x', { member: 'true' }), 'recipes/r1')));
  });
});

describe('categories and tags', () => {
  it('members read but cannot write categories; admin can', async () => {
    await assertSucceeds(getDoc(doc(as('m1', MEMBER), 'categories/dinner')));
    await assertFails(setDoc(doc(as('m1', MEMBER), 'categories/x'), { name: 'X', sortOrder: 2 }));
    await assertFails(getDoc(doc(anon(), 'categories/dinner')));
    await assertSucceeds(setDoc(doc(as('admin1', ADMIN), 'categories/x'), { name: 'X', sortOrder: 2 }));
  });
  it('members can create tags, only admin can delete', async () => {
    await assertSucceeds(setDoc(doc(as('m1', MEMBER), 'tags/quick'), { name: 'quick' }));
    await assertFails(setDoc(doc(as('m1', MEMBER), 'tags/bad'), { name: 'bad', extra: 1 }));
    await assertFails(deleteDoc(doc(as('m1', MEMBER), 'tags/pasta')));
    await assertSucceeds(deleteDoc(doc(as('admin1', ADMIN), 'tags/pasta')));
    await assertFails(setDoc(doc(anon(), 'tags/z'), { name: 'z' }));
  });
});

describe('users', () => {
  it('owner reads own profile; other user and anon cannot; admin can', async () => {
    await assertSucceeds(getDoc(doc(as('m1', MEMBER), 'users/m1')));
    await env.withSecurityRulesDisabled(async (c) => { await setDoc(doc(c.firestore(), 'users/nobody'), { displayName: 'N', email: 'n@x.com', role: 'none' }); });
    await assertSucceeds(getDoc(doc(as('nobody', {}), 'users/nobody')));
    await assertFails(getDoc(doc(as('o1', MEMBER), 'users/m1')));
    await assertFails(getDoc(doc(anon(), 'users/m1')));
    await assertSucceeds(getDoc(doc(as('admin1', ADMIN), 'users/m1')));
  });
  it('owner may edit only displayName/timeZone, never role', async () => {
    const db = as('m1', MEMBER);
    await assertSucceeds(updateDoc(doc(db, 'users/m1'), { displayName: 'New name', timeZone: 'America/New_York' }));
    await assertFails(updateDoc(doc(db, 'users/m1'), { role: 'admin' }));
    await assertFails(updateDoc(doc(db, 'users/m1'), { email: 'evil@x.com' }));
    await assertFails(updateDoc(doc(as('o1', MEMBER), 'users/m1'), { displayName: 'hax' }));
  });
  it('clients cannot self-create a profile; admin can manage', async () => {
    await assertFails(setDoc(doc(as('new1', {}), 'users/new1'), { displayName: 'n', email: 'n@x.com', role: 'pending' }));
    await assertSucceeds(setDoc(doc(as('admin1', ADMIN), 'users/new1'), { displayName: 'n', email: 'n@x.com', role: 'member' }));
    await assertSucceeds(deleteDoc(doc(as('admin1', ADMIN), 'users/new1')));
  });
});

describe('invites and default deny', () => {
  it('only admin touches invites', async () => {
    await assertFails(getDoc(doc(as('m1', MEMBER), 'invites/a@x.com')));
    await assertFails(setDoc(doc(as('m1', MEMBER), 'invites/b@x.com'), { invitedBy: 'm1', role: 'admin' }));
    await assertFails(getDoc(doc(anon(), 'invites/a@x.com')));
    await assertSucceeds(setDoc(doc(as('admin1', ADMIN), 'invites/b@x.com'), { invitedBy: 'admin1', role: 'member' }));
  });
  it('unknown collections are denied even for admin', async () => {
    await assertFails(setDoc(doc(as('admin1', ADMIN), 'secrets/x'), { a: 1 }));
    await assertFails(getDoc(doc(as('admin1', ADMIN), 'secrets/x')));
  });
});

describe('storage', () => {
  const st = (uid: string | null, claims: Record<string, unknown> = {}) =>
    (uid ? env.authenticatedContext(uid, claims) : env.unauthenticatedContext()).storage();
  const png = new Uint8Array([137, 80, 78, 71]);

  it('member can upload, read and delete an image; anon and no-claim cannot', async () => {
    const path = 'recipes/r1/images/a.png';
    await assertSucceeds(uploadBytes(ref(st('m1', MEMBER), path), png, { contentType: 'image/png' }));
    await assertSucceeds(getBytes(ref(st('o1', MEMBER), path)));
    await assertFails(getBytes(ref(st(null), path)));
    await assertFails(getBytes(ref(st('nobody'), path)));
    await assertFails(uploadBytes(ref(st('nobody'), 'recipes/r1/images/b.png'), png, { contentType: 'image/png' }));
    await assertFails(uploadBytes(ref(st(null), 'recipes/r1/images/c.png'), png, { contentType: 'image/png' }));
    await assertSucceeds(deleteObject(ref(st('admin1', ADMIN), path)));
  });
  it('rejects wrong content types and paths', async () => {
    await assertFails(uploadBytes(ref(st('m1', MEMBER), 'recipes/r1/images/x.svg'), png, { contentType: 'image/svg+xml' }));
    await assertFails(uploadBytes(ref(st('m1', MEMBER), 'recipes/r1/files/x.png'), png, { contentType: 'image/png' }));
    await assertFails(uploadBytes(ref(st('m1', MEMBER), 'other/x.png'), png, { contentType: 'image/png' }));
    await assertSucceeds(uploadBytes(ref(st('m1', MEMBER), 'recipes/r1/files/x.pdf'), png, { contentType: 'application/pdf' }));
  });
});
