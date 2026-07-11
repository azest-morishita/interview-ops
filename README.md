# InterviewOps

InterviewOpsは、エンジニア・ITコンサル向けのAI模擬面接アプリです。

面接準備を、回答して終わりではなく、継続的に改善するInterview Pipelineとして扱います。

```text
AI面接官を設計 → 理想回答を登録 → 模擬面接 → AI分析 → 差分確認 → 改善 → 再挑戦
```

DevOps × AI Agent Hackathon向けのMVPとして、AIエージェントによる質問生成・回答評価・改善Issue化までを1つの体験にまとめています。

## 主な機能

- エンジニア / ITコンサルの2モード切り替え
- 3ステップの面接準備フロー
  1. AI面接官を設定
  2. 理想回答を登録
  3. 模擬面接する
- AIによる面接官設定の自動作成
  - 面接官タイプ
  - 難易度
  - 重点評価観点
- 求人票PDF / TXTのAI解析
  - 職種の判定
  - 想定ポジションの抽出
  - 面接官タイプの提案
  - 重点評価観点の抽出
- AIによる面接準備の下書き作成
  - 想定企業・ポジション
  - 求人票・募集要項
  - 自分の経験概要
  - 練習質問
  - 理想回答
- AI面接官による質問生成
- 音声入力またはテキスト入力での回答
- 回答のAI分析
  - 総合スコア
  - 評価観点ごとのスコア
  - 理想回答との差分
  - 改善Issue
  - 添削後の回答
  - 60秒版の回答
- Attemptログによる改善履歴の確認
- Agent Traceによる処理フローの可視化
- Cloud Runデプロイを想定した構成

## AI機能とGemini API

このアプリのAI生成・AI分析はGemini APIを使用します。

| ボタン / 機能 | 内部API | Gemini APIの利用 |
| --- | --- | --- |
| 求人票PDF / TXTをアップロード | `/api/prep-draft` | 求人票から職種・面接官タイプ・評価観点・理想回答を生成 |
| 面接官設定をAIで作る | `/api/prep-draft` | 面接官タイプ・難易度・重点評価観点を生成 |
| 面接準備をAIで入力 | `/api/prep-draft` | 求人票・経験概要・質問・理想回答を生成 |
| AI面接官を開始 | `/api/question` | 面接官として質問を生成 |
| 回答をAI分析する | `/api/analyze` | 回答評価、差分、改善Issue、添削案を生成 |

`GEMINI_API_KEY` が未設定、またはGemini API呼び出しに失敗した場合は、UI確認用のデモ回答にフォールバックします。

画面上部の `Runtime` は現在の実行状態を表します。

- `Gemini`: Gemini APIで生成・分析できています
- `Demo`: APIキー未設定、またはAPIエラーによりデモ用フォールバックで動いています
- `Ready`: まだAI処理を実行していません

## 技術スタック

- Next.js
- React
- TypeScript
- Gemini API
- Web Speech API
- Cloud Run
- GitHub Actions

## ローカルでの起動方法

```bash
npm install
cp .env.example .env
npm run dev
```

起動後、ブラウザで以下を開きます。

```text
http://localhost:3000
```

音声入力はブラウザの仕様上、`localhost` またはHTTPS環境でのみ利用できます。

そのため、以下のようなLAN内のHTTPアドレスでは録音できない場合があります。

```text
http://192.168.x.x:3000
```

音声入力を試す場合は、まず `http://localhost:3000` で開いてください。

求人票ファイルのアップロードはPDF / TXTに対応しています。
PDFはGemini APIへインラインデータとして渡して解析します。
大きいPDFは通信量が増えるため、8MB以下を目安にしてください。

## 環境変数

`.env.example` は設定項目の見本です。APIキーなどの秘密情報は入れません。

実際にローカルで動かすときは、`.env.example` をコピーして `.env` を作成し、そこに自分のAPIキーを設定します。

| 変数名 | 説明 |
| --- | --- |
| `GEMINI_API_KEY` | Gemini APIキー |
| `GEMINI_MODEL` | 使用するGeminiモデル名。未設定時は `gemini-3.5-flash` |

例:

```env
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-3.5-flash
```

`.env` はGit管理に含めないでください。APIキーをGitHubに公開しないためです。

## ビルド

```bash
npm run build
```

## Cloud Runへのデプロイ例

Cloud Runにデプロイする場合は、環境変数としてGemini APIキーとモデル名を設定します。

```bash
gcloud run deploy interview-ops \
  --source . \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=YOUR_KEY,GEMINI_MODEL=gemini-3.5-flash
```

## 注意事項

InterviewOpsは面接練習と回答改善のための支援ツールです。

AIのフィードバックは参考情報であり、採用可否や合格を保証するものではありません。
