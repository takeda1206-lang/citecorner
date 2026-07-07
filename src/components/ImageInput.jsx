import { useEffect, useRef, useState } from 'react';
import { ocrImage } from '../lib/ocr.js';
import { titleQueryFromText } from '../lib/detect.js';
import { parseCitationText } from '../lib/parse.js';
import {
  fromDoi,
  fromPmid,
  searchByTitle,
  fromCrossrefWork,
  normalizeDoi,
} from '../lib/api.js';
import CandidateList from './CandidateList.jsx';

// 入力3: 画像OCR。画像を選ぶ（またはページへドロップ/貼り付け）と即OCR →
// タイトルを判別して自動検索。タイトルで見つからなければ検出したDOIにフォールバック。
// テキスト修正でも自動再検索。
export default function ImageInput({ run, onResult, busy, droppedFile }) {
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [ocrProgress, setOcrProgress] = useState(null);
  const [items, setItems] = useState(null);
  const [status, setStatus] = useState(null);
  const seqRef = useRef(0);
  const timerRef = useRef(null);
  const processedTokenRef = useRef(0);

  // ドロップ/貼り付け経由のファイルを1回だけ処理する
  useEffect(() => {
    if (droppedFile && droppedFile.token !== processedTokenRef.current) {
      processedTokenRef.current = droppedFile.token;
      processImage(droppedFile.file);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [droppedFile]);

  const detectedDoi = normalizeDoi(text);
  const pmidMatch = text.match(/\bPMID[\s:]*(\d{4,9})\b/i);
  const detectedPmid = pmidMatch ? pmidMatch[1] : null;

  async function analyze(raw) {
    const norm = (raw || '').replace(/\s+/g, ' ').trim();
    if (!norm) return;
    const my = ++seqRef.current;
    setStatus({ kind: 'busy', msg: 'タイトルを判別して検索中…' });
    try {
      const q = titleQueryFromText(norm);
      const res = await searchByTitle(q.slice(0, 300));
      if (seqRef.current !== my) return;
      if (res.length) {
        setItems(res);
        setStatus({ kind: 'ok', msg: `候補 ${res.length} 件 — 選択してください。` });
        return;
      }
      // タイトルで見つからない → 検出したDOIで取得
      const doi = normalizeDoi(norm);
      if (doi) {
        setStatus({ kind: 'busy', msg: 'タイトルで見つからないため、検出したDOIで取得中…' });
        const c = await fromDoi(doi);
        if (seqRef.current !== my) return;
        setItems(null);
        setStatus({ kind: 'ok', msg: 'DOIから取得しました。' });
        onResult(c);
        return;
      }
      setItems(null);
      setStatus({
        kind: 'error',
        msg: 'タイトルもDOIも判別できませんでした。テキストを修正するか「推定で整形」を使ってください。',
      });
    } catch (e) {
      if (seqRef.current !== my) return;
      setStatus({ kind: 'error', msg: (e && e.message) || '検索に失敗しました。' });
    }
  }

  // OCR完了・手修正のどちらでも、テキストが変わったら自動で再検索
  useEffect(() => {
    clearTimeout(timerRef.current);
    seqRef.current++;
    if (!text.trim()) {
      setItems(null);
      setStatus(null);
      return;
    }
    timerRef.current = setTimeout(() => analyze(text), 900);
    return () => clearTimeout(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  function onImage(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (file) processImage(file);
  }

  async function processImage(file) {
    setFileName(file.name || 'clipboard-image');
    setOcrProgress(0);
    const recognized = await run(() => ocrImage(file, (p) => setOcrProgress(p)), '画像をOCR中…');
    setOcrProgress(null);
    if (recognized != null) {
      const t = recognized.trim();
      setText((prev) => (prev ? prev + '\n' : '') + t); // setText → effect が自動検索
    }
  }

  async function pick(work) {
    const c = await run(() => fromCrossrefWork(work), '詳細を取得中…');
    if (c) {
      onResult(c);
      setStatus({ kind: 'ok', msg: '取得しました。' });
    }
  }

  async function preciseDoi() {
    const c = await run(() => fromDoi(detectedDoi), 'DOIで正確に取得中…');
    if (c) onResult(c);
  }
  async function precisePmid() {
    const c = await run(() => fromPmid(detectedPmid), 'PMIDで正確に取得中…');
    if (c) onResult(c);
  }
  function estimate() {
    if (!text.trim()) return;
    onResult(parseCitationText(text).citation);
    setStatus({ kind: 'ok', msg: '推定で整形しました（要確認）。' });
  }

  return (
    <div>
      <label className="field-label">画像OCR</label>

      <div style={{ marginBottom: 12 }}>
        <label
          className="btn btn-ghost"
          style={{ display: 'inline-block', cursor: busy ? 'not-allowed' : 'pointer' }}
        >
          画像を選択（即OCR → 自動検索）
          <input
            type="file"
            accept="image/*"
            onChange={onImage}
            disabled={busy}
            style={{ display: 'none' }}
          />
        </label>
        {fileName && (
          <span style={{ marginLeft: 10, color: 'var(--muted)', fontSize: 13 }}>{fileName}</span>
        )}
      </div>

      {ocrProgress != null && (
        <div>
          <div className="status">
            <span className="spinner" aria-hidden="true" />
            画像をOCR中… {Math.round(ocrProgress * 100)}%
          </div>
          <div className="progress">
            <span style={{ width: `${Math.round(ocrProgress * 100)}%` }} />
          </div>
        </div>
      )}

      <textarea
        placeholder="OCR結果がここに入ります（修正すると自動で再検索）。テキストを直接貼り付けても使えます。"
        value={text}
        onChange={(e) => setText(e.target.value)}
        style={{ marginTop: 6 }}
      />
      <p className="hint">
        タイトルを優先して検索し、見つからなければ検出したDOIを使います。
        画像・テキストはブラウザ内で処理され、どこにもアップロードされません。
      </p>

      {status && (
        <div className={`inline-status ${status.kind}`}>
          {status.kind === 'busy' && <span className="spinner" aria-hidden="true" />}
          {status.msg}
        </div>
      )}

      {(detectedDoi || detectedPmid || text.trim()) && (
        <div className="hint" style={{ color: 'var(--text)', lineHeight: 2, marginTop: 10 }}>
          {detectedDoi && (
            <div>
              DOIを検出: <code>{detectedDoi}</code>{' '}
              <button type="button" className="copy-btn" onClick={preciseDoi} disabled={busy}>
                このDOIで取得
              </button>
            </div>
          )}
          {detectedPmid && (
            <div>
              PMIDを検出: <code>{detectedPmid}</code>{' '}
              <button type="button" className="copy-btn" onClick={precisePmid} disabled={busy}>
                このPMIDで取得
              </button>
            </div>
          )}
          {text.trim() && (
            <div>
              <button type="button" className="link-btn" onClick={estimate}>
                検索せず推定で整形する（オフライン・要確認）
              </button>
            </div>
          )}
        </div>
      )}

      {items && <CandidateList items={items} onPick={pick} busy={busy} />}
    </div>
  );
}
