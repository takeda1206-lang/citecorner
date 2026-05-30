import { useEffect, useRef, useState } from 'react';

// クリップボードにコピーし「コピーしました」を一瞬表示するボタン
export default function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);

  const disabled = !text || text === 'なし';

  async function onCopy() {
    if (disabled) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        fallbackCopy(text);
      }
    } catch {
      fallbackCopy(text);
    }
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1200);
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <button
      type="button"
      className={`copy-btn ${copied ? 'copied' : ''}`}
      onClick={onCopy}
      disabled={disabled}
    >
      {copied ? 'コピーしました' : 'コピー'}
    </button>
  );
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand('copy');
  } catch {
    /* ignore */
  }
  document.body.removeChild(ta);
}
