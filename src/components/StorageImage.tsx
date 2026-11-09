import { useEffect, useState } from 'react';
import { imageUrl } from '../lib/data';

/** Loads a Storage image via the SDK (reads need sign-in). Falls back to nothing on failure. */
export function StorageImage({ path, alt, className }: { path: string; alt: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    imageUrl(path).then((u) => live && setUrl(u)).catch(() => live && setFailed(true));
    return () => { live = false; };
  }, [path]);
  if (failed) return <div role="img" aria-label={alt + ' (photo unavailable)'} className={className} style={{ background: 'var(--color-border)', minHeight: 80 }} />;
  if (!url) return <div className={'skeleton ' + (className ?? '')} style={{ aspectRatio: '4/3' }} aria-hidden="true" />;
  return <img src={url} alt={alt} className={className} loading="lazy" />;
}
