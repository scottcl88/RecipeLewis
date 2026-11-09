import DOMPurify from 'dompurify';

const ALLOWED_TAGS = ['p','br','strong','b','em','i','u','s','ul','ol','li','h1','h2','h3','h4','a','blockquote','span'];
/** Sanitize legacy rich-text HTML before display or storage. Links are forced to open safely. */
export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return '';
  const clean = DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR: ['href'], ALLOW_DATA_ATTR: false });
  return clean.replace(/<a /g, '<a rel="noopener noreferrer" target="_blank" ');
}
/** True when HTML has no visible text (legacy rows contain "<p><br></p>"). */
export function isBlankHtml(html: string | null | undefined): boolean {
  if (!html) return true;
  return sanitizeHtml(html).replace(/<[^>]*>/g, '').trim() === '';
}
