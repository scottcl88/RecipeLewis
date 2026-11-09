import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signOut as fbSignOut, type User } from 'firebase/auth';
import { auth } from './firebase';
import { roleFromClaims } from './roles';
import type { Role } from './types';

interface AuthState {
  user: User | null;
  role: Role;
  loading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}
const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<Role>('none');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (u: User | null, force = false) => {
    setUser(u);
    if (!u) { setRole('none'); return; }
    try {
      const t = await u.getIdTokenResult(force);
      setRole(roleFromClaims(t.claims));
    } catch { setRole('none'); }
  }, []);

  useEffect(() => onAuthStateChanged(auth, (u) => { void load(u).finally(() => setLoading(false)); }), [load]);

  const value = useMemo<AuthState>(() => ({
    user, role, loading,
    signOut: () => fbSignOut(auth),
    refresh: () => load(auth.currentUser, true),
  }), [user, role, loading, load]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
export function useAuth(): AuthState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}
