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
