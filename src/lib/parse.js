// 自由テキスト（OCR結果や貼り付け）から引用情報を推定する（適当モード）
//
// 完全な解析は目指さず、よくある Vancouver 風の並び
//   著者. タイトル. 雑誌. 年;巻(号):頁.
// を手掛かりにベストエフォートで推定する。結果は estimated: true。

function emptyCitation() {
  return {
    authors: [],
    title: null,
    journalAbbrev: null,
    journalFull: null,
    year: null,
    volume: null,
    issue: null,
    pageStart: null,
    pageEnd: null,
    doi: null,
    pmid: null,
    estimated: true,
    lang: null,
    sources: ['推定'],
  };
}

// 著者リストらしい文字列か（"Surname AB, Surname CD" / "et al" を含む）
function looksLikeAuthors(s) {
  if (/et\.?\s*al/i.test(s)) return true;
  const names = s.split(/\s*,\s*/).map((n) => n.trim()).filter(Boolean);
  if (!names.length) return false;
  let hits = 0;
  for (const n of names) {
    // 末尾がイニシャル（大文字1〜4字）で終わる
    if (/^\p{Lu}[\p{L}'’.\-]+(?:\s+[\p{L}'’.\-]+)*\s+\p{Lu}{1,4}$/u.test(n)) hits++;
  }
  return hits >= 1 && hits >= names.length - 1;
}

// 著者文字列を ["Surname I", ...] に
function parseAuthors(s) {
  return s
    .replace(/\bet\.?\s*al\.?/gi, '')
    .split(/\s*,\s*/)
    .map((n) => n.trim().replace(/\.$/, '').replace(/\s+/g, ' '))
    .filter(Boolean)
    .filter((n) => !/^and$/i.test(n));
}

// ---- 日本語文献（検索なし・入力の範囲のみ・推測なし） ----------------------

