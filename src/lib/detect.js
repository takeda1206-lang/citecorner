// 入力文字列の種類（DOI / PMID / タイトル）を自動判別する
import { normalizeDoi } from './api.js';
import { parseCitationText } from './parse.js';

const TYPE_LABEL = { doi: 'DOI', pmid: 'PMID', title: 'タイトル', japanese: '日本語', empty: '' };

export function describeType(t) {
  return TYPE_LABEL[t] ?? t;
}

// ひらがな・カタカナ・漢字・半角カナを含むか
const JA_RE = /[぀-ヿ㐀-䶿一-鿿豈-﫿ｦ-ﾟ]/;
export function containsJapanese(t) {
  return JA_RE.test(t || '');
}

// 判定結果: { type: 'doi'|'pmid'|'title'|'empty', value, embedded? }
// embedded = 引用文字列など長いテキストの中に DOI/PMID が埋まっている場合。
//            （その ID で外れたらタイトル検索へフォールバックする判断材料）
export function detectInput(raw) {
  const t = (raw || '').replace(/\s+/g, ' ').trim();
  if (!t) return { type: 'empty', value: null };

  // 日本語を含む場合は検索せず、入力された範囲で整形する（誤情報防止のため最優先）
  if (containsJapanese(t)) return { type: 'japanese', value: t };

  // 純粋な数字（4〜9桁）は PMID とみなす
  if (/^\d{4,9}$/.test(t)) return { type: 'pmid', value: t };

  // "PMID: 12345678" のような明示形
  const pmidExplicit = t.match(/^pmid[\s:#=]*(\d{1,9})$/i);
  if (pmidExplicit) return { type: 'pmid', value: pmidExplicit[1] };

  // DOI（素のDOI・doi.org URL・doi: 接頭辞・引用文字列への埋め込み）
  const doi = normalizeDoi(t);
  if (doi) {
    const stripped = t
      .replace(/^(https?:\/\/)?(dx\.)?doi\.org\//i, '')
      .replace(/^doi[\s:]*/i, '')
      .trim();
    const embedded = stripped.length > doi.length + 8;
    return { type: 'doi', value: doi, embedded };
  }

  // 引用文字列中の "PMID: 123456"
  const pmidEmbedded = t.match(/\bPMID[\s:]*(\d{4,9})\b/i);
  if (pmidEmbedded) return { type: 'pmid', value: pmidEmbedded[1], embedded: true };

  return { type: 'title', value: t };
}

// OCR結果や貼り付けテキストの塊から、タイトル検索に使うクエリを作る。
// 引用文字列ならパースしたタイトルを、そうでなければ先頭250字を使う
// （CrossRef の query.bibliographic はノイズ込みでもかなり当ててくれる）。
export function titleQueryFromText(text) {
  const norm = (text || '').replace(/\s+/g, ' ').trim();
  if (!norm) return '';
  const { citation } = parseCitationText(norm);
  if (citation.title && citation.title.length >= 15) return citation.title;
  return norm.slice(0, 250);
}
