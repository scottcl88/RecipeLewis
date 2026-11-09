import type { ReactNode } from 'react';
const base = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false } as const;
const I = (d: ReactNode) => () => <svg {...base}>{d}</svg>;
export const BookIcon = I(<><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z" /><path d="M20 17v4H6.5A2.5 2.5 0 0 1 4 18.5" /></>);
export const PlusIcon = I(<><path d="M12 5v14M5 12h14" /></>);
export const UserIcon = I(<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>);
export const ShieldIcon = I(<><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /></>);
export const ClockIcon = I(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>);
export const PlateIcon = I(<><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /></>);
export const EmptyCardIcon = () => (
  <svg viewBox="0 0 72 72" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    <rect x="12" y="10" width="48" height="52" rx="6" /><path d="M22 24h28M22 34h28M22 44h16" />
  </svg>
);
