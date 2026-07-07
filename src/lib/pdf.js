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
    b.parts.push({ x: tr[4], s: it.str, h });
  }
  const lines = [];
  for (const b of buckets.values()) {
    b.parts.sort((p, q) => p.x - q.x);
    const text = b.parts.map((p) => p.s).join('').replace(/\s+/g, ' ').trim();
    if (!text) continue;
    // 行の中で「最大フォントの文字」が占める割合。
    // ドロップキャップ（本文冒頭の飾り大文字）だけが大きい行は比率が低くなるので除外できる。
    const total = b.parts.reduce((n, p) => n + p.s.length, 0);
    const bigLen = b.parts
      .filter((p) => (p.h || 0) >= b.h * 0.8)
      .reduce((n, p) => n + p.s.length, 0);
    lines.push({ y: b.y, h: b.h, ratio: total ? bigLen / total : 1, text });
  }
  lines.sort((a, b) => b.y - a.y); // 上から下へ
  return lines;
}

// フォントの大きい行からタイトルらしき文字列を推定。
// 最大フォントの行が「単語数不足」「記事種別ラベル」「ドロップキャップ行」の場合は
// 次に大きいフォントサイズへ順に落として探す。
const SECTION_LABEL_RE =
  /^(original (article|research|investigation)|research(\s+article)?|review(\s+article)?|brief report|letter|editorial|correspondence|case report|essay|perspective|commentary|special article)\b[.:]?$/i;

function guessTitleFromLines(lines, pageHeight) {
  const top = lines.filter((l) => l.y > pageHeight * 0.3); // ページ上部のみ
  // ドロップキャップ等の混合行（大きい文字が行の半分未満）は除外
  const pool = (top.length ? top : lines).filter((l) => l.ratio >= 0.5);
  if (!pool.length) return null;

  // フォント高さの大きい順に最大4段階試す
  const heights = [...new Set(pool.map((l) => Math.round(l.h * 2) / 2))].sort((a, b) => b - a);
  for (const h of heights.slice(0, 4)) {
    const band = pool.filter((l) => l.h >= h * 0.9 && l.h <= h * 1.15);
    const title = band
      .map((l) => l.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    const words = title.split(/\s+/).filter(Boolean).length;
    if (title.length >= 15 && words >= 3 && !SECTION_LABEL_RE.test(title)) {
      return title;
    }
  }
  return null;
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
  // （"PLME0208_696-701.indd" のようなファイル名・単語数の少ない文字列は採用しない）
  try {
    const meta = await pdf.getMetadata();
    const mt = meta && meta.info && meta.info.Title ? String(meta.info.Title).trim() : '';
    const words = mt.split(/\s+/).filter(Boolean).length;
    const looksLikeFilename = /\.[a-z0-9]{2,5}$/i.test(mt) || (/[_\\/]/.test(mt) && words < 4);
    if (mt && mt.length > 10 && words >= 3 && !/^untitled/i.test(mt) && !looksLikeFilename) {
      titleGuess = mt;
    }
  } catch {
    /* メタデータ無しは無視 */
  }

  const doi = findDoiInText(text);
  return { doi, titleGuess, text };
}
