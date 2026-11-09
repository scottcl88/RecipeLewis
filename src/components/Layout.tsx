import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useTheme, type ThemePref } from '../lib/theme';
import { canWrite, isAdmin } from '../lib/roles';
import { BookIcon, PlusIcon, ShieldIcon, UserIcon } from './icons';

function useOnline() {
  const [on, setOn] = useState(navigator.onLine);
  useEffect(() => {
    const a = () => setOn(true), b = () => setOn(false);
    window.addEventListener('online', a); window.addEventListener('offline', b);
    return () => { window.removeEventListener('online', a); window.removeEventListener('offline', b); };
  }, []);
  return on;
}

function AvatarMenu() {
  const { user, signOut } = useAuth();
  const { pref, set } = useTheme();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);
  const initial = (user?.displayName || user?.email || '?').charAt(0).toUpperCase();
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" className="btn btn-ghost icon-btn" aria-haspopup="true" aria-expanded={open} aria-label="Account menu" onClick={() => setOpen((o) => !o)}>
        <span className="avatar" aria-hidden="true">{initial}</span>
      </button>
      {open && (
        <div className="menu" role="group" aria-label="Account">
          <div className="muted" style={{ padding: '4px 12px', fontSize: 14 }}>{user?.displayName || user?.email}</div>
          <Link to="/profile" onClick={() => setOpen(false)}>Profile</Link>
          <hr />
          <label htmlFor="theme-select" className="muted" style={{ padding: '0 12px', fontSize: 14 }}>Theme</label>
          <div style={{ padding: '4px 12px 8px' }}>
            <select id="theme-select" className="select" value={pref} onChange={(e) => set(e.target.value as ThemePref)}>
              <option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option>
            </select>
          </div>
          <hr />
          <button type="button" onClick={async () => { await signOut(); nav('/sign-in'); }}>Sign out</button>
        </div>
      )}
    </div>
  );
}

export function Layout() {
  const { role } = useAuth();
  const online = useOnline();
  useTheme(); // apply persisted theme on every page
  return (
    <div className="shell">
      <a href="#main" className="skip-link">Skip to content</a>
      {!online && <div className="offline" role="status">You’re offline. Showing saved recipes; editing is disabled.</div>}
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/recipes" className="wordmark">Recipe<span>Lewis</span></Link>
          <nav className="nav-desktop" aria-label="Main">
            <NavLink to="/recipes" end className="nav-link">Recipes</NavLink>
            {canWrite(role) && <NavLink to="/recipes/new" className="nav-link">Add Recipe</NavLink>}
            {isAdmin(role) && <NavLink to="/admin" className="nav-link">Admin</NavLink>}
          </nav>
          <div className="topbar-actions"><AvatarMenu /></div>
        </div>
      </header>
      <main id="main" className="main" tabIndex={-1}><Outlet /></main>
      <footer className="footer"><Link to="/about">About</Link> · <Link to="/legal">Legal</Link></footer>
      <nav className="tabbar" aria-label="Main (mobile)">
        <NavLink to="/recipes" end><BookIcon />Recipes</NavLink>
        {canWrite(role) && <NavLink to="/recipes/new"><PlusIcon />Add</NavLink>}
        {isAdmin(role) && <NavLink to="/admin"><ShieldIcon />Admin</NavLink>}
        <NavLink to="/profile"><UserIcon />Profile</NavLink>
      </nav>
    </div>
  );
}
