// 文献メタデータの取得・正規化
//
// - CrossRef は CORS 対応なのでブラウザから直接叩く
// - NCBI eutils は同一オリジンの /api/ncbi 経由（dev=Viteプロキシ / prod=Pages Function）
//
// tool= / email= はダミー。本番では下の TOOL / EMAIL を差し替える。

const NCBI = '/api/ncbi';
const TOOL = 'citecorner';
const EMAIL = 'citecorner@example.com'; // TODO: 本番用の連絡先メールに差し替える

const CROSSREF = 'https://api.crossref.org';
const MAILTO = 'citecorner@example.com'; // TODO: 本番用の連絡先メールに差し替える

// ---- 低レベルユーティリティ ----------------------------------------------

function eutilsUrl(endpoint, params) {
  const q = new URLSearchParams({ ...params, tool: TOOL, email: EMAIL });
  return `${NCBI}/${endpoint}?${q.toString()}`;
}

async function getJson(url, timeout = 20000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  let res;
  try {
    res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error('通信がタイムアウトしました。時間をおいて再試行してください。');
    throw new Error('ネットワークエラーが発生しました。接続を確認してください。');
  }
  clearTimeout(timer);
  if (!res.ok) throw new Error(`データの取得に失敗しました (HTTP ${res.status})`);
  try {
    return await res.json();
  } catch {
    throw new Error('応答の解析に失敗しました。');
  }
}

// ---- テキスト整形 --------------------------------------------------------

