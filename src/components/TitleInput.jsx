import { useState } from 'react';
import { searchByTitle, fromCrossrefWork } from '../lib/api.js';
import CandidateList from './CandidateList.jsx';

export default function TitleInput({ run, onResult, busy }) {
  const [val, setVal] = useState('');
  const [items, setItems] = useState(null);

  async function search(e) {
    e.preventDefault();
    if (!val.trim() || busy) return;
    setItems(null);
    const res = await run(() => searchByTitle(val), 'CrossRef を検索中…');
    if (res) setItems(res);
  }

  async function pick(work) {
    const c = await run(() => fromCrossrefWork(work), '詳細を取得中…');
    if (c) onResult(c);
  }

  return (
    <form onSubmit={search}>
      <label className="field-label" htmlFor="title-input">
        タイトル
      </label>
      <div className="input-row">
        <input
          id="title-input"
          type="text"
          autoComplete="off"
          placeholder="論文タイトルを入力"
          value={val}
          onChange={(e) => setVal(e.target.value)}
        />
        <button className="btn" type="submit" disabled={busy || !val.trim()}>
          検索
        </button>
      </div>
      <p className="hint">
        CrossRef を検索して候補を表示します。候補を選ぶと整形します。
      </p>
      {items && <CandidateList items={items} onPick={pick} busy={busy} />}
    </form>
  );
}
