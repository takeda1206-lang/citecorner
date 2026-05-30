# CiteCorner 開発進捗 (PROGRESS.md)

> 別の Mac で続きを再開するための引き継ぎメモ。このファイルとソースを読めば再開できる。
> 最終更新: 2026-05-30

---

## 1. プロジェクト概要

論文の引用をスライド用に整形する、**完全ブラウザ内完結**の Web アプリ。

- **技術**: React 18 + Vite 5、パッケージ管理は npm
- **公開先**: Cloudflare Pages（前提）
- **制約**: APIキー不要・サーバー側状態なし・localStorage 等のブラウザストレージ未使用
- **UI**: 日本語、スマホ対応、落ち着いたグリーン基調（アクセント `#587850` / 背景 `#F8F8F4`）

DOI / PMID / タイトル / PDF / 画像・テキスト の5方式で文献情報を取得し、
Vancouver 形式など5種に整形してワンクリックでコピーできる。

---

## 2. 現在の状態 — **入力1〜5 + リセット 全部完成・動作確認済み**

最初の指示「入力1〜4を先に完成→動作確認→そのあと画像OCR(入力5)」は**両方とも完了済み**。
さらに追加要望の**ヘッダー右リセットボタン**も実装・検証済み。

### 完了・ブラウザ実機で確認済みの機能

| 機能 | 状態 | 確認に使った実データ |
|---|---|---|
| 入力1 DOI | ✅ | `10.1056/NEJMoa2021436`, `10.1371/journal.pmed.0020124` |
| 入力2 PMID | ✅ | `32678530`, `16060722` |
| 入力3 タイトル検索→候補→選択 | ✅ | "Global cancer statistics 2020 GLOBOCAN…" |
| 入力4 PDF→DOI自動抽出→取得 | ✅ | PLoS Medicine の実PDFで検証 |
| 入力5 画像OCR(tesseract.js)+推定整形 | ✅ | canvas生成画像でOCR実行確認 |
| 入力5 テキスト貼付→推定整形 | ✅ | Vancouver風テキスト各種 |
| 出力5種 + コピーボタン | ✅ | 「コピーしました」表示も確認 |
| リセット（結果表示時のみ確認ダイアログ） | ✅ | はい/いいえ/結果なし即クリア の4経路 |
| 本番ビルド `npm run build` | ✅ | エラー0で通過 |

### 整形ロジックの検証済みケース（`src/lib/format.js`）
- **著者1人・団体著者には `et al.` を付けない**（"The RECOVERY Collaborative Group" で確認）
- 複数著者は `Takeda T, et al.` 形式（姓 イニシャル・ピリオドなし・カンマ区切り）
- タイトル末尾が `?` でもピリオド重複なし（`… false? Lancet.` 等）
- 欠損項目（号・頁・PMID等）は自動で省略、情報表示では「なし」
- DOI取得時は esearch→esummary で PMID 逆引き、**雑誌略名は MEDLINE 側を優先**

---

## 3. 別の Mac で再開する手順

このフォルダは Dropbox 配下（`~/Dropbox/ClaudeCode/citecorner`）なので、ファイル自体は同期される。
ただし **`node_modules` は OS/Mac 間でそのまま使い回さず、入れ直すのが安全**。

```bash
cd ~/Dropbox/ClaudeCode/citecorner

# 1. 依存を入れ直す（node_modules が同期されていても一度消して入れ直すと確実）
rm -rf node_modules
npm install

# 2. 開発サーバー起動 → http://localhost:5173/
npm run dev

# 3. 本番ビルド確認（任意）
npm run build      # dist/ に出力
npm run preview    # http://localhost:4173/ でビルド結果を確認
```

- 推奨環境: Node 18+（開発時は Node v25.9.0 / npm 11.12.1 を使用）
- Git は未初期化。バージョン管理したい場合は `git init` から（`.gitignore` は用意済み）。

---

## 4. ファイル構成と役割

```
citecorner/
├── index.html                      # エントリHTML（favicon=緑のCマーク、lang=ja）
├── vite.config.js                  # ★dev時 /api/ncbi → eutils へproxy する設定
├── package.json / package-lock.json
├── .gitignore
├── README.md                       # 利用者・デプロイ向け説明
├── PROGRESS.md                     # このファイル
├── .claude/launch.json             # プレビュー用ツール設定（開発補助・本番無関係）
├── functions/
│   └── api/ncbi/[[path]].js        # ★Cloudflare Pages Function: eutils中継プロキシ
└── src/
    ├── main.jsx                    # React マウント
    ├── App.jsx                     # ★ルート: 状態管理・run()共通化・リセット制御
    ├── index.css                   # 全スタイル（CSS変数でテーマ定義）
    ├── components/
    │   ├── Header.jsx              # ヘッダー（右側に children でリセットを差し込む）
    │   ├── InputPanel.jsx          # タブ切替（DOI/PMID/タイトル/PDF/画像・テキスト）
    │   ├── DoiInput.jsx            # 入力1
    │   ├── PmidInput.jsx           # 入力2
    │   ├── TitleInput.jsx          # 入力3（検索→CandidateList）
    │   ├── PdfInput.jsx            # 入力4（pdf.js→DOI or タイトル検索）
    │   ├── ImageTextInput.jsx      # 入力5（OCR+貼付→推定、DOI/PMID検出時は正確取得）
    │   ├── CandidateList.jsx       # CrossRef候補の表示・選択
    │   ├── CopyButton.jsx          # クリップボードコピー+「コピーしました」
    │   └── ResultCard.jsx          # 取得情報テーブル + 出力5種
    └── lib/
        ├── api.js                  # ★CrossRef直 + eutils(同一オリジン)、正規化・enrich
        ├── format.js               # ★引用文字列の整形（純粋関数・テスト容易）
        ├── pdf.js                  # pdf.jsでテキスト抽出・DOI/タイトル推定
        ├── parse.js                # 自由テキストの推定パース（適当モード）
        └── ocr.js                  # tesseract.js ラッパ（動的import・遅延読込）
```

