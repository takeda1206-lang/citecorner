import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fromDoi,
  fromPmid,
  searchByTitle,
  fromCrossrefWork,
  normalizeDoi,
} from '../lib/api.js';
import { detectInput, describeType } from '../lib/detect.js';
import { parseCitationText, parseJapaneseCitation } from '../lib/parse.js';
import CandidateList from './CandidateList.jsx';

const MODES = [
  { key: 'auto', label: '自動判別' },
  { key: 'doi', label: 'DOI' },
  { key: 'pmid', label: 'PMID' },
  { key: 'title', label: 'タイトル' },
  { key: 'japanese', label: '日本語' },
];

// モードに応じて「何をどの値で引くか」を決める
function resolveInput(mode, text) {
  if (mode === 'auto') return { ...detectInput(text), auto: true };
  if (mode === 'doi') return { type: 'doi', value: normalizeDoi(text), auto: false };
  if (mode === 'pmid') {
    const m = String(text).match(/\d{1,9}/);
    return { type: 'pmid', value: m ? m[0] : null, auto: false };
  }
  if (mode === 'japanese') {
    return { type: 'japanese', value: String(text).trim() || null, auto: false };
  }
  return { type: 'title', value: String(text).replace(/\s+/g, ' ').trim() || null, auto: false };
}

