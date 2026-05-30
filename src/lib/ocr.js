// tesseract.js による画像OCR（ブラウザ内で実行）
// tesseract.js は初回利用時に動的 import（メインバンドルを軽く保つ）。
// 言語データ・wasm は tesseract.js の既定（CDN）から取得される。

export async function ocrImage(file, onProgress) {
  const { default: Tesseract } = await import('tesseract.js');
  const { data } = await Tesseract.recognize(file, 'eng', {
    logger: (m) => {
      if (m.status === 'recognizing text' && typeof onProgress === 'function') {
        onProgress(m.progress);
      }
    },
  });
  return (data && data.text) || '';
}
