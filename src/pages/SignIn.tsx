import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useAuth } from '../lib/AuthContext';

/** Never reveal whether the account exists or which part was wrong. */
export function signInMessage(code: string): string {
  if (code === 'auth/too-many-requests') return 'Too many attempts. Wait a few minutes or reset your password.';
  if (code === 'auth/network-request-failed') return 'Couldn’t reach the server. Check your connection and try again.';
  return 'That email and password didn’t match. Try again or reset your password.';
}

export function SignIn() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const from = (loc.state as { from?: string } | null)?.from ?? '/recipes';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to={from} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(''); setInfo(''); setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
      nav(from, { replace: true });
    } catch (err) {
      setError(signInMessage((err as { code?: string }).code ?? ''));
    } finally { setBusy(false); }
  };
  const reset = async () => {
    setError(''); setInfo('');
    if (!email.trim()) { setError('Enter your email above first, then choose “Forgot password”.'); return; }
    try { await sendPasswordResetEmail(auth, email.trim()); } catch { /* do not reveal */ }
    setInfo('If that email belongs to a family member, a reset link is on its way.');
  };
  return (
    <main className="main reading" style={{ maxWidth: 440, paddingTop: 64 }}>
      <h1 className="recipe-title" style={{ fontSize: '2rem' }}>Recipe<span style={{ color: 'var(--color-primary)' }}>Lewis</span></h1>
      <p className="muted">RecipeLewis is a private family cookbook. Ask Scott for an invite.</p>
      <h2 style={{ fontSize: 'var(--fs-lg)' }}>Sign in</h2>
      {error && <div className="banner banner-error" role="alert">{error}</div>}
      {info && <div className="banner banner-success" role="status">{info}</div>}
      <form onSubmit={submit} noValidate>
        <div className="field"><label htmlFor="email">Email</label>
          <input id="email" className="input" type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        <div className="field"><label htmlFor="password">Password</label>
          <input id="password" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
        <div className="row">
          <button type="submit" className="btn btn-primary" disabled={busy || !email || !password}>{busy ? 'Signing in…' : 'Sign in'}</button>
          <button type="button" className="btn btn-ghost" onClick={reset}>Forgot password</button>
        </div>
      </form>
    </main>
  );
}
