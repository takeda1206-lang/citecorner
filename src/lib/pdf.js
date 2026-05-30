// PDF からテキストを抽出し、DOI とタイトル候補を拾う
import * as pdfjsLib from 'pdfjs-dist';
// Vite の ?worker でワーカーをバンドルし、実ワーカーで動かす（fake worker 回避）
import PdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker';

pdfjsLib.GlobalWorkerOptions.workerPort = new PdfjsWorker();

// 1ページ分のテキストを「行」（y座標でまとめ、最大フォント高さ付き）に変換
async function pageToLines(page) {
  const content = await page.getTextContent();
  const buckets = new Map();
  for (const it of content.items) {
    if (!it.str || !it.str.trim()) continue;
    const tr = it.transform;
    const h = it.height || Math.hypot(tr[2], tr[3]);
    const yKey = Math.round(tr[5] / 2) * 2; // 2px単位でまとめる
    if (!buckets.has(yKey)) buckets.set(yKey, { y: tr[5], h: 0, parts: [] });
    const b = buckets.get(yKey);
    b.h = Math.max(b.h, h);
    b.parts.push({ x: tr[4], s: it.str });
  }
  const lines = [];
  for (const b of buckets.values()) {
    b.parts.sort((p, q) => p.x - q.x);
    const text = b.parts.map((p) => p.s).join('').replace(/\s+/g, ' ').trim();
    if (text) lines.push({ y: b.y, h: b.h, text });
  }
  lines.sort((a, b) => b.y - a.y); // 上から下へ
  return lines;
}

// フォントの大きい行からタイトルらしき文字列を推定
function guessTitleFromLines(lines, pageHeight) {
  const top = lines.filter((l) => l.y > pageHeight * 0.3); // ページ上部のみ
  const pool = top.length ? top : lines;
  if (!pool.length) return null;
  const maxH = Math.max(...pool.map((l) => l.h));
  const big = pool.filter((l) => l.h >= maxH * 0.9);
  const title = big
    .map((l) => l.text)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (title.length < 12) return null;
  if (/^(original article|review article|review|letter|editorial|correspondence|case report)\.?$/i.test(title)) {
    return null;
  }
  return title;
}

// テキスト全体から最初のDOIを拾う
export function findDoiInText(text) {
  if (!text) return null;
  const m = text.match(/10\.\d{4,9}\/[^\s"<>]+/);
  return m ? m[0].replace(/[.,;)\]]+$/, '') : null;
}

// PDFファイルを解析して { doi, titleGuess, text } を返す
export async function analyzePdf(file, { maxPages = 3 } = {}) {
  const data = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data }).promise;

  let text = '';
  let titleGuess = null;

  const pageCount = Math.min(pdf.numPages, maxPages);
  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const lines = await pageToLines(page);
    text += lines.map((l) => l.text).join('\n') + '\n';
    if (i === 1) {
      const pageHeight = page.view[3];
      titleGuess = guessTitleFromLines(lines, pageHeight);
    }
  }

  // PDFメタデータのタイトルがまともならそちらを優先
  try {
    const meta = await pdf.getMetadata();
    const mt = meta && meta.info && meta.info.Title ? String(meta.info.Title).trim() : '';
    if (mt && mt.length > 10 && !/^untitled/i.test(mt) && !/\.(pdf|docx?|tex)$/i.test(mt)) {
      titleGuess = mt;
    }
  } catch {
    /* メタデータ無しは無視 */
  }

  const doi = findDoiInText(text);
  return { doi, titleGuess, text };
}
