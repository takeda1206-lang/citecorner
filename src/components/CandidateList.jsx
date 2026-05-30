import { summarizeWork } from '../lib/api.js';

// CrossRef の検索結果（raw work 配列）を候補として表示し、選択を受け取る
export default function CandidateList({ items, onPick, busy }) {
  if (!items.length) {
    return (
      <p className="hint" style={{ marginTop: 14 }}>
        候補が見つかりませんでした。語句を調整して再検索してください。
      </p>
    );
  }
  return (
    <div className="candidates">
      {items.map((w, i) => {
        const s = summarizeWork(w);
        return (
          <button
            key={w.DOI || i}
            type="button"
            className="candidate"
            onClick={() => onPick(w)}
            disabled={busy}
          >
            <div className="candidate-title">{s.title}</div>
            <div className="candidate-meta">
              {[s.authors, s.journal, s.year].filter(Boolean).join(' ・ ')}
            </div>
          </button>
        );
      })}
    </div>
  );
}