// 入力1: テキスト自動判別（DOI / PMID / タイトル / 引用文字列）
// 入力が止まったら自動検索。誤認識は種類ボタンで強制指定でき、Enterで即実行。
// PDF/画像の貼り付け（Cmd+V）は onFileInput 経由で該当フローへ振り分ける。
export default function SmartInput({ run, onResult, busy, onFileInput }) {
  const [text, setText] = useState('');
  const [mode, setMode] = useState('auto');
  const [items, setItems] = useState(null);
  const [status, setStatus] = useState(null); // {kind:'info'|'busy'|'ok'|'error', msg}
  const seqRef = useRef(0); // 古い応答を捨てるための通し番号
  const lastKeyRef = useRef(null); // 直近成功した type|value（同一入力の再検索を抑止）
  const timerRef = useRef(null);

  const det = detectInput(text);

  const lookup = useCallback(
    async (eff, rawText, force = false) => {
      if (!eff || eff.type === 'empty') return;
      if (!eff.value) {
        setStatus({ kind: 'error', msg: `入力から${describeType(eff.type)}を読み取れませんでした。` });
        return;
      }
      const key = `${eff.type}|${eff.value}`;
      if (!force && lastKeyRef.current === key) return;
      // 日本語: 検索せず、入力された範囲だけで整形（ネットワークアクセスなし）
      if (eff.type === 'japanese') {
        lastKeyRef.current = key;
        setItems(null);
        onResult(parseJapaneseCitation(rawText));
        setStatus({
          kind: 'ok',
          msg: '日本語として認識 — 検索せず入力内容から整形しました。下の修正欄で調整できます。',
        });
        return;
      }
      const my = ++seqRef.current;
      setStatus({ kind: 'busy', msg: `${describeType(eff.type)}として検索中…` });
      try {
        if (eff.type === 'doi' || eff.type === 'pmid') {
          const c = eff.type === 'doi' ? await fromDoi(eff.value) : await fromPmid(eff.value);
          if (seqRef.current !== my) return;
          lastKeyRef.current = key;
          setItems(null);
          setStatus({ kind: 'ok', msg: `${describeType(eff.type)}として取得しました。` });
          onResult(c);
          return;
        }
        const res = await searchByTitle(eff.value.slice(0, 300));
        if (seqRef.current !== my) return;
        lastKeyRef.current = key;
        if (res.length) {
          setItems(res);
          setStatus({ kind: 'ok', msg: `候補 ${res.length} 件 — 選択してください。` });
        } else {
          setItems(null);
          setStatus({ kind: 'error', msg: '候補が見つかりませんでした。語句を調整するか、種類ボタンで指定してください。' });
        }
      } catch (e) {
        if (seqRef.current !== my) return;
        lastKeyRef.current = null;
        // 引用文字列に埋め込まれた DOI/PMID で外した場合は全文でタイトル再検索
        if (eff.auto && eff.embedded) {
          setStatus({ kind: 'busy', msg: `${describeType(eff.type)}で見つからないため、タイトルで再検索中…` });
          try {
            const res = await searchByTitle(String(rawText).replace(/\s+/g, ' ').trim().slice(0, 300));
            if (seqRef.current !== my) return;
            if (res.length) {
              setItems(res);
              setStatus({ kind: 'ok', msg: `候補 ${res.length} 件 — 選択してください。` });
              return;
            }
          } catch {
            /* フォールバック失敗は下の共通エラーへ */
          }
          if (seqRef.current !== my) return;
        }
        setItems(null);
        setStatus({ kind: 'error', msg: (e && e.message) || '検索に失敗しました。' });
      }
    },
    [onResult]
  );

  // 入力・モードが変わったらデバウンスして自動検索
  useEffect(() => {
    clearTimeout(timerRef.current);
    seqRef.current++; // 入力が変わったら飛行中の応答は捨てる
    const trimmed = text.trim();
    if (!trimmed) {
      setItems(null);
      setStatus(null);
      lastKeyRef.current = null;
      return;
    }
    const eff = resolveInput(mode, text);
    if (!eff.value) {
      setStatus({ kind: 'info', msg: `${describeType(eff.type)}として読める値がまだありません。` });
      return;
    }
    if (eff.type === 'title' && eff.value.length < 12) {
      setStatus({ kind: 'info', msg: 'タイトルとして認識 — もう少し入力すると自動検索します。' });
      return;
    }
    setStatus(
      eff.type === 'japanese'
        ? { kind: 'info', msg: '日本語として認識 — 検索せず入力内容から整形します…' }
        : { kind: 'info', msg: `${describeType(eff.type)}として認識 — まもなく自動検索します…` }
    );
    const delay = eff.type === 'title' ? 800 : eff.type === 'japanese' ? 700 : 400;
    timerRef.current = setTimeout(() => lookup(eff, text), delay);
    return () => clearTimeout(timerRef.current);
  }, [text, mode, lookup]);

  // Enter = 現在のモードで即実行（Shift+Enterは改行、IME変換中は無視）
  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      if (e.nativeEvent && e.nativeEvent.isComposing) return;
      e.preventDefault();
      clearTimeout(timerRef.current);
      lookup(resolveInput(mode, text), text, true);
    }
  }

  // スクリーンショット等のファイル貼り付け → PDF/画像フローへ
  function onPaste(e) {
    const file = e.clipboardData && e.clipboardData.files && e.clipboardData.files[0];
    if (file && onFileInput) {
      e.preventDefault();
      onFileInput(file);
    }
  }

  async function pick(work) {
    const c = await run(() => fromCrossrefWork(work), '詳細を取得中…');
    if (c) {
      onResult(c);
      setStatus({ kind: 'ok', msg: '取得しました。' });
    }
  }

  function estimate() {
    if (!text.trim()) return;
    onResult(parseCitationText(text).citation);
    setStatus({ kind: 'ok', msg: '推定で整形しました（要確認）。' });
  }

  const effNow = resolveInput(mode, text);

  return (
    <div>
      <label className="field-label" htmlFor="smart-input">
        DOI / PMID / タイトル / 引用文字列（自動判別）
      </label>
      <textarea
        id="smart-input"
        className="smart-text"
        placeholder={'例: 10.1056/NEJMoa2034577 ・ 32678530 ・ 論文タイトル ・ 引用文字列の貼り付け\n入力が止まると自動で検索します（Enterで即実行）'}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
      />

      <div className="chips" role="group" aria-label="入力の種類">
        {MODES.map((m) => (
          <button
            key={m.key}
            type="button"
            className={`chip ${mode === m.key ? 'active' : ''} ${
              mode === 'auto' && m.key !== 'auto' && det.type === m.key ? 'detected' : ''
            }`}
            onClick={() => setMode(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="hint">
        自動判別が誤るときは種類ボタンで指定してください（Enterで即実行・Shift+Enterで改行）。
        日本語を含む入力は検索せず、入力された範囲だけで整形します。
        PDF・画像はこのページへのドラッグ＆ドロップや貼り付けでも読み取れます。
      </p>

      {status && (
        <div className={`inline-status ${status.kind}`}>
          {status.kind === 'busy' && <span className="spinner" aria-hidden="true" />}
          {status.msg}
        </div>
      )}

      {effNow.type === 'title' && text.trim().length >= 20 && (
        <div style={{ marginTop: 10 }}>
          <button type="button" className="link-btn" onClick={estimate}>
            検索せず推定で整形する（オフライン・要確認）
          </button>
        </div>
      )}

      {items && <CandidateList items={items} onPick={pick} busy={busy} />}
    </div>
  );
}
