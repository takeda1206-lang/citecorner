import { useState } from 'react';
import { fromPmid } from '../lib/api.js';

export default function PmidInput({ run, onResult, busy }) {
  const [val, setVal] = useState('');

  async function submit(e) {
    e.preventDefault();
    if (!val.trim() || busy) return;
    const c = await run(() => fromPmid(val), 'PubMed を照会中…');
    if (c) onResult(c);
  }

  return (
    <form onSubmit={submit}>
      <label className="field-label" htmlFor="pmid-input">
        PMID
      </label>
      <div className="input-row">
        <input
          id="pmid-input"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="例: 16060722"
          value={val}
          onChange={(e) => setVal(e.target.value)}
        />
        <button className="btn" type="submit" disabled={busy || !val.trim()}>
          取得
        </button>
      </div>
      <p className="hint">PubMed の PMID（数字）を入力してください。</p>
    </form>
  );
}
