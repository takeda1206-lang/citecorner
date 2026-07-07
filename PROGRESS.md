# CiteCorner 開発進捗 (PROGRESS.md)

> 別の Mac で続きを再開するための引き継ぎメモ。このファイルとソースを読めば再開できる。
> 最終更新: 2026-07-07（スマート入力UI・自動検索へ全面改修 + ドラッグ&ドロップ/貼り付け対応）

---

## 1. プロジェクト概要

論文の引用をスライド用に整形する、**完全ブラウザ内完結**の Web アプリ。

- **技術**: React 18 + Vite 5、パッケージ管理は npm
- **公開先**: Cloudflare Pages（前提）
- **制約**: APIキー不要・サーバー側状態なし・localStorage 等のブラウザストレージ未使用
- **UI**: 日本語、スマホ対応、落ち着いたグリーン基調（アクセント `#587850` / 背景 `#F8F8F4`）

---

## 2. 現在の状態 — **スマート入力UI（第2世代）完成・全フロー動作確認済み**

初期版（DOI/PMID/タイトル/PDF/画像テキストの5タブ・手動実行）は完成後、
ユーザー要望により **自動判別・自動検索UI** に全面改修済み（2026-07-07）。

### 現在のタブ構成（3タブ）

| タブ | 挙動 |
|---|---|
| **テキスト（自動判別）** | 1つの入力欄に文字列を入れると DOI / PMID / タイトルを自動判別し、**Enterなしで自動検索**（デバウンス: ID系400ms/タイトル800ms）。誤認識は種類チップ（自動判別/DOI/PMID/タイトル）で強制指定でき、**Enterで即実行**。引用文字列に埋め込まれたDOI/PMIDも検出（外れたらタイトル検索へ自動フォールバック）。オフライン推定整形へのリンクあり |
| **PDF** | 選択と同時に解析。DOI検出→即取得。DOIが無い/外れたら**1ページ目の最大フォント行からタイトル推定**→自動検索。推定タイトルは編集欄で修正して再検索可能 |
| **画像OCR** | 選択と同時に tesseract.js でOCR→**タイトル優先で自動検索**（OCRはDOIの文字誤読が多いため。実測でも Ioannidis→loannidis と誤読）→見つからなければ検出DOIでフォールバック。OCRテキストは編集可能で、編集すると自動再検索。「このDOI/PMIDで取得」「推定で整形」ボタンも併設 |

### ドラッグ&ドロップ / 貼り付け（どのタブでも）

- **ページ全体がドロップ受付**（`InputPanel.jsx` の window リスナー）。ドラッグ中は点線オーバーレイ表示。
- PDFをドロップ → PDFタブへ自動切替して即解析。画像をドロップ → 画像OCRタブへ自動切替して即OCR。
- テキスト欄への**画像貼り付け（Cmd+V のスクリーンショット等）**も同様にOCRフローへ。
- 非対応ファイル（.txt等）はエラーメッセージのみ・タブ移動なし。
- ファイル以外のドラッグ（テキスト選択等）は素通し（`types` に `Files` を含む場合のみ介入）。
- 受け渡しは `{file, kind, token}` で、各タブ側は token を見て**1回だけ**処理（StrictMode二重実行対策）。
- 処理中（busy）のドロップは無視。ロジックは既存の processFile / processImage をそのまま呼ぶ（複製なし）。

### ブラウザ実機で確認済み（2026-07-07の改修後）

- DOI貼付→750msで自動取得（チップに検出ハイライト表示）
- PMID `32678530` →自動取得
- タイトル→候補リスト→選択→PubMed補完（MEDLINE略名・PMID）
- 引用文字列（DOI埋め込み）→DOI優先で自動取得
- DOI文字列を「タイトル」チップで強制検索→候補6件（誤認識修正の動作確認）
- DOIチップ+Enterで即実行
- PDF→DOI検出→自動取得、推定タイトル欄に正確なタイトル表示
- 画像OCR→3秒でOCR→タイトル自動検索→候補8件→選択→完全な結果
- PDFドロップ→PDFタブ自動切替→800msで取得（テキストタブから）
- 画像ドロップ→画像OCRタブ自動切替→OCR→候補表示
- 画像貼り付け（onPaste）→OCRフローへルーティング→候補表示
- .txtドロップ→エラー表示のみ・タブ移動なし
- ドラッグ中オーバーレイの表示/非表示
- `npm run build` エラー0
- 整形ロジック（単著/団体著者は et al. なし、`?`末尾のピリオド重複なし等）は初期版から不変・検証済み

### ユニットテスト（手動実行スクリプト）

- 判別ロジック: 14ケース全合格（`node /tmp/detecttest.mjs` 相当。リポジトリ未保存 — `src/lib/detect.js` の `detectInput` に対して DOI/URL/doi:接頭辞/PMID/埋め込み/空文字 などを検証した）

