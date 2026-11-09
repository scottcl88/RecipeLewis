import { useState, type FormEvent } from 'react';
import { createInvite, listInvites, listMembers, revokeInvite } from '../lib/data';
import { useAsync } from '../lib/useAsync';
import { useAuth } from '../lib/AuthContext';
import { ErrorBanner } from '../components/States';
import { useToast } from '../components/Toast';
import { ConfirmDialog } from '../components/ConfirmDialog';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const inviteCommand = (email: string, role: 'member' | 'admin') => 'node scripts/admin.mjs invite ' + email + (role === 'admin' ? ' --admin' : '');
export const removeCommand = (email: string) => 'node scripts/admin.mjs remove ' + email;

export function Admin() {
  const { user } = useAuth();
  const { notify } = useToast();
  const members = useAsync(listMembers, []);
  const invites = useAsync(listInvites, []);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'member' | 'admin'>('member');
  const [err, setErr] = useState('');
  const [open, setOpen] = useState(false);
  const [revoke, setRevoke] = useState<string | null>(null);

  const copy = async (text: string) => { try { await navigator.clipboard.writeText(text); notify('Copied command.'); } catch { notify('Couldn’t copy. Select the text and copy it manually.'); } };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!EMAIL.test(email.trim())) { setErr('Enter a valid email address.'); return; }
    try { await createInvite(email, user!.uid, role); setOpen(false); setEmail(''); setErr(''); invites.reload(); notify('Invite recorded. Run the command below to send it.'); }
    catch { setErr('Couldn’t record the invite. Try again.'); }
  };
  return (
    <div className="reading">
      <div className="page-head"><h1>Members</h1><button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>Invite member</button></div>
      <p className="muted">Sign-in access is granted by the admin script (<code>scripts/admin.mjs</code>), which sets the member claim and emails a password link. See the README.</p>
      {members.error && <ErrorBanner message="Couldn’t load members." onRetry={members.reload} />}
      {members.loading && <p role="status" className="muted">Loading members…</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {members.data?.map((m) => (
          <li className="member" key={m.uid}>
            <span className="avatar" aria-hidden="true">{(m.displayName || m.email).charAt(0).toUpperCase()}</span>
            <div className="member-info"><strong>{m.displayName || m.email}</strong><div className="muted">{m.email}</div></div>
            <span className="badge">{m.role === 'admin' ? 'Admin' : 'Family'}</span>
            {m.uid === user?.uid
              ? <button className="btn btn-ghost" disabled title="You can’t remove yourself">Remove</button>
              : <button className="btn btn-ghost" onClick={() => copy(removeCommand(m.email))}>Copy remove command</button>}
          </li>
        ))}
      </ul>
      {invites.error && <ErrorBanner message="Couldn’t load invites." onRetry={invites.reload} />}
      {(invites.data?.length ?? 0) > 0 && (
        <section aria-labelledby="pend"><h2 id="pend">Pending invites</h2>
          <ul style={{ listStyle: 'none', padding: 0 }}>{invites.data!.map((i) => (
            <li className="member" key={i.email}>
              <div className="member-info"><strong>{i.email}</strong><div className="muted"><code>{inviteCommand(i.email, i.role === 'admin' ? 'admin' : 'member')}</code></div></div>
              <button className="btn" onClick={() => copy(inviteCommand(i.email, i.role === 'admin' ? 'admin' : 'member'))}>Copy command</button>
              <button className="btn btn-ghost" onClick={() => setRevoke(i.email)}>Revoke</button>
            </li>))}</ul></section>
      )}
      {open && (
        <dialog open aria-labelledby="inv-h" style={{ position: 'fixed', top: '20%' }}>
          <form onSubmit={submit} noValidate>
            <h2 id="inv-h">Invite member</h2>
            {err && <p className="error-text" role="alert">{err}</p>}
            <div className="field"><label htmlFor="inv-email">Email address</label>
              <input id="inv-email" className="input" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus /></div>
            <div className="field"><label htmlFor="inv-role">Role</label>
              <select id="inv-role" className="select" value={role} onChange={(e) => setRole(e.target.value as 'member' | 'admin')}><option value="member">Family</option><option value="admin">Admin</option></select></div>
            <div className="row row-end"><button type="button" className="btn" onClick={() => { setOpen(false); setErr(''); }}>Cancel</button><button type="submit" className="btn btn-primary">Record invite</button></div>
          </form>
        </dialog>
      )}
      <ConfirmDialog open={!!revoke} title="Revoke invite?" confirmLabel="Revoke" danger onCancel={() => setRevoke(null)}
        onConfirm={async () => { await revokeInvite(revoke!); setRevoke(null); invites.reload(); }}>
        <p>The invite record for {revoke} will be removed. If you already ran the script, the account still exists.</p>
      </ConfirmDialog>
    </div>
  );
}
