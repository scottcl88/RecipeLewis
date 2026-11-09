#!/usr/bin/env node
// Admin tool: grant/revoke family access without a Cloud Function.
//   node scripts/admin.mjs invite <email> [--admin] [--name "Name"] [--base-url https://recipelewis.com]
//   node scripts/admin.mjs remove <email>
//   node scripts/admin.mjs list
// Uses Application Default Credentials (gcloud auth application-default login) against project recipe-lewis-app.
// Add --emulator to target local emulators. Never commit credentials.
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const [cmd, email] = process.argv.slice(2);
const args = process.argv.slice(2);
const flag = (n) => args.includes('--' + n);
const opt = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };

if (flag('emulator')) {
  process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
  process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
}
initializeApp({ projectId: flag('emulator') ? 'demo-recipelewis' : 'recipe-lewis-app', ...(flag('emulator') ? {} : { credential: applicationDefault() }) });
const auth = getAuth(); const db = getFirestore();

if (cmd === 'invite' && email) {
  const role = flag('admin') ? 'admin' : 'member';
  const addr = email.trim().toLowerCase();
  let user;
  try { user = await auth.getUserByEmail(addr); } catch { user = await auth.createUser({ email: addr, displayName: opt('name', undefined) }); }
  await auth.setCustomUserClaims(user.uid, role === 'admin' ? { admin: true } : { member: true });
  await db.doc('users/' + user.uid).set({ displayName: opt('name', user.displayName ?? ''), email: addr, role, createdAt: Timestamp.now() }, { merge: true });
  await db.doc('invites/' + addr).delete().catch(() => undefined);
  const link = await auth.generatePasswordResetLink(addr);
  const code = new URL(link).searchParams.get('oobCode');
  const base = opt('base-url', 'https://recipelewis.com');
  console.log('Access granted: ' + addr + ' (' + role + ').');
  console.log('Send them this link to set a password (single use):');
  console.log(base + '/auth-action?mode=resetPassword&oobCode=' + code);
} else if (cmd === 'remove' && email) {
  const user = await auth.getUserByEmail(email.trim().toLowerCase());
  await auth.setCustomUserClaims(user.uid, {});
  await auth.revokeRefreshTokens(user.uid);
  await auth.updateUser(user.uid, { disabled: true });
  await db.doc('users/' + user.uid).delete().catch(() => undefined);
  console.log('Access removed and sign-in disabled for ' + email + '. Recipes they authored are kept.');
} else if (cmd === 'list') {
  const { users } = await auth.listUsers(1000);
  for (const u of users) console.log((u.customClaims?.admin ? 'admin ' : u.customClaims?.member ? 'member' : 'none  ') + ' ' + u.email + (u.disabled ? ' (disabled)' : ''));
} else {
  console.error('Usage: invite <email> [--admin] [--name N] | remove <email> | list   [--emulator]');
  process.exit(1);
}
