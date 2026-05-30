import { useState } from 'react';
import { analyzePdf } from '../lib/pdf.js';
import { fromDoi, searchByTitle, fromCrossrefWork } from '../lib/api.js';
import CandidateList from './CandidateList.jsx';

export default function PdfInput({ run, onResult, busy }) {
  const [items, setItems] = useState(null);
  const [note, setNote] = useState('');
  const [fileName, setFileName] = useState('');

  async function onFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = ''; // 同じファイルを選び直せるように
    if (!file) return;
    setItems(null);
    setNote('');
    setFileName(file.name);

    const analysis = await run(() => analyzePdf(file), 'PDFを解析中…');
    if (!analysis) return;

    if (analysis.doi) {
      setNote(`DOIを検出しました: ${analysis.doi}`);
      const c = await run(() => fromDoi(analysis.doi), 'CrossRef / PubMed を照会中…');
      if (c) onResult(c);
      return;
    }

    if (analysis.titleGuess) {
      setNote(`DOIが見つかりませんでした。推定タイトルで検索します：「${analysis.titleGuess}」`);
      const res = await run(() => searchByTitle(analysis.titleGuess), 'タイトルで検索中…');
      if (res) setItems(res);
    } else {
      setNote('DOIもタイトルも自動抽出できませんでした。「タイトル」タブから手動で検索してください。');
    }
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
          ファイルを選択
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
        PDFからテキストを抽出し、DOIを自動検出します。無ければ推定タイトルで検索します。
        ファイルはブラウザ内で処理され、どこにもアップロードされません。
      </p>
      {note && (
        <p className="hint" style={{ color: 'var(--text)' }}>
          {note}
        </p>
      )}
      {items && <CandidateList items={items} onPick={pick} busy={busy} />}
    </div>
  );
}
