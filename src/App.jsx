import { useCallback, useState } from 'react';
import Header from './components/Header.jsx';
import InputPanel from './components/InputPanel.jsx';
import ResultCard from './components/ResultCard.jsx';

export default function App() {
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [busyText, setBusyText] = useState('');
  const [error, setError] = useState(null);

  // リセット用: key を変えて InputPanel を再マウント＝入力/タブ/候補を初期化
  const [resetKey, setResetKey] = useState(0);
  const [confirming, setConfirming] = useState(false);

  // 非同期処理を一元管理（ローディング表示とエラー処理）
  const run = useCallback(async (fn, text) => {
    setError(null);
    setBusy(true);
    setBusyText(text || '処理中…');
    try {
      return await fn();
    } catch (e) {
      setError((e && e.message) || '処理に失敗しました。');
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);

  const onResult = useCallback((c) => setResult(c), []);
  const onSwitch = useCallback(() => {
    setResult(null);
    setError(null);
    setConfirming(false);
  }, []);

  // 全てを初期状態に戻す
  const doReset = useCallback(() => {
    setResult(null);
    setError(null);
    setConfirming(false);
    setResetKey((k) => k + 1);
  }, []);

  // リセット要求：結果が表示されている時だけ確認を挟む
  const requestReset = useCallback(() => {
    if (busy) return;
    if (result) setConfirming(true);
    else doReset();
  }, [busy, result, doReset]);

  return (
    <div className="container">
      <Header>
        {confirming ? (
          <span className="reset-confirm">
            <span className="reset-confirm-label">リセットしますか？</span>
            <button type="button" className="btn-mini btn-mini-primary" onClick={doReset}>
              はい
            </button>
            <button type="button" className="btn-mini" onClick={() => setConfirming(false)}>
              いいえ
            </button>
          </span>
        ) : (
          <button type="button" className="reset-btn" onClick={requestReset} disabled={busy}>
            リセット
          </button>
        )}
      </Header>

      <InputPanel key={resetKey} run={run} onResult={onResult} busy={busy} onSwitch={onSwitch} />

      {busy && (
        <div className="status">
          <span className="spinner" aria-hidden="true" />
          {busyText}
        </div>
      )}
      {error && <div className="error">{error}</div>}

      {result && <ResultCard citation={result} />}

      {!result && !busy && !error && (
        <div className="card">
          <div className="empty">上のタブから入力方法を選び、引用情報を取得します。</div>
        </div>
      )}

      <div className="footer">
        すべてブラウザ内で処理されます。情報源: CrossRef / PubMed (NCBI eutils)
      </div>
    </div>
  );
}