---

## 3. 別の Mac で再開する手順

このフォルダは Dropbox 配下（`~/Dropbox/ClaudeCode/citecorner`）なので、ファイル自体は同期される。
ただし **`node_modules` は入れ直すのが安全**。

```bash
cd ~/Dropbox/ClaudeCode/citecorner
rm -rf node_modules
npm install
npm run dev        # http://localhost:5173 （PORT環境変数があればそちらを使用）
npm run build      # 本番ビルド → dist/
```

- 推奨環境: Node 18+（開発時は Node v25.9.0 / npm 11.12.1）
- **Git**: 初期化済み（`1ef2e6c Initial commit: CiteCorner`）。
  スマート入力UIへの改修分は**未コミット**（2026-07-07時点）。再開時に `git status` で確認を。

---

## 4. ファイル構成と役割

```
citecorner/
├── index.html                      # エントリHTML
├── vite.config.js                  # ★/api/ncbi devプロキシ + PORT環境変数対応
├── package.json / package-lock.json
├── .gitignore / README.md / PROGRESS.md
├── .claude/launch.json             # プレビュー用（autoPort対応・開発補助）
├── functions/
│   └── api/ncbi/[[path]].js        # ★Cloudflare Pages Function: eutils中継プロキシ
└── src/
    ├── main.jsx / App.jsx          # ★App: 状態管理・run()・リセット制御
    ├── index.css                   # 全スタイル（チップ・インライン状態表示含む）
    ├── components/
    │   ├── Header.jsx              # ヘッダー（children=リセットボタン）
    │   ├── InputPanel.jsx          # 3タブ切替（テキスト/PDF/画像OCR）
    │   ├── SmartInput.jsx          # ★自動判別+自動検索+種類チップ+Enter即実行
    │   ├── PdfInput.jsx            # PDF解析→DOI即取得/タイトル推定検索（編集可）
    │   ├── ImageInput.jsx          # OCR→タイトル優先自動検索→DOIフォールバック
    │   ├── CandidateList.jsx       # 候補の表示・選択
    │   ├── CopyButton.jsx          # コピー+「コピーしました」
    │   └── ResultCard.jsx          # 取得情報 + 出力5種
    └── lib/
        ├── api.js                  # ★CrossRef直/eutils同一オリジン・正規化・enrich
        ├── detect.js               # ★入力種類の自動判別 + OCR塊からのタイトル抽出
        ├── format.js               # ★引用整形（純粋関数）
        ├── pdf.js                  # pdf.js抽出・DOI検出・タイトル推定（ドロップキャップ対応）
        ├── parse.js                # 自由テキストの推定パース
        └── ocr.js                  # tesseract.js ラッパ（動的import）
```

旧 `DoiInput.jsx` / `PmidInput.jsx` / `TitleInput.jsx` / `ImageTextInput.jsx` は削除済み（SmartInput/ImageInputに置換）。

---

## 5. アーキテクチャ・重要な技術的決定

### 5-1. データ取得経路（初期版から不変）
- **CrossRef** は CORS対応 → ブラウザから直接。
- **NCBI eutils** は常に同一オリジン `/api/ncbi/...`（dev=Viteプロキシ / prod=Pages Function）。
- DOI取得時は esearch→esummary で enrich し、**雑誌略名は MEDLINE 優先**・PMID補完。

### 5-2. 自動判別ルール（`src/lib/detect.js` の `detectInput`）
1. 4〜9桁の純数字 → PMID（1〜3桁は誤爆防止で自動発火させない）
2. `PMID: 123...` 明示形 → PMID
3. DOI正規表現（素のDOI / doi.org URL / doi:接頭辞 / 引用文字列埋め込み）→ DOI。
   埋め込み時は `embedded: true` を付け、**取得失敗時にタイトル検索へ自動フォールバック**
4. 引用文字列中の `PMID: n` → PMID（embedded）
5. それ以外 → タイトル

### 5-3. 自動検索（SmartInput / ImageInput 共通パターン）
- デバウンス: DOI/PMID 400ms、タイトル 800ms、OCRテキスト 900ms
- タイトルの自動発火は **12文字以上**（入力途中の無駄打ち防止）
- **通し番号（seqRef）** で古い応答を破棄（入力が変わるたび無効化）
- **lastKey** で同一クエリの再実行を抑止（成功時のみ記録、失敗時はクリアして再試行可能に）
- Enter=強制即実行（IME変換中の Enter は `isComposing` で無視、Shift+Enter=改行）
- 自動検索の状態はカード内のインライン表示（グローバルスピナーは候補選択など明示操作用）

