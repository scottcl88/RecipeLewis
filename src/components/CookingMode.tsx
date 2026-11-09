import { useEffect, useRef, useState } from 'react';
import type { Ingredient } from '../lib/types';
import { formatIngredient } from '../lib/ingredients';

interface Props { title: string; steps: string[]; ingredients: Ingredient[]; onClose: () => void }

/** Full-screen, one step at a time. Large text, big buttons, best-effort wake lock, no timers. */
export function CookingMode({ title, steps, ingredients, onClose }: Props) {
  const [i, setI] = useState(0);
  const [showIng, setShowIng] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const last = steps.length - 1;

  useEffect(() => {
    closeRef.current?.focus();
    let lock: { release: () => Promise<void> } | null = null;
    const wl = (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock;
    wl?.request('screen').then((l) => { lock = l; }).catch(() => undefined); // best effort
    return () => { void lock?.release().catch(() => undefined); };
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || (e.key === ' ' && document.activeElement?.tagName !== 'BUTTON')) { e.preventDefault(); setI((n) => Math.min(last, n + 1)); }
      else if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1));
      else if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [last, onClose]);

  return (
    <div className="cook" role="dialog" aria-modal="true" aria-label={'Cooking mode: ' + title}>
      <div className="cook-head">
        <strong>{title}</strong>
        <div className="row">
          <button type="button" className="btn" aria-pressed={showIng} onClick={() => setShowIng((s) => !s)}>Ingredients</button>
          <button type="button" className="btn" ref={closeRef} onClick={onClose}>Exit</button>
        </div>
      </div>
      <div className="cook-body">
        {showIng && <ul className="checklist" style={{ marginBottom: 16 }}>{ingredients.map((g, n) => <li key={n}>{formatIngredient(g)}</li>)}</ul>}
        {steps.length === 0 ? <p className="cook-step">This recipe has no typed steps. Exit to view its photo or card.</p> : (
          <>
            <p className="muted" aria-live="polite">Step {i + 1} of {steps.length}</p>
            <p className="cook-step">{steps[i]}</p>
          </>
        )}
        <div className="cook-nav">
          <button type="button" className="btn" disabled={i === 0} onClick={() => setI(i - 1)}>← Previous</button>
          {i < last ? <button type="button" className="btn btn-primary" onClick={() => setI(i + 1)}>Next →</button>
            : <button type="button" className="btn btn-primary" onClick={onClose}>Done</button>}
        </div>
      </div>
    </div>
  );
}
