// 引用文字列の整形ロジック（純粋関数）
//
// citation オブジェクトの形:
// {
//   authors: string[],      // ["Takeda T", "Sago N"]  ← 「姓 イニシャル」ピリオドなし
//   title: string|null,
//   journalAbbrev: string|null,
//   journalFull: string|null,
//   year: string|null,
//   volume: string|null,
//   issue: string|null,
//   pageStart: string|null,
//   pageEnd: string|null,
//   doi: string|null,
//   pmid: string|null,
//   estimated: boolean,
//   sources: string[],
// }

export const NONE = 'なし';

// 値が空なら「なし」を返す（情報表示用）
export function orNone(v) {
  if (v === null || v === undefined) return NONE;
  const s = String(v).trim();
  return s === '' ? NONE : s;
}

// ページ範囲を "開始頁-終了頁" に整形（終了頁が無ければ開始頁のみ）
export function pageRange(c) {
  const s = (c.pageStart || '').trim();
  const e = (c.pageEnd || '').trim();
  if (s && e) return `${s}-${e}`;
  return s || '';
}

// 末尾が句読点（和文含む）で終わっているか
function endsWithPunct(s) {
  return /[.?!。．？！]$/.test(s.trim());
}

// 「文」を連結する。前の文が句読点で終わっていればスペースのみ、
// そうでなければ ". " を挟む。
function joinSentences(parts) {
  let out = '';
  for (const raw of parts) {
    const p = (raw || '').trim();
    if (!p) continue;
    if (out) out += endsWithPunct(out) ? ' ' : '. ';
    out += p;
  }
  return out;
}

// 年;巻(号):頁. の末尾部分を組み立てる（無い項目は省略）
function refTail(c) {
  let s = '';
  if (c.year) s += c.year;
  if (c.volume) s += `;${c.volume}`;
  if (c.issue) s += `(${c.issue})`;
  const pages = pageRange(c);
  if (pages) s += `:${pages}`;
  s = s.replace(/^;/, ''); // 年が無い場合に先頭の ; を除去
  return s ? `${s}.` : '';
}

// 著者部分・タイトル有無を受け取り 1本の引用文字列を組み立てる
function build(authorSeg, includeTitle, c) {
  const parts = [];
  if (authorSeg) parts.push(authorSeg);
  if (includeTitle && c.title) parts.push(c.title);
  if (c.journalAbbrev) parts.push(c.journalAbbrev);

  let s = joinSentences(parts);
  const tail = refTail(c);
  if (tail) {
    if (s) s += endsWithPunct(s) ? ' ' : '. ';
    s += tail; // tail は末尾に . を含む
  } else if (s && !endsWithPunct(s)) {
    s += '.';
  }
  return s.trim();
}

// 全著者をカンマ区切りで（例: "Takeda T, Sago N"）
export function allAuthors(c) {
  return (c.authors || []).join(', ');
}

// 筆頭著者 + et al.（著者1人なら et al. を付けない）
// 日本語文献では「武田太郎, 他」形式（build() 側で末尾に . が付く）
export function firstAuthorEtAl(c) {
  const a = c.authors || [];
  if (a.length === 0) return '';
  if (a.length === 1) return a[0];
  return c.lang === 'ja' ? `${a[0]}, 他` : `${a[0]}, et al`;
}

// 出力1: フルVancouver（全著者・タイトルあり）
export function vancouverFull(c) {
  return build(allAuthors(c), true, c);
}

// 出力2: 筆頭著者 + et al.（タイトルあり）
export function etAlWithTitle(c) {
  return build(firstAuthorEtAl(c), true, c);
}

// 出力3: 筆頭著者 + et al.（タイトルなし）← スライド右下用
export function etAlNoTitle(c) {
  return build(firstAuthorEtAl(c), false, c);
}

// 5種の出力をまとめて返す
export function buildOutputs(c) {
  return [
    {
      key: 'full',
      label: 'フルVancouver（全著者）',
      value: vancouverFull(c),
    },
    {
      key: 'etal-title',
      label: '筆頭著者 + et al.（タイトルあり）',
      value: etAlWithTitle(c),
    },
    {
      key: 'etal-notitle',
      label: '筆頭著者 + et al.（タイトルなし）',
      hint: 'スライド右下用',
      value: etAlNoTitle(c),
    },
    {
      key: 'doi',
      label: 'DOI',
      value: orNone(c.doi),
    },
    {
      key: 'pmid',
      label: 'PMID',
      value: orNone(c.pmid),
    },
  ];
}
