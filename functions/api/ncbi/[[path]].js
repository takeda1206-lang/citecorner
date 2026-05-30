// Cloudflare Pages Function : NCBI eutils への中継プロキシ（APIキー不要）
//
// /api/ncbi/<endpoint>?<query> へのリクエストを
// https://eutils.ncbi.nlm.nih.gov/entrez/eutils/<endpoint>?<query> に転送する。
// ブラウザから eutils を直接叩くと CORS で弾かれる環境があるための回避策。
// CrossRef はCORS対応なのでフロントから直接叩いており、ここは経由しない。

const EUTILS_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

export async function onRequestGet(context) {
  const { params, request } = context;

  // params.path は ["esummary.fcgi"] のような配列（catch-all ルート）
  const segments = Array.isArray(params.path) ? params.path : [params.path];
  const endpoint = segments.join('/');

  const incoming = new URL(request.url);
  const target = `${EUTILS_BASE}/${endpoint}${incoming.search}`;

  let upstream;
  try {
    upstream = await fetch(target, {
      method: 'GET',
      headers: { Accept: 'application/json, text/xml;q=0.9, */*;q=0.8' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'NCBIへの中継に失敗しました', detail: String(err) }),
      { status: 502, headers: { 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }

  const body = await upstream.arrayBuffer();
  const headers = new Headers();
  headers.set(
    'Content-Type',
    upstream.headers.get('Content-Type') || 'application/json; charset=utf-8'
  );
  // 同一オリジン運用だがフォールバックとして許可しておく
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Cache-Control', 'public, max-age=300');

  return new Response(body, { status: upstream.status, headers });
}
