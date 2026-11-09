import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { applyActionCode, confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { auth } from '../lib/firebase';

type State = 'working' | 'form' | 'done' | 'invalid';
/** In-app handler for Firebase email links: password reset (also used for invites) and email verification. */
export function AuthAction() {
  const [sp] = useSearchParams();
  const mode = sp.get('mode');
  const code = sp.get('oobCode') ?? '';
  const [state, setState] = useState<State>('working');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        if (!code) throw new Error('missing');
        if (mode === 'resetPassword') { const e = await verifyPasswordResetCode(auth, code); if (live) { setEmail(e); setState('form'); } }
        else if (mode === 'verifyEmail') { await applyActionCode(auth, code); if (live) setState('done'); }
        else throw new Error('unsupported');
      } catch { if (live) setState('invalid'); }
    })();
    return () => { live = false; };
  }, [mode, code]);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setErr('');
    if (pw.length < 8) { setErr('Use at least 8 characters.'); return; }
    if (pw !== pw2) { setErr('The two passwords don’t match.'); return; }
    try { await confirmPasswordReset(auth, code, pw); setState('done'); } catch { setState('invalid'); }
  };
  return (
    <main className="main reading" style={{ maxWidth: 440, paddingTop: 64 }}>
      <h1 style={{ fontSize: '1.75rem' }}>{mode === 'verifyEmail' ? 'Verify email' : 'Set your password'}</h1>
      {state === 'working' && <p role="status" className="muted">Checking your link…</p>}
      {state === 'invalid' && (<div className="banner banner-error" role="alert">This link is invalid or has expired. <Link to="/sign-in">Go to sign in</Link> and choose “Forgot password” for a new link, or ask Scott to resend your invite.</div>)}
      {state === 'done' && (<div className="banner banner-success" role="status">All set. <Link to="/sign-in">Sign in</Link></div>)}
      {state === 'form' && (
        <form onSubmit={submit} noValidate>
          <p className="muted">For {email}</p>
          {err && <div className="banner banner-error" role="alert">{err}</div>}
          <div className="field"><label htmlFor="pw">New password</label>
            <input id="pw" className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} aria-describedby="pwhelp" /><span id="pwhelp" className="help">At least 8 characters.</span></div>
          <div className="field"><label htmlFor="pw2">Confirm password</label>
            <input id="pw2" className="input" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></div>
          <button type="submit" className="btn btn-primary">Save password</button>
        </form>
      )}
    </main>
  );
}
