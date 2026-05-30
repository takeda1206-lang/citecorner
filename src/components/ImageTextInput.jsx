import { useMemo, useState } from 'react';
import { ocrImage } from '../lib/ocr.js';
import { parseCitationText } from '../lib/parse.js';
import { fromDoi, fromPmid, normalizeDoi } from '../lib/api.js';

// 入力5: 画像・テキスト（適当モード）
export default function ImageTextInput({ run, onResult, busy }) {
  const [text, setText] = useState('');
  const [ocrProgress, setOcrProgress] = useState(null);
  const [fileName, setFileName] = useState('');

  // 入力テキスト中の DOI / PMID を検出（正確取得のショートカット用）
  const detected = useMemo(() => {
    const doi = normalizeDoi(text);
    const pm = text.match(/\bPMID:?\s*(\d{4,9})\b/i);
    return { doi, pmid: pm ? pm[1] : null };
  }, [text]);

  async function onImage(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setFileName(file.name);
    setOcrProgress(0);
    const recognized = await run(
      () => ocrImage(file, (p) => setOcrProgress(p)),
      '画像をOCR中…'
    );
    setOcrProgress(null);
    if (recognized != null) {
      const t = recognized.trim();
      setText((prev) => (prev ? prev + '\n' : '') + t);
    }
  }

  function estimate() {
    if (!text.trim() || busy) return;
    const { citation } = parseCitationText(text);
    onResult(citation);
  }

  async function preciseDoi() {
    const c = await run(() => fromDoi(detected.doi), 'DOIで正確に取得中…');
    if (c) onResult(c);
  }
  async function precisePmid() {
    const c = await run(() => fromPmid(detected.pmid), 'PMIDで正確に取得中…');
    if (c) onResult(c);
  }

  return (
    <div>
      <label className="field-label">画像・テキスト（適当モード）</label>

      <div style={{ marginBottom: 12 }}>
        <label
          className="btn btn-ghost"
          style={{ display: 'inline-block', cursor: busy ? 'not-allowed' : 'pointer' }}
        >
          画像から読み取り（OCR）
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
        placeholder={'引用テキストを貼り付け、または画像から読み取り。\n例: Takeda T, Sago N. Title. N Engl J Med. 2020;382(8):700-708.'}
        value={text}
        onChange={(e) => setText(e.target.value)}
        style={{ marginTop: 6 }}
      />

      <p className="hint">
        この内容から推定で整形します。結果には「推定（要確認）」が付きます。
        画像・テキストはブラウザ内で処理され、どこにもアップロードされません。
      </p>

      {(detected.doi || detected.pmid) && (
        <div className="hint" style={{ color: 'var(--text)', lineHeight: 2 }}>
          {detected.doi && (
            <div>
              DOIを検出: <code>{detected.doi}</code>{' '}
              <button type="button" className="copy-btn" onClick={preciseDoi} disabled={busy}>
                正確に取得
              </button>
            </div>
          )}
          {detected.pmid && (
            <div>
              PMIDを検出: <code>{detected.pmid}</code>{' '}
              <button type="button" className="copy-btn" onClick={precisePmid} disabled={busy}>
                正確に取得
              </button>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        <button type="button" className="btn" onClick={estimate} disabled={busy || !text.trim()}>
          推定して整形
        </button>
      </div>
    </div>
  );
}
