import { useId, useState, type KeyboardEvent } from 'react';
import { normalizeTag } from '../lib/slug';

interface Props { value: string[]; onChange: (t: string[]) => void; suggestions: string[]; id: string }
export function TagInput({ value, onChange, suggestions, id }: Props) {
  const [text, setText] = useState('');
  const listId = useId();
  const add = (raw: string) => {
    const t = normalizeTag(raw);
    if (t && !value.includes(t) && value.length < 30) onChange([...value, t]);
    setText('');
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(text); }
    else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1));
  };
  return (
    <div>
      <div className="chips" style={{ marginBottom: 8 }}>
        {value.map((t) => (
          <span className="chip" key={t}>{t}
            <button type="button" className="chip-remove" aria-label={'Remove tag ' + t} onClick={() => onChange(value.filter((x) => x !== t))}>×</button>
          </span>
        ))}
      </div>
      <input id={id} className="input" value={text} list={listId} onChange={(e) => setText(e.target.value)} onKeyDown={onKey}
        onBlur={() => text && add(text)} placeholder="Type a tag, press Enter" aria-describedby={id + '-help'} />
      <datalist id={listId}>{suggestions.filter((s) => !value.includes(s)).map((s) => <option key={s} value={s} />)}</datalist>
      <div id={id + '-help'} className="help">Press Enter to add. Up to 30 tags.</div>
    </div>
  );
}
