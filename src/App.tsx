import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './lib/AuthContext';
import { canWrite, isAdmin } from './lib/roles';
import { Layout } from './components/Layout';
import { SignIn } from './pages/SignIn';
import { AuthAction } from './pages/AuthAction';
import { Awaiting } from './pages/Awaiting';
import { Recipes } from './pages/Recipes';
import { RecipeView } from './pages/RecipeView';
import { Profile } from './pages/Profile';
import { About, Legal, NotFound } from './pages/Static';

const RecipeEdit = lazy(() => import('./pages/RecipeEdit').then((m) => ({ default: m.RecipeEdit })));
const Admin = lazy(() => import('./pages/Admin').then((m) => ({ default: m.Admin })));

function Splash() { return <p role="status" style={{ padding: 32 }} className="muted">Loading…</p>; }

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, role, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/sign-in" replace state={{ from: loc.pathname + loc.search }} />;
  if (role === 'none') return <Awaiting />;
  return <>{children}</>;
}
function RequireRole({ ok, children }: { ok: (r: ReturnType<typeof useAuth>['role']) => boolean; children: ReactNode }) {
  const { role } = useAuth();
  return ok(role) ? <>{children}</> : <NotFound message="You don’t have access to this page." />;
}

export function App() {
  return (
    <Suspense fallback={<Splash />}>
      <Routes>
        <Route path="/sign-in" element={<SignIn />} />
        <Route path="/auth-action" element={<AuthAction />} />
        <Route element={<RequireAuthLayout />}>
          <Route path="/" element={<Navigate to="/recipes" replace />} />
          <Route path="/recipes" element={<Recipes />} />
          <Route path="/recipes/new" element={<RequireRole ok={canWrite}><RecipeEdit /></RequireRole>} />
          <Route path="/recipes/:id" element={<RecipeView />} />
          <Route path="/recipes/:id/edit" element={<RequireRole ok={canWrite}><RecipeEdit /></RequireRole>} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/admin" element={<RequireRole ok={isAdmin}><Admin /></RequireRole>} />
          <Route path="/about" element={<About />} />
          <Route path="/legal" element={<Legal />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
function RequireAuthLayout() {
  return <RequireAuth><Layout /></RequireAuth>;
}