function decodeEntities(str) {
  return str
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

// HTMLタグ除去・実体参照デコード・空白正規化
function sanitize(s) {
  if (!s) return '';
  let t = String(s).replace(/<[^>]+>/g, '');
  t = decodeEntities(t);
  return t.replace(/\s+/g, ' ').trim();
}

// given name からイニシャルを作る（"John P. A." -> "JPA"）
function initialsFromGiven(given) {
  const g = (given || '').trim();
  if (!g) return '';
  if (/^[A-Z]{1,4}$/.test(g)) return g; // 既にイニシャルのみ
  return g
    .split(/[\s.\-]+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase())
    .join('');
}

// CrossRef の著者1件 -> "姓 イニシャル"
function formatCrossrefAuthor(a) {
  if (!a) return '';
  if (a.family) {
    const fam = sanitize(a.family);
    const ini = initialsFromGiven(a.given);
    return ini ? `${fam} ${ini}` : fam;
  }
  if (a.name) return sanitize(a.name); // 団体名など
  return '';
}

function parsePages(p) {
  const s = sanitize(p);
  if (!s) return { start: null, end: null };
  const parts = s.split(/\s*[-–—]\s*/);
  return { start: parts[0]?.trim() || null, end: parts[1]?.trim() || null };
}

function yearFromCrossref(work) {
  const d =
    work.published ||
    work['published-print'] ||
    work['published-online'] ||
    work.issued;
  const y = d && d['date-parts'] && d['date-parts'][0] && d['date-parts'][0][0];
  return y ? String(y) : null;
}

function yearFromPubmed(rec) {
  if (rec.sortpubdate) {
    const m = rec.sortpubdate.match(/^(\d{4})/);
    if (m) return m[1];
  }
  if (rec.pubdate) {
    const m = rec.pubdate.match(/(\d{4})/);
    if (m) return m[1];
  }
  return null;
}

function doiFromPubmed(rec) {
  const fromIds = (rec.articleids || []).find((x) => x.idtype === 'doi');
  if (fromIds && fromIds.value) return fromIds.value.trim();
  if (rec.elocationid) {
    const m = rec.elocationid.match(/10\.\d{4,9}\/\S+/);
    if (m) return m[0];
  }
  return null;
}

// 入力文字列から DOI を抽出（URL や "doi:" 付きでも可）
export function normalizeDoi(input) {
  if (!input) return null;
  const m = String(input).match(/10\.\d{4,9}\/[^\s"<>]+/);
  return m ? m[0].replace(/[.,;]+$/, '') : null;
}

// ---- 正規化 --------------------------------------------------------------

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
    estimated: false,
    sources: [],
  };
}

function normalizeCrossref(work) {
  const c = emptyCitation();
  c.authors = (work.author || []).map(formatCrossrefAuthor).filter(Boolean);
  c.title = sanitize(work.title && work.title[0]) || null;
  c.journalAbbrev = sanitize(work['short-container-title'] && work['short-container-title'][0]) || null;
  c.journalFull = sanitize(work['container-title'] && work['container-title'][0]) || null;
  c.year = yearFromCrossref(work);
  c.volume = work.volume ? String(work.volume).trim() : null;
  c.issue = work.issue ? String(work.issue).trim() : null;
  const pg = parsePages(work.page);
  c.pageStart = pg.start;
  c.pageEnd = pg.end;
  c.doi = work.DOI ? work.DOI.trim() : null;
  c.sources = ['CrossRef'];
  return c;
}

function normalizePubmed(rec) {
  const c = emptyCitation();
  const all = (rec.authors || []).filter((a) => a && a.name);
  const indiv = all.filter((a) => a.authtype !== 'CollectiveName');
  c.authors = (indiv.length ? indiv : all).map((a) => sanitize(a.name));
  c.title = sanitize(rec.title) || null;
  c.journalAbbrev = sanitize(rec.source) || null;
  c.year = yearFromPubmed(rec);
  c.volume = rec.volume ? String(rec.volume).trim() : null;
  c.issue = rec.issue ? String(rec.issue).trim() : null;
  const pg = parsePages(rec.pages);
  c.pageStart = pg.start;
  c.pageEnd = pg.end;
  c.doi = doiFromPubmed(rec);
  c.pmid = rec.uid ? String(rec.uid) : null;
  c.sources = ['PubMed'];
  return c;
}

// ---- eutils 個別呼び出し -------------------------------------------------

export async function doiToPmid(doi) {
  const url = eutilsUrl('esearch.fcgi', { db: 'pubmed', term: `${doi}[doi]`, retmode: 'json' });
  const j = await getJson(url);
  const id = j && j.esearchresult && j.esearchresult.idlist && j.esearchresult.idlist[0];
  return id || null;
}

async function esummary(pmid) {
  const url = eutilsUrl('esummary.fcgi', { db: 'pubmed', id: pmid, retmode: 'json' });
  const j = await getJson(url);
  const rec = j && j.result && j.result[pmid];
  if (!rec || rec.error) return null;
  return rec;
}

async function fetchCrossrefWork(doi) {
  const url = `${CROSSREF}/works/${doi}?mailto=${encodeURIComponent(MAILTO)}`;
  const j = await getJson(url);
  if (!j || !j.message) throw new Error('CrossRefでこのDOIが見つかりませんでした。');
  return j.message;
}

// DOI から PMID を引き、見つかれば esummary で雑誌略名(MEDLINE)を優先・欠損を補完
async function enrich(c) {
  if (!c.doi) return c;
  let pmid = null;
  try {
    pmid = await doiToPmid(c.doi);
  } catch {
    /* PMID取得失敗は無視（CrossRefだけで続行） */
  }
  if (!pmid) return c;
  c.pmid = pmid;

  let rec = null;
  try {
    rec = await esummary(pmid);
  } catch {
    /* esummary失敗も無視 */
  }
  if (!rec) return c;

  const p = normalizePubmed(rec);
  if (p.journalAbbrev) c.journalAbbrev = p.journalAbbrev; // 雑誌略名は MEDLINE を優先
  if (!c.year) c.year = p.year;
  if (!c.volume) c.volume = p.volume;
  if (!c.issue) c.issue = p.issue;
  if (!c.pageStart) {
    c.pageStart = p.pageStart;
    c.pageEnd = p.pageEnd;
  }
  if (!c.title) c.title = p.title;
  if (!c.authors.length) c.authors = p.authors;
  if (!c.sources.includes('PubMed')) c.sources.push('PubMed');
  return c;
}

// ---- 公開API ------------------------------------------------------------

// DOI から取得
export async function fromDoi(input) {
  const doi = normalizeDoi(input);
  if (!doi) throw new Error('DOIの形式が正しくありません（例: 10.1056/NEJMoa2034577）。');
  const work = await fetchCrossrefWork(doi);
  const c = normalizeCrossref(work);
  return enrich(c);
}

// PMID から取得（esummary のみ）
export async function fromPmid(input) {
  const pmid = String(input || '').replace(/[^0-9]/g, '');
  if (!pmid) throw new Error('PMIDは数字で入力してください。');
  const rec = await esummary(pmid);
  if (!rec) throw new Error('該当するPMIDが見つかりませんでした。');
  return normalizePubmed(rec);
}

// 候補（CrossRef work）を選択して確定
export async function fromCrossrefWork(work) {
  const c = normalizeCrossref(work);
  return enrich(c);
}

// タイトルで CrossRef を検索して候補（raw work 配列）を返す
export async function searchByTitle(title, rows = 8) {
  const q = (title || '').trim();
  if (!q) throw new Error('検索するタイトルを入力してください。');
  const url =
    `${CROSSREF}/works?` +
    new URLSearchParams({
      'query.bibliographic': q,
      rows: String(rows),
      select: 'DOI,title,author,container-title,short-container-title,volume,issue,page,published,issued',
      mailto: MAILTO,
    });
  const j = await getJson(url);
  return (j && j.message && j.message.items) || [];
}

// 候補表示用の要約を作る
export function summarizeWork(work) {
  const authors = (work.author || []).map(formatCrossrefAuthor).filter(Boolean);
  let authorLine = authors.slice(0, 3).join(', ');
  if (authors.length > 3) authorLine += ', et al';
  return {
    title: sanitize(work.title && work.title[0]) || '(タイトルなし)',
    authors: authorLine || '著者情報なし',
    journal:
      sanitize((work['short-container-title'] && work['short-container-title'][0]) ||
        (work['container-title'] && work['container-title'][0])) || '',
    year: yearFromCrossref(work) || '',
    doi: work.DOI || '',
  };
}
