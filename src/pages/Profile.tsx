import { useState, type FormEvent } from 'react';
import { updateProfile as fbUpdateProfile } from 'firebase/auth';
import { useAuth } from '../lib/AuthContext';
import { updateProfile } from '../lib/data';
import { useToast } from '../components/Toast';
import { ErrorBanner } from '../components/States';
import { useNavigate } from 'react-router-dom';

export function Profile() {
  const { user, role, signOut } = useAuth();
  const { notify } = useToast();
  const nav = useNavigate();
  const [name, setName] = useState(user?.displayName ?? '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true); setErr('');
    try {
      await fbUpdateProfile(user, { displayName: name.trim() });
      await updateProfile(user.uid, name.trim()).catch(() => undefined); // profile doc may not exist yet
      notify('Profile saved.');
    } catch { setErr('Couldn’t save your profile. Check your connection and try again.'); }
    finally { setBusy(false); }
  };
  return (
    <div className="reading">
      <h1>Profile</h1>
      {err && <ErrorBanner message={err} />}
      <form onSubmit={save}>
        <div className="field"><label htmlFor="dn">Display name</label>
          <input id="dn" className="input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoComplete="name" /></div>
        <div className="field"><span className="label">Email</span><span>{user?.email}</span></div>
        <div className="field"><span className="label">Role</span><span>{role === 'admin' ? 'Admin' : 'Family'}</span></div>
        <div className="row">
          <button className="btn btn-primary" type="submit" disabled={busy || !name.trim()}>{busy ? 'Saving…' : 'Save'}</button>
          <button className="btn" type="button" onClick={async () => { await signOut(); nav('/sign-in'); }}>Sign out</button>
        </div>
      </form>
    </div>
  );
}
