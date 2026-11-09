export function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}
export function normalizeTag(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ').slice(0, 40);
}
