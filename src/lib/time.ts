/** Convert hours/minutes inputs to total minutes. Empty/invalid -> null. */
export function toMinutes(hours: string | number | null | undefined, minutes: string | number | null | undefined): number | null {
  const h = hours === '' || hours == null ? null : Number(hours);
  const m = minutes === '' || minutes == null ? null : Number(minutes);
  if ((h != null && (!Number.isFinite(h) || h < 0)) || (m != null && (!Number.isFinite(m) || m < 0))) return null;
  if (h == null && m == null) return null;
  return Math.round((h ?? 0) * 60 + (m ?? 0));
}
export function splitMinutes(total: number | null | undefined): { hours: string; minutes: string } {
  if (total == null || !Number.isFinite(total) || total <= 0) return { hours: '', minutes: '' };
  return { hours: String(Math.floor(total / 60)), minutes: String(total % 60) };
}
export function formatDuration(total: number | null | undefined): string | null {
  if (total == null || !Number.isFinite(total) || total <= 0) return null;
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h && m) return h + ' hr ' + m + ' min';
  if (h) return h + ' hr';
  return m + ' min';
}
/** Total time shown/stored: prep + cook when either is present. */
export function computeTotal(prep: number | null | undefined, cook: number | null | undefined): number | null {
  if (prep == null && cook == null) return null;
  return (prep ?? 0) + (cook ?? 0);
}
