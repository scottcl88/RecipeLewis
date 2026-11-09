#!/usr/bin/env node
// Migrate the private legacy export into Firestore / Storage / Auth.
//   node scripts/migrate.mjs --emulator [--export <dir>] [--with-users]
// Production is intentionally gated: it needs --production AND CONFIRM_PRODUCTION_MIGRATION=yes.
// The export directory holds private data and must never be committed or uploaded.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { buildPlan } from './lib/transform.mjs';

const args = process.argv.slice(2);
const flag = (n) => args.includes('--' + n);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const exportDir = opt('export', path.join(os.homedir(), 'projects-src/recipelewis-export'));
const PROJECT = 'recipe-lewis-app';

if (flag('emulator')) {
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
  process.env.FIREBASE_STORAGE_EMULATOR_HOST ??= '127.0.0.1:9199';
} else if (!(flag('production') && process.env.CONFIRM_PRODUCTION_MIGRATION === 'yes')) {
  console.error('Refusing to run against production. Use --emulator, or --production with CONFIRM_PRODUCTION_MIGRATION=yes (needs the owner\'s approval).');
  process.exit(2);
}
const projectId = flag('emulator') ? 'demo-recipelewis' : PROJECT;
const bucketName = flag('emulator') ? 'demo-recipelewis.appspot.com' : PROJECT + '.firebasestorage.app';

// Legacy file extensions can be upper-case (.JPG): resolve files by document key, case-insensitively.
const localByKey = new Map(fs.readdirSync(path.join(exportDir, 'documents')).map((f) => [f.replace(/\.[^.]+$/, '').toUpperCase(), f]));
const read = (f) => JSON.parse(fs.readFileSync(path.join(exportDir, f), 'utf8'));
const data = { categories: read('categories.json'), tags: read('tags.json'), recipes: read('recipes.json'), documents: read('documents.json'), users: read('users.json') };

initializeApp({ projectId, storageBucket: bucketName, ...(flag('emulator') ? {} : { credential: applicationDefault() }) });
const auth = getAuth(); const db = getFirestore(); const bucket = getStorage().bucket();

// 1. Users (opt-in). Auth users get no password; they set one via the reset link from scripts/admin.mjs.
const uidByLegacy = new Map();
const preview = buildPlan(data);
if (flag('with-users')) {
  for (const u of preview.users) {
    let rec;
    try { rec = await auth.getUserByEmail(u.email); } catch { rec = await auth.createUser({ email: u.email, displayName: u.displayName }); }
    await auth.setCustomUserClaims(rec.uid, u.role === 'admin' ? { admin: true } : { member: true });
    await db.doc('users/' + rec.uid).set({ displayName: u.displayName, email: u.email, role: u.role, createdAt: u.createdAt ? Timestamp.fromDate(u.createdAt) : Timestamp.now(), legacyId: u.legacyId }, { merge: true });
    uidByLegacy.set(u.legacyId, rec.uid);
  }
}
const plan = buildPlan(data, (id) => uidByLegacy.get(id) ?? null);

// 2. Categories + tags
for (const c of plan.categories) await db.doc('categories/' + c.id).set(c.data);
for (const t of plan.tags) await db.doc('tags/' + t.id).set(t.data);

// 3. Recipes + files (idempotent: doc id derived from legacy id)
let files = 0;
let batch = db.batch(); let n = 0;
for (const r of plan.recipes) {
  const id = 'legacy-' + r.legacyId;
  const d = { ...r.doc };
  for (const k of ['createdAt', 'updatedAt']) d[k] = d[k] ? Timestamp.fromDate(d[k]) : Timestamp.now();
  for (const f of r.files) {
    f.meta.path = f.meta.path.replace('{recipeId}', id);
    const localName = localByKey.get(String(f.meta.legacyKey).toUpperCase());
    const src = localName ? path.join(exportDir, 'documents', localName) : '';
    if (!src || !fs.existsSync(src)) { console.error('missing file for recipe ' + r.legacyId + ': ' + path.basename(src)); continue; }
    await bucket.upload(src, { destination: f.meta.path, metadata: { contentType: f.meta.contentType } });
    files++;
  }
  batch.set(db.doc('recipes/' + id), d); n++;
  if (n % 400 === 0) { await batch.commit(); batch = db.batch(); }
}
await batch.commit();

// 4. Verify
const counts = {
  recipes: (await db.collection('recipes').count().get()).data().count,
  categories: (await db.collection('categories').count().get()).data().count,
  tags: (await db.collection('tags').count().get()).data().count,
  filesUploaded: files,
};
console.log(JSON.stringify({ target: flag('emulator') ? 'emulator' : 'production', planned: { recipes: plan.recipes.length, categories: plan.categories.length, tags: plan.tags.length, files: plan.recipes.reduce((a, r) => a + r.files.length, 0), users: flag('with-users') ? plan.users.length : 'skipped' }, counts }, null, 2));