### 5-4. OCRは「タイトル優先・DOIフォールバック」（ユーザー指定 + 実測根拠）
OCRは `I`→`l` 等の誤読が多く、DOIは1文字違いで解決不能になる。
タイトルは CrossRef `query.bibliographic` が誤読に頑健。実測でも「loannidis」誤読下で正解候補を取得できた。
検出DOI/PMIDは「このIDで取得」ボタンとして常時併設（手動ショートカット）。

### 5-5. PDFタイトル推定（`src/lib/pdf.js`）
- 1ページ目上部の**最大フォント行**を基本としつつ:
  - **ドロップキャップ対策**: 行内で最大フォント文字が占める割合 < 0.5 の行は除外
    （PLoS実PDFで「Pevidence, with ensuing confusion」誤抽出→修正済み）
  - 最大サイズで単語数<3なら次に大きいサイズへ**最大4段階フォールバック**
  - 記事種別ラベル（Original Article / Essay / Review 等）は除外
- PDFメタデータTitleは「3語以上・ファイル名らしくない」場合のみ採用
  （`PLME0208_696-701.indd` のようなゴミを排除）

### 5-6. その他
- tesseract.js は動的import（初期表示軽量）。英語traineddataは初回にCDN取得。
- pdfjs-dist のワーカーは `?worker` で実ワーカー化（fake worker回避）。
- リセットは `key` 再マウント方式。結果表示中のみ確認ダイアログ。
- `public/` に余計なものを置かない（Vite が dist 直下へコピーするため）。現在 public/ は無し。
- `.claude/launch.json` は autoPort 対応、`vite.config.js` は PORT 環境変数を読む
  （ポート5173が他プロセスに使われていても開発サーバーが起動できる）。

---

## 6. 重要な決定事項（ユーザー判断）

| 日付 | 項目 | 決定 |
|---|---|---|
| 2026-05-30 | eutils `tool=`/`email=`・CrossRef `mailto` | **ダミーのまま**（`citecorner@example.com`）。本番前に `src/lib/api.js` の `TOOL`/`EMAIL`/`MAILTO` を差し替え |
| 2026-05-30 | ヘッダー右 | リセットボタン（結果表示時のみ確認） |
| 2026-07-07 | 入力UX | **自動判別・Enterなし自動検索**に全面改修。誤認識は種類チップ+Enterで修正可能に。表示方法（候補→選択）は維持 |
| 2026-07-07 | OCRの検索戦略 | **タイトル優先、DOIはフォールバック**（ユーザー指定） |
| 2026-07-07 | ファイル入力 | **トップページで完結**: PDF/画像はページ全体へのドラッグ&ドロップ・貼り付けで自動判別（該当タブへ自動切替）。タブのファイル選択はスマホ用に残す |

---

## 7. 残りのタスク / 未完了 / 既知の制限

### 本番化の前にやること
- [ ] **連絡先の差し替え**: `src/lib/api.js` の `TOOL` / `EMAIL` / `MAILTO`（現在ダミー）
- [ ] **Cloudflare Pages への実デプロイ**（ビルド確認のみ。未デプロイ）
- [ ] **改修分のコミット**（スマート入力UI改修は未コミット）

### 任意の改善余地
- [ ] 自動テスト未整備（`detect.js`/`format.js`/`parse.js` は純粋関数でテスト容易）
- [ ] CrossRef のタイトル検索は入力が滅茶苦茶でも「何かしら候補を返す」ため、
      画像OCRのDOIフォールバック（候補0件時）は実際にはほぼ発火しない。
      wrong候補が並んだ場合の救済は「このDOIで取得」ボタンが担う設計
- [ ] pdf.worker チャンク500KB超の警告（動作影響なし）
- [ ] タイトル自動検索は入力停止ごとに CrossRef を1回叩く（デバウンス済みだが、
      さらに絞るなら最小語数条件などを追加可能）

---

## 8. Cloudflare Pages デプロイ手順

| 設定項目 | 値 |
|---|---|
| Build command | `npm run build` |
| Build output directory | `dist` |
| Functions | `functions/` を自動検出（設定不要） |
| 環境変数 / シークレット | **不要** |

---

## 9. 動作確認に使える鉄板サンプル

```
DOI : 10.1056/NEJMoa2021436   (団体著者 → et al. なし確認)
DOI : 10.1371/journal.pmed.0020124  (単著 → et al. なし確認)
PMID: 32678530 / 16060722
タイトル: Global cancer statistics 2020 GLOBOCAN estimates of incidence and mortality
引用文字列(DOI埋め込み):
  RECOVERY Collaborative Group. Dexamethasone in Hospitalized Patients with Covid-19. N Engl J Med. 2021;384(8):693-704. doi:10.1056/NEJMoa2021436
テスト用PDF: PLoS Med の Ioannidis 2005 (printable版にDOI記載あり、タイトル推定の検証にも使える)
  https://journals.plos.org/plosmedicine/article/file?id=10.1371/journal.pmed.0020124&type=printable
```
