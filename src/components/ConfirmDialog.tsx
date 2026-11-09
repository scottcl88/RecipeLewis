import { useEffect, useRef, useState, type ReactNode } from 'react';

interface Props {
  open: boolean; title: string; children: ReactNode; confirmLabel: string; danger?: boolean;
  onConfirm: () => void | Promise<void>; onCancel: () => void;
  /** If set, the user must type this text to enable confirm (danger zone). */
  requireText?: string;
}
export function ConfirmDialog({ open, title, children, confirmLabel, danger, onConfirm, onCancel, requireText }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) { setTyped(''); d.showModal?.(); }
    if (!open && d.open) d.close();
  }, [open]);
  const ok = !requireText || typed.trim().toLowerCase() === requireText.trim().toLowerCase();
  return (
    <dialog ref={ref} aria-labelledby="confirm-title" onCancel={(e) => { e.preventDefault(); onCancel(); }}>
      <h2 id="confirm-title">{title}</h2>
      <div className="stack">{children}</div>
      {requireText && (
        <div className="field">
          <label htmlFor="confirm-typed">Type “{requireText}” to confirm</label>
          <input id="confirm-typed" className="input" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
        </div>
      )}
      <div className="row row-end" style={{ marginTop: 16 }}>
        <button type="button" className="btn" onClick={onCancel}>Cancel</button>
        <button type="button" className={'btn ' + (danger ? 'btn-danger' : 'btn-primary')} disabled={!ok || busy}
          onClick={async () => { setBusy(true); try { await onConfirm(); } finally { setBusy(false); } }}>{confirmLabel}</button>
      </div>
    </dialog>
  );
}
