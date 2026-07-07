import { useEffect, useRef, useState } from 'react';
import { analyzePdf } from '../lib/pdf.js';
import { fromDoi, searchByTitle, fromCrossrefWork } from '../lib/api.js';
import CandidateList from './CandidateList.jsx';

// 入力2: PDF。選択（またはページへのドロップ）と同時に解析し、DOI検出→即取得。
// DOIが無い/外れたときは1ページ目の推定タイトル（最大フォント行）で自動検索。
// 推定タイトルは編集して再検索できる。
export default function PdfInput({ run, onResult, busy, droppedFile }) {
  const [items, setItems] = useState(null);
  const [note, setNote] = useState('');
  const [fileName, setFileName] = useState('');
  const [titleGuess, setTitleGuess] = useState('');
  const processedTokenRef = useRef(0);

  // ドロップ/貼り付け経由のファイルを1回だけ処理する
  useEffect(() => {
    if (droppedFile && droppedFile.token !== processedTokenRef.current) {
      processedTokenRef.current = droppedFile.token;
      processFile(droppedFile.file);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [droppedFile]);

  function onFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // 同じファイルを選び直せるように
    if (file) processFile(file);
  }

  async function processFile(file) {
    setItems(null);
    setNote('');
    setFileName(file.name);

    const analysis = await run(() => analyzePdf(file), 'PDFを解析中…');
    if (!analysis) return;
    setTitleGuess(analysis.titleGuess || '');

    if (analysis.doi) {
      setNote(`DOIを検出しました: ${analysis.doi}`);
      const c = await run(() => fromDoi(analysis.doi), 'CrossRef / PubMed を照会中…');
      if (c) {
        onResult(c);
        return;
      }
      // DOIで取れなかった → 推定タイトルへ自動フォールバック
      if (analysis.titleGuess) {
        setNote(`DOI（${analysis.doi}）では取得できなかったため、推定タイトルで検索します。`);
        const res = await run(() => searchByTitle(analysis.titleGuess), 'タイトルで検索中…');
        if (res) setItems(res);
      } else {
        setNote(`DOI（${analysis.doi}）では取得できず、タイトルも抽出できませんでした。下の欄にタイトルを入力して検索してください。`);
      }
      return;
    }

    if (analysis.titleGuess) {
      setNote(`DOIが見つからないため、1ページ目の推定タイトルで検索します：「${analysis.titleGuess}」`);
      const res = await run(() => searchByTitle(analysis.titleGuess), 'タイトルで検索中…');
      if (res) setItems(res);
    } else {
      setNote('DOIもタイトルも自動抽出できませんでした。下の欄にタイトルを入力して検索してください。');
    }
  }

  async function searchGuess(e) {
    e.preventDefault();
    if (!titleGuess.trim() || busy) return;
    setItems(null);
    const res = await run(() => searchByTitle(titleGuess), 'タイトルで検索中…');
    if (res) setItems(res);
  }

  async function pick(work) {
    const c = await run(() => fromCrossrefWork(work), '詳細を取得中…');
    if (c) onResult(c);
  }

  return (
    <div>
      <label className="field-label">PDFアップロード</label>
      <div>
        <label className="btn btn-ghost" style={{ display: 'inline-block', cursor: busy ? 'not-allowed' : 'pointer' }}>
          ファイルを選択（即解析）
          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={onFile}
            disabled={busy}
            style={{ display: 'none' }}
          />
        </label>
        {fileName && (
          <span style={{ marginLeft: 10, color: 'var(--muted)', fontSize: 13 }}>{fileName}</span>
        )}
      </div>
      <p className="hint">
        PDFからテキストを抽出し、DOIを自動検出して即取得します。無ければ1ページ目の推定タイトルで検索します。
        ファイルはブラウザ内で処理され、どこにもアップロードされません。
      </p>
      {note && (
        <p className="hint" style={{ color: 'var(--text)' }}>
          {note}
        </p>
      )}

      {fileName && (
        <form onSubmit={searchGuess} className="input-row" style={{ marginTop: 12 }}>
          <input
            type="text"
            placeholder="推定タイトル（修正して再検索できます）"
            value={titleGuess}
            onChange={(e) => setTitleGuess(e.target.value)}
          />
          <button className="btn btn-ghost" type="submit" disabled={busy || !titleGuess.trim()}>
            このタイトルで検索
          </button>
        </form>
      )}

      {items && <CandidateList items={items} onPick={pick} busy={busy} />}
    </div>
  );
}
