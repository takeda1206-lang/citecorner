import { useEffect, useRef, useState } from 'react';
import SmartInput from './SmartInput.jsx';
import PdfInput from './PdfInput.jsx';
import ImageInput from './ImageInput.jsx';

const TABS = [
  { key: 'text', label: 'テキスト（自動判別）' },
  { key: 'pdf', label: 'PDF' },
  { key: 'image', label: '画像OCR' },
];

export default function InputPanel({ run, onResult, busy, onSwitch }) {
  const [tab, setTab] = useState('text');
  // ドロップ/貼り付けされたファイルの受け渡し（token で1回だけ処理させる）
  const [dropped, setDropped] = useState(null); // { file, kind: 'pdf'|'image', token }
  const [dragging, setDragging] = useState(false);
  const [dropError, setDropError] = useState(null);
  const dragDepth = useRef(0);
  const tokenRef = useRef(0);
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const onSwitchRef = useRef(onSwitch);
  onSwitchRef.current = onSwitch;

  // どのタブにいても、PDF/画像ファイルを該当フローへ振り分ける
  function routeFile(file) {
    if (!file || busyRef.current) return;
    const name = (file.name || '').toLowerCase();
    const isPdf = file.type === 'application/pdf' || name.endsWith('.pdf');
    const isImage = (file.type || '').startsWith('image/');
    if (!isPdf && !isImage) {
      setDropError('PDFまたは画像ファイルをドロップしてください。');
      return;
    }
    setDropError(null);
    if (onSwitchRef.current) onSwitchRef.current(); // 前の結果・エラーをクリア
    tokenRef.current += 1;
    setTab(isPdf ? 'pdf' : 'image');
    setDropped({ file, kind: isPdf ? 'pdf' : 'image', token: tokenRef.current });
  }
  const routeFileRef = useRef(routeFile);
  routeFileRef.current = routeFile;

  // ページ全体をドロップ受付にする（テキスト選択のドラッグ等、ファイル以外は素通し）
  useEffect(() => {
    const hasFiles = (e) =>
      e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
    const onDragEnter = (e) => {
      if (!hasFiles(e)) return;
      dragDepth.current++;
      setDragging(true);
    };
    const onDragLeave = (e) => {
      if (!hasFiles(e)) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragging(false);
    };
    const onDragOver = (e) => {
      if (hasFiles(e)) e.preventDefault(); // ブラウザがファイルを開くのを防ぐ
    };
    const onDrop = (e) => {
      dragDepth.current = 0;
      setDragging(false);
      const files = e.dataTransfer && e.dataTransfer.files;
      if (files && files.length) {
        e.preventDefault();
        routeFileRef.current(files[0]);
      }
    };
    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  function choose(k) {
    if (k === tab) return;
    setTab(k);
    setDropError(null);
    if (onSwitch) onSwitch();
  }

  const formProps = { run, onResult, busy };

  return (
    <div className="card">
      <h2 className="card-title">
        <span className="dot" />
        入力
      </h2>

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`tab ${tab === t.key ? 'active' : ''}`}
            onClick={() => choose(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'text' && <SmartInput {...formProps} onFileInput={routeFile} />}
      {tab === 'pdf' && (
        <PdfInput
          {...formProps}
          droppedFile={dropped && dropped.kind === 'pdf' ? dropped : null}
        />
      )}
      {tab === 'image' && (
        <ImageInput
          {...formProps}
          droppedFile={dropped && dropped.kind === 'image' ? dropped : null}
        />
      )}

      {dropError && <div className="error">{dropError}</div>}

      {dragging && (
        <div className="drop-overlay" aria-hidden="true">
          <div className="drop-overlay-box">
            PDF / 画像をドロップ — 自動で判別して読み取ります
          </div>
        </div>
      )}
    </div>
  );
}
