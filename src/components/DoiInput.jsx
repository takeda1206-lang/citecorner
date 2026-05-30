import { useState } from 'react';
import { fromDoi } from '../lib/api.js';

export default function DoiInput({ run, onResult, busy }) {
  const [val, setVal] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!val.trim() || busy) return;
    const c = await run(() => fromDoi(val), 'CrossRef / PubMed を照会中…');
    if (c) onResult(c);
  }

  return (
    <form onSubmit={submit}>
      <label className="field-label" htmlFor="doi-input">
        DOI
      </label>
      <div className="input-row">
        <input
          id="doi-input"
          type="text"
          inputMode="text"
          autoComplete="off"
          placeholder="例: 10.1056/NEJMoa2034577"
          value={val}
          onChange={(e) => setVal(e.target.value)}
        />
        <button className="btn" type="submit" disabled={busy || !val.trim()}>
          取得
        </button>
      </div>
      <p className="hint">
        DOI、または https://doi.org/… 形式のURLを貼り付けできます。
      </p>
    </form>
  );
}