// 全角の数字・英字・記号をASCIIに正規化（機械的な表記ゆれ吸収のみ）
function normalizeJa(s) {
  return String(s || '')
    .replace(/[０-９Ａ-Ｚａ-ｚ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/；/g, ';')
    .replace(/：/g, ':')
    .replace(/，/g, ',')
    .replace(/\s+/g, ' ')
    .trim();
}

// 著者欄をカンマ・読点で分割（「他」「ほか」「et al」は著者として数えない）
function splitJaAuthors(s) {
  return String(s || '')
    .split(/[,、]/)
    .map((a) => a.trim())
    .filter(Boolean)
    .filter((a) => !/^(他|ほか|et\s*al\.?)$/i.test(a));
}

// 日本語文献のパース。
// 「著者名. 論文タイトル. 雑誌名. 年;巻(号):開始-終了.」の並びとして機械的に分割する。
// 検索・推測は一切しない（分割の解釈違いは修正欄で直してもらう前提）。
export function parseJapaneseCitation(raw) {
  const c = emptyCitation();
  c.lang = 'ja';
  c.estimated = false;
  c.sources = ['入力テキスト（検索なし）'];

  let t = normalizeJa(raw);
  if (!t) return c;

  // 入力に書かれている DOI / PMID はそのまま拾う（検索はしない）
  const doiM = t.match(/10\.\d{4,9}\/[^\s"<>]+/);
  if (doiM) c.doi = doiM[0].replace(/[.,;)\]]+$/, '');
  const pmidM = t.match(/\bPMID[\s:]*(\d{4,9})\b/i);
  if (pmidM) c.pmid = pmidM[1];
  let head = t
    .replace(/\b(?:doi[\s:]*)?10\.\d{4,9}\/[^\s"<>]+/gi, '')
    .replace(/\bPMID[\s:]*\d{4,9}\b/gi, '')
    .trim();

  // 末尾の「年;巻(号):頁」パターン（年の後の「年」、ダッシュ類の表記ゆれを許容）
  const tail = head.match(
    /((?:19|20)\d{2})\s*年?\s*;\s*(\d+)\s*(?:\(([^)]+)\))?\s*(?::\s*([A-Za-z]?\d+)(?:\s*[-‐–—−ー－〜～]\s*([A-Za-z]?\d+))?)?/
  );
  if (tail) {
    c.year = tail[1];
    c.volume = tail[2] || null;
    c.issue = tail[3] || null;
    c.pageStart = tail[4] || null;
    c.pageEnd = tail[5] || null;
    head = head.slice(0, tail.index).trim();
  } else {
    // 末尾近くの「2020年.」「(2020)」のような年だけの表記（タイトル中の年号は拾わない）
    const y = head.match(/[(\s]((?:19|20)\d{2})\s*年?\s*[).。．]?\s*$/);
    if (y) {
      c.year = y[1];
      head = head.slice(0, y.index).trim();
    }
  }

  // 「著者名. タイトル. 雑誌名」の並びとして位置で分割（区切り: 。 ． .）
  const segs = head
    .split(/[.。．]\s*/)
    .map((s) => s.trim().replace(/[,、]+$/, ''))
    .filter(Boolean);

  if (segs.length >= 3) {
    c.authors = splitJaAuthors(segs[0]);
    c.title = segs.slice(1, -1).join('. ') || null;
    c.journalAbbrev = segs[segs.length - 1] || null;
  } else if (segs.length === 2) {
    c.authors = splitJaAuthors(segs[0]);
    c.title = segs[1] || null;
  } else if (segs.length === 1) {
    c.title = segs[0]; // 1区切りだけの入力はタイトルとして扱う（修正欄で変更可能）
  }

  return c;
}

export function parseCitationText(text) {
  const c = emptyCitation();
  const raw = (text || '').replace(/\s+/g, ' ').trim();
  if (!raw) return { citation: c, detectedDoi: null, detectedPmid: null };

  // DOI / PMID
  const doiM = raw.match(/10\.\d{4,9}\/[^\s"<>]+/);
  c.doi = doiM ? doiM[0].replace(/[.,;)\]]+$/, '') : null;
  const pmidM = raw.match(/\bPMID:?\s*(\d{4,9})\b/i);
  c.pmid = pmidM ? pmidM[1] : null;

  // 末尾: 年;巻(号):頁
  const tail = raw.match(
    /\b((?:19|20)\d{2})\s*;\s*(\d+)\s*(?:\(\s*([^)]+?)\s*\))?\s*(?::\s*([A-Za-z]?\d+)(?:\s*[-–—]\s*([A-Za-z]?\d+))?)?/
  );
  let head = raw;
  if (tail) {
    c.year = tail[1];
    c.volume = tail[2] || null;
    c.issue = tail[3] || null;
    c.pageStart = tail[4] || null;
    c.pageEnd = tail[5] || null;
    head = raw.slice(0, tail.index).trim();
  } else {
    const ym = raw.match(/\b((?:19|20)\d{2})\b/);
    if (ym) c.year = ym[1];
  }

  // DOI/PMID の文字列を head から除去
  head = head
    .replace(/\bdoi:?\s*10\.\d{4,9}\/[^\s"<>]+/gi, '')
    .replace(/10\.\d{4,9}\/[^\s"<>]+/g, '')
    .replace(/\bPMID:?\s*\d{4,9}\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.;,]\s*$/, '');

  const parts = head.split(/\.\s+/).map((s) => s.trim()).filter(Boolean);

  if (parts.length >= 3) {
    if (looksLikeAuthors(parts[0])) {
      c.authors = parseAuthors(parts[0]);
      c.journalAbbrev = parts[parts.length - 1];
      c.title = parts.slice(1, -1).join('. ');
    } else {
      c.title = parts.slice(0, -1).join('. ');
      c.journalAbbrev = parts[parts.length - 1];
    }
  } else if (parts.length === 2) {
    if (looksLikeAuthors(parts[0])) {
      c.authors = parseAuthors(parts[0]);
      c.title = parts[1];
    } else {
      c.title = parts[0];
      c.journalAbbrev = parts[1];
    }
  } else if (parts.length === 1) {
    if (looksLikeAuthors(parts[0])) c.authors = parseAuthors(parts[0]);
    else c.title = parts[0];
  }

  if (c.title) c.title = c.title.replace(/\s*\.\s*$/, '').trim() || null;
  if (c.journalAbbrev) c.journalAbbrev = c.journalAbbrev.replace(/\s*\.\s*$/, '').trim() || null;

  return { citation: c, detectedDoi: c.doi, detectedPmid: c.pmid };
}
