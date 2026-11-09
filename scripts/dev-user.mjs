// Dev only: create a sign-in user with a known password in the Auth EMULATOR (refuses anything else).
//   node scripts/dev-user.mjs <email> <password> [admin|member]
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

process.env.FIREBASE_AUTH_EMULATOR_HOST ??= '127.0.0.1:9099';
process.env.FIRESTORE_EMULATOR_HOST ??= '127.0.0.1:8080';
if (!/^(127\.0\.0\.1|localhost)/.test(process.env.FIREBASE_AUTH_EMULATOR_HOST)) { console.error('Emulator only.'); process.exit(2); }
const [email, password, role = 'member'] = process.argv.slice(2);
initializeApp({ projectId: 'demo-recipelewis' });
const auth = getAuth();
let u;
try { u = await auth.getUserByEmail(email); await auth.updateUser(u.uid, { password }); } catch { u = await auth.createUser({ email, password, displayName: 'Test ' + role }); }
await auth.setCustomUserClaims(u.uid, role === 'admin' ? { admin: true } : role === 'none' ? {} : { member: true });
await getFirestore().doc('users/' + u.uid).set({ displayName: 'Test ' + role, email, role }, { merge: true });
console.log('ready', email, role);
