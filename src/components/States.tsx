import type { ReactNode } from 'react';
import { EmptyCardIcon } from './icons';

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="banner banner-error" role="alert">
      <span><strong>Something went wrong.</strong> {message}</span>
      {onRetry && <button type="button" className="btn" onClick={onRetry}>Try again</button>}
    </div>
  );
}
export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <EmptyCardIcon />
      <h2>{title}</h2>
      <div className="muted" style={{ marginBottom: 16 }}>{children}</div>
    </div>
  );
}
export function CardSkeletons({ count = 8 }: { count?: number }) {
  return (
    <ul className="grid" aria-busy="true" aria-label="Loading recipes">
      {Array.from({ length: count }, (_, i) => (
        <li key={i}><div className="card" aria-hidden="true"><div className="skeleton" style={{ aspectRatio: '4/3', borderRadius: 0 }} /><div className="card-body"><div className="skeleton" style={{ height: 22, width: '70%' }} /><div className="skeleton" style={{ height: 14, width: '45%' }} /></div></div></li>
      ))}
    </ul>
  );
}
export function RecipeSkeleton() {
  return (
    <div className="reading" aria-busy="true" aria-label="Loading recipe">
      <div className="skeleton" style={{ height: 44, width: '70%', marginBottom: 16 }} />
      <div className="skeleton" style={{ height: 18, width: '40%', marginBottom: 24 }} />
      <div className="skeleton" style={{ height: 260, marginBottom: 24 }} />
      <div className="skeleton" style={{ height: 16, marginBottom: 8 }} /><div className="skeleton" style={{ height: 16, width: '85%' }} />
    </div>
  );
}
