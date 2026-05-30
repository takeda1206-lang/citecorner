# CiteCorner

論文の引用をスライド用に整形する、**ブラウザ完結型**の Web アプリです。
DOI / PMID / タイトル / PDF から文献情報を取得し、Vancouver 形式などに整形してワンクリックでコピーできます。

- APIキー・サーバー不要（メタデータ取得は公開API: CrossRef / NCBI eutils）
- ブラウザストレージ（localStorage 等）は未使用
- スマホ対応・日本語UI

## 入力方法

1. **DOI** — CrossRef から取得。さらに PMID を逆引きし、雑誌略名は MEDLINE 側を優先。
2. **PMID** — NCBI eutils（esummary）から取得。
3. **タイトル** — CrossRef を検索 → 候補から選択 → 確定。
4. **PDF** — pdf.js でテキスト抽出 → DOI を自動検出 → 取得。DOI が無ければ推定タイトルで検索。
5. **画像・テキスト（適当モード）** — 画像は tesseract.js で OCR、テキストはそのまま使用。推定で整形し「推定（要確認）」を明示。

## 出力（各コピーボタン付き）

1. フルVancouver（全著者）
2. 筆頭著者 + et al.（タイトルあり）※著者1人なら et al. なし
3. 筆頭著者 + et al.（タイトルなし）← スライド右下用
4. DOI
5. PMID（無ければ「なし」）

著者表記は「姓 イニシャル」（ピリオドなし・カンマ区切り、例: `Takeda T, Sago N`）。

## 開発

```bash
npm install
npm run dev      # http://localhost:5173
```

```bash
npm run build    # dist/ に出力
npm run preview  # ビルド結果をローカル確認
```

## Cloudflare Pages へのデプロイ

| 設定項目 | 値 |
| --- | --- |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Functions | `functions/` を自動検出（設定不要） |

環境変数・シークレットは不要です。

> OCR（入力5）は tesseract.js を使用します。tesseract.js のエンジン本体・wasm はビルドに
> 同梱されますが、英語の学習データ（traineddata）は初回利用時に tesseract.js 既定の CDN から
> 取得されます（APIキー不要）。OCR を使った時だけ読み込まれるため、初期表示は軽量です。

### NCBI eutils プロキシについて

CrossRef は CORS 対応のためブラウザから直接アクセスします。
NCBI eutils は、フロントからは常に同一オリジンの `/api/ncbi/...` を叩き、

- 開発時: Vite の dev proxy（`vite.config.js`）が eutils へ転送
- 本番時: Cloudflare Pages Functions（`functions/api/ncbi/[[path]].js`）が eutils へ中継

という形で CORS 問題を回避しています（APIキー不要）。

### 連絡先（tool / email）の差し替え

NCBI eutils の利用マナーとして `tool=` / `email=` を付与しています。
本番運用前に以下のダミー値を実際の連絡先に差し替えてください。

- `src/lib/api.js` の `TOOL` / `EMAIL` / `MAILTO`