`★` が中核ファイル。挙動を直す時はまずここを見る。

---

## 5. アーキテクチャ・重要な技術的決定

### 5-1. CrossRef は直アクセス / NCBI eutils は同一オリジン経由
- **CrossRef** (`api.crossref.org`) は CORS 対応 → フロントから直接 fetch。
- **NCBI eutils** はフロントからは**常に同一オリジンの `/api/ncbi/...`** を叩く。
  - 開発時: `vite.config.js` の dev proxy が `/api/ncbi` → `https://eutils.ncbi.nlm.nih.gov/entrez/eutils` に転送。
  - 本番時: `functions/api/ncbi/[[path]].js`（Cloudflare Pages Function）が同じく中継。
  - → dev/prod どちらでもフロントのコードは同じ。CORSで弾かれても本番で動く。
- 補足: 調査時点では eutils は実は `access-control-allow-origin: *` を返していたが、
  指示通り**プロキシ経由に統一**して将来の CORS 変更に対して堅牢にしてある。

### 5-2. DOI取得時の enrich フロー（`src/lib/api.js` の `enrich()`）
1. CrossRef で works/{doi} を取得・正規化
2. esearch で `{doi}[doi]` → PMID を逆引き
3. PMID があれば esummary を取得し、**雑誌略名(MEDLINE)を優先**、欠損項目を補完

### 5-3. ライブラリの遅延読込
- `tesseract.js` は `src/lib/ocr.js` 内で `await import('tesseract.js')`（動的import）。
  OCRを使った時だけ読み込むので初期表示が軽い（ビルドで別チャンクに分離される）。
- `pdfjs-dist` のワーカーは Vite の `?worker` で実ワーカーとしてバンドル
  （`src/lib/pdf.js` 冒頭。fake worker 回避のためここは重要）。

### 5-4. リセットの実装（`src/App.jsx`）
- `resetKey` を `+1` して `<InputPanel key={resetKey}>` を**再マウント**し、
  各入力タブのローカル状態（入力値・候補）をまとめて初期化。
- `result`（取得結果）が表示されている時だけ「リセットしますか？ はい/いいえ」確認を挟む。
  結果が無い時は確認なしで即クリア。

### 5-5. ビルド時の注意（ハマりどころ）
- `public/` ディレクトリに余計なサブフォルダを作らないこと。Vite は `public/*` を
  `dist/` 直下にコピーするため、`functions/` 等を誤って入れると dist が汚れる。
  （開発中に一度発生→削除済み。現在 `public/` は存在しない＝それで正常。）

---

## 6. 重要な決定事項（ユーザー判断）

| 項目 | 決定 | 対応 |
|---|---|---|
| eutils `tool=`/`email=`・CrossRef `mailto` | **今はダミーのまま**でよい | `src/lib/api.js` L9-11 に `citecorner@example.com` 等。本番前に要差し替え |
| ヘッダー右側 | タグライン廃止し**リセットボタン**を配置 | 実装済み（結果表示時のみ確認ダイアログ） |

---

## 7. 残りのタスク / 未完了 / 既知の制限

### 本番化の前にやること
- [ ] **連絡先の差し替え**: `src/lib/api.js` の `TOOL` / `EMAIL` / `MAILTO`
      （現在ダミー `citecorner@example.com` / tool=`citecorner`）を実際の値に。
- [ ] **Cloudflare Pages への実デプロイ**（下記セクション8）。まだビルド確認のみで未デプロイ。

### 任意の改善余地（必須ではない）
- [ ] 自動テストは未整備（整形ロジック検証は手動スクリプトで実施、リポジトリには未保存）。
      `src/lib/format.js` と `src/lib/parse.js` は純粋関数なのでユニットテストを足しやすい。
- [ ] PDF のタイトル推定（`src/lib/pdf.js`）は最大フォント行ベースのヒューリスティック。
      レイアウト次第で外すことがある。その場合は「タイトル」タブで手動検索する導線あり。
- [ ] 適当モード（`src/lib/parse.js`）は Vancouver 風の並びを想定。崩れた入力では推定精度が落ちる
      （仕様通り「推定（要確認）」バッジを出して明示している）。
- [ ] ビルド時に pdf.worker チャンクが 500KB 超の警告が出る（動作影響なし。気になれば分割設定）。

---

## 8. Cloudflare Pages デプロイ手順

| 設定項目 | 値 |
|---|---|
| Build command | `npm run build` |
| Build output directory | `dist` |
| Functions | `functions/` を自動検出（設定不要） |
| 環境変数 / シークレット | **不要** |

- `functions/` はプロジェクトルートに置く（Cloudflare Pages がルートから読む）。配置済み。
- OCRの英語学習データ(traineddata)は初回利用時に tesseract.js 既定のCDNから取得（APIキー不要）。
- デプロイ方法は「GitHub連携」または「`wrangler pages deploy dist`」のどちらでも可。

---

## 9. 動作確認に使える鉄板サンプル

```
DOI : 10.1056/NEJMoa2021436   (RECOVERY/デキサメタゾン → 団体著者で et al. なしを確認できる)
DOI : 10.1371/journal.pmed.0020124  (Ioannidis 単著 → 単著で et al. なしを確認できる)
PMID: 32678530
PMID: 16060722
適当モード貼付例:
  Sung H, Ferlay J, Siegel RL. Global Cancer Statistics 2020. CA Cancer J Clin. 2021;71(3):209-249.
```
