# InterviewOps

InterviewOpsは、エンジニア・ITコンサル向けのAI模擬面接アプリです。

面接準備を、回答して終わりではなく、継続的に改善するInterview Pipelineとして扱います。

```text
AI面接官を設計 → 理想回答を登録 → 模擬面接 → AI分析 → 差分確認 → 改善 → 再挑戦
```

DevOps × AI Agent Hackathon向けのMVPとして、AIエージェントによる質問生成・回答評価・改善Issue化までを1つの体験にまとめています。

## 主な機能

- エンジニア / ITコンサルの2モード切り替え
- Firebase Authenticationによるログイン必須化
- 許可メールアドレスのみ利用できるアクセス制限
- 3ステップの面接準備フロー
  1. AI面接官を設定
  2. 理想回答を登録
  3. 模擬面接する
- 会社別対策の保存
  - 企業名・対策名
  - 面接官設定
  - 求人票
  - 理想回答
  - 模擬面接ログ
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
- AI面接官アバターによる質問表示
- ブラウザText-to-Speechによる質問読み上げ
- 読み上げ中の口パク風アニメーション
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
- Web Speech Synthesis API
- Firebase Authentication
- Cloud Firestore
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

AI面接官の質問読み上げは、ブラウザ標準のText-to-Speech機能を使います。
Chrome / Edge / Safariなど、`speechSynthesis` に対応したブラウザで利用できます。
ブラウザの自動再生制限で自動読み上げが始まらない場合は、画面上の「質問を読み上げる」ボタンを押してください。

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
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase WebアプリのAPIキー |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth Domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase Project ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase Web App ID |
| `FIREBASE_PROJECT_ID` | Firebase Admin SDK用Project ID |
| `FIREBASE_CLIENT_EMAIL` | Firebase Admin SDK用Client Email |
| `FIREBASE_PRIVATE_KEY` | Firebase Admin SDK用Private Key |
| `ALLOWED_EMAILS` | InterviewOpsの利用を許可するメールアドレス。カンマ区切り |

例:

```env
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-3.5-flash
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_web_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_web_app_id
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"
ALLOWED_EMAILS=owner@example.com,judge@example.com
```

`.env` はGit管理に含めないでください。APIキーをGitHubに公開しないためです。

## 認証と保存

InterviewOpsはFirebase Authenticationのメールアドレス / パスワードログインを前提にしています。
新規登録画面は用意していないため、利用者アカウントはFirebase Consoleで事前作成してください。

さらに、サーバー側APIではFirebase IDトークンを検証し、`ALLOWED_EMAILS` に含まれるメールアドレスだけを許可します。
そのため、画面を経由せず `/api/analyze` や `/api/question` を直接呼び出しても、未ログイン・未許可メールではGemini APIを実行できません。
また、アプリ起動時にも `/api/session` で許可メールかどうかを検証するため、`ALLOWED_EMAILS` に含まれないアカウントではInterviewOps本体画面を開けません。

会社別対策はCloud Firestoreに以下のような構造で保存します。

```text
users/{uid}/companies/{companyId}
users/{uid}/companies/{companyId}/attempts/{attemptId}
```

Firestoreはクライアントから直接読み書きせず、Next.js API RouteからFirebase Admin SDK経由でアクセスします。
`firestore.rules` は安全側に倒し、クライアント直接アクセスを拒否しています。

### Firebase Consoleで必要な設定

1. Firebase Authenticationで「メール/パスワード」を有効化
2. 利用者アカウントを事前作成
   - 自分用アカウント
   - 審査員用アカウント
3. 作成したメールアドレスを `ALLOWED_EMAILS` に設定
4. Cloud Firestoreを作成
5. Firebase Admin SDK用のサービスアカウントキーを発行し、`FIREBASE_CLIENT_EMAIL` と `FIREBASE_PRIVATE_KEY` に設定
6. Firestore Rulesをデプロイ

```bash
npx -y firebase-tools@latest deploy --only firestore:rules
```

## ビルド

```bash
npm run build
```

## Cloud Runへのデプロイ例

Cloud Runにデプロイする場合は、環境変数としてGemini APIキーとモデル名を設定します。
Firebaseの秘密鍵やカンマ区切りの `ALLOWED_EMAILS` を扱うため、`--set-env-vars` より `--env-vars-file` の利用を推奨します。

例: `.cloudrun.env.yaml`

```yaml
GEMINI_API_KEY: "YOUR_KEY"
GEMINI_MODEL: "gemini-3.5-flash"
NEXT_PUBLIC_FIREBASE_API_KEY: "YOUR_FIREBASE_WEB_API_KEY"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "YOUR_PROJECT.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID: "YOUR_PROJECT_ID"
NEXT_PUBLIC_FIREBASE_APP_ID: "YOUR_FIREBASE_WEB_APP_ID"
FIREBASE_PROJECT_ID: "YOUR_PROJECT_ID"
FIREBASE_CLIENT_EMAIL: "YOUR_SERVICE_ACCOUNT_EMAIL"
FIREBASE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"
ALLOWED_EMAILS: "owner@example.com,judge@example.com"
```

```bash
gcloud run deploy interview-ops \
  --source . \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --env-vars-file .cloudrun.env.yaml
```

## 注意事項

InterviewOpsは面接練習と回答改善のための支援ツールです。

AIのフィードバックは参考情報であり、採用可否や合格を保証するものではありません。
