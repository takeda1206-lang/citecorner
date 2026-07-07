# CiteCorner

論文の引用をスライド用に整形する、**ブラウザ完結型**の Web アプリです。
DOI / PMID / タイトル / PDF から文献情報を取得し、Vancouver 形式などに整形してワンクリックでコピーできます。

- APIキー・サーバー不要（メタデータ取得は公開API: CrossRef / NCBI eutils）
- ブラウザストレージ（localStorage 等）は未使用
- スマホ対応・日本語UI

## 入力方法（3タブ・すべて自動実行）

1. **テキスト（自動判別）** — 1つの入力欄に貼るだけで DOI / PMID / タイトルを自動判別し、
   Enter不要で自動検索。誤認識は種類ボタン（自動判別/DOI/PMID/タイトル）で指定でき、Enterで即実行。
   引用文字列に埋め込まれた DOI/PMID も検出（外れたらタイトル検索へ自動フォールバック）。
2. **PDF** — 選択と同時に pdf.js でテキスト抽出 → DOI を検出して即取得。
   DOI が無ければ1ページ目の最大フォント行からタイトルを推定して検索（推定タイトルは修正可能）。
3. **画像OCR** — 選択と同時に tesseract.js で OCR → タイトル優先で自動検索
   → 見つからなければ検出した DOI にフォールバック。OCRテキストは編集でき、編集すると自動再検索。
   オフラインの「推定で整形」（推定（要確認）表示付き）も利用可能。

さらに、**PDF・画像はページのどこにでもドラッグ＆ドロップでき**、種類を自動判別して
該当フローが即実行されます（該当タブへ自動切替）。テキスト欄への画像の貼り付け
（スクリーンショットの Cmd+V）も OCR フローに繋がります。

### 日本語文献

日本語を含む入力は**検索を行わず**（英語DBの誤情報を防ぐため）、入力された範囲だけで
Vancouver 風に整形します。推測はしません。整形後に表示される**修正欄**（著者・タイトル・
雑誌名・年・巻・号・頁など項目別）で加筆修正し、「情報を反映」で出力を更新できます。
筆頭著者略記は「武田太郎, 他.」形式です（著者1人なら「他」なし）。

## 出力（各コピーボタン付き）

1. フルVancouver（全著者）
2. 筆頭著者 + et al.（タイトルあり）※著者1人なら et al. なし
3. 筆頭著者 + et al.（タイトルなし）← スライド右下用
4. DOI
5. PMID（無ければ「なし」）

著者表記は「姓 イニシャル」（ピリオドなし・カンマ区切り、例: `Takeda T, Sago N`）。

## 使い方ページ

アプリのヘッダー「使い方」から開ける説明書（`/usage.html`）を同梱しています。
ソースは `public/usage.html`（静的・自己完結）。

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
