import { useState } from 'react';
import { useAuth } from '../lib/AuthContext';

export function Awaiting() {
  const { user, signOut, refresh } = useAuth();
  const [checking, setChecking] = useState(false);
  return (
    <main className="main reading" style={{ maxWidth: 520, paddingTop: 64 }}>
      <h1 style={{ fontSize: '1.75rem' }}>Awaiting approval</h1>
      <p>You’re signed in as <strong>{user?.email}</strong>, but this account hasn’t been approved for the family cookbook yet. Ask Scott to approve you, then check again.</p>
      <div className="row">
        <button type="button" className="btn btn-primary" disabled={checking} onClick={async () => { setChecking(true); await refresh(); setChecking(false); }}>{checking ? 'Checking…' : 'Check again'}</button>
        <button type="button" className="btn" onClick={() => void signOut()}>Sign out</button>
      </div>
    </main>
  );
}
