import { useEffect, useState } from 'react';

// 日本語文献の修正欄。項目ごとに加筆修正し「情報を反映」で整形結果を更新する。
// 検索・推測はせず、ここに入力された値だけを使う。空欄の項目は出力に含めない。
export default function JapaneseEditCard({ citation, onResult }) {
  const [f, setF] = useState({
    authors: '',
    title: '',
    journal: '',
    year: '',
    volume: '',
    issue: '',
    pageStart: '',
    pageEnd: '',
    doi: '',
    pmid: '',
  });

  // 新しい解析結果が来たら欄に反映する
  useEffect(() => {
    setF({
      authors: (citation.authors || []).join(', '),
      title: citation.title || '',
      journal: citation.journalAbbrev || '',
      year: citation.year || '',
      volume: citation.volume || '',
      issue: citation.issue || '',
      pageStart: citation.pageStart || '',
      pageEnd: citation.pageEnd || '',
      doi: citation.doi || '',
      pmid: citation.pmid || '',
    });
  }, [citation]);

  const set = (k) => (e) => setF((prev) => ({ ...prev, [k]: e.target.value }));

  function apply(e) {
    e.preventDefault();
    const trim = (s) => s.trim() || null;
    onResult({
      authors: f.authors
        .split(/[,、，]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((a) => !/^(他|ほか|et\s*al\.?)$/i.test(a)),
      title: trim(f.title),
      journalAbbrev: trim(f.journal),
      journalFull: null,
      year: trim(f.year),
      volume: trim(f.volume),
      issue: trim(f.issue),
      pageStart: trim(f.pageStart),
      pageEnd: trim(f.pageEnd),
      doi: trim(f.doi),
      pmid: trim(f.pmid),
      estimated: false,
      lang: 'ja',
      sources: ['入力テキスト（検索なし）'],
    });
  }

  return (
    <div className="card">
      <h2 className="card-title">
        <span className="dot" />
        日本語文献の修正欄
        <span className="badge badge-green">検索なし・入力の範囲で整形</span>
      </h2>

      <form onSubmit={apply} className="ja-edit">
        <div>
          <label className="field-label" htmlFor="ja-authors">
            著者名（カンマまたは読点区切り）
          </label>
          <input
            id="ja-authors"
            type="text"
            placeholder="例: 武田太郎, 佐込直樹"
            value={f.authors}
            onChange={set('authors')}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="ja-title">
            論文タイトル
          </label>
          <input id="ja-title" type="text" value={f.title} onChange={set('title')} />
        </div>
        <div>
          <label className="field-label" htmlFor="ja-journal">
            雑誌名（略記）
          </label>
          <input id="ja-journal" type="text" value={f.journal} onChange={set('journal')} />
        </div>

        <div className="ja-edit-row">
          <div>
            <label className="field-label" htmlFor="ja-year">発行年</label>
            <input id="ja-year" type="text" inputMode="numeric" value={f.year} onChange={set('year')} />
          </div>
          <div>
            <label className="field-label" htmlFor="ja-volume">巻</label>
            <input id="ja-volume" type="text" value={f.volume} onChange={set('volume')} />
          </div>
          <div>
            <label className="field-label" htmlFor="ja-issue">号</label>
            <input id="ja-issue" type="text" value={f.issue} onChange={set('issue')} />
          </div>
          <div>
            <label className="field-label" htmlFor="ja-page-start">開始ページ</label>
            <input id="ja-page-start" type="text" value={f.pageStart} onChange={set('pageStart')} />
          </div>
          <div>
            <label className="field-label" htmlFor="ja-page-end">終了ページ</label>
            <input id="ja-page-end" type="text" value={f.pageEnd} onChange={set('pageEnd')} />
          </div>
        </div>

        <div className="ja-edit-row two">
          <div>
            <label className="field-label" htmlFor="ja-doi">DOI（あれば）</label>
            <input id="ja-doi" type="text" value={f.doi} onChange={set('doi')} />
          </div>
          <div>
            <label className="field-label" htmlFor="ja-pmid">PMID（あれば）</label>
            <input id="ja-pmid" type="text" inputMode="numeric" value={f.pmid} onChange={set('pmid')} />
          </div>
        </div>

        <div>
          <button className="btn" type="submit">
            情報を反映
          </button>
        </div>
      </form>

      <p className="hint" style={{ marginTop: 12 }}>
        入力の解釈は「著者名. タイトル. 雑誌名. 年;巻(号):頁.」の並びに従います。
        空欄の項目は出力に含めません。検索・推測は行いません。
      </p>
    </div>
  );
}
