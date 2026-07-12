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
- 登録 / 模擬面接を分けた利用導線
- 4ステップのInterview Pipeline
  1. AI面接官を設定
  2. 面接対策項目・理想回答を登録
  3. 保存済みの会社別対策を選択・編集
  4. AI面接官と模擬面接
- 会社別対策の保存
  - 企業名・対策名
  - 面接官設定
  - 求人票
  - 複数の面接対策項目
  - 質問ごとの理想回答
  - 模擬面接ログ
- 複数質問の模擬面接
  - 順番通りに出題
  - 順不同で出題
  - 質問 → 回答 → AI分析 → 次の質問、の連続練習
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
- AI面接官による登録質問の出題
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

## 使い方

InterviewOpsは、最初に `登録` と `模擬面接` のどちらを行うかを選ぶ構成です。

```text
ログイン
↓
登録 または 模擬面接 を選択
↓
登録済みの会社別対策を使ってAI模擬面接
```

### 1. ログイン

Firebase Authenticationで事前作成されたメールアドレス / パスワードでログインします。

新規登録機能はありません。利用できるアカウントは、サーバー側の `ALLOWED_EMAILS` に含まれるメールアドレスだけです。

### 2. 新しく面接対策を登録する

トップ画面で `登録` を選びます。

登録フローは2ステップです。

#### STEP1: AI面接官を設定

ここでは、どのような面接官にするかを決めます。

- エンジニア / ITコンサルの職種モード
- AI面接官のタイプ
- 難易度
- 重点評価観点
- 求人票PDF / TXTからのAI解析
- AIによる面接官設定の自動作成

求人票ファイルをアップロードすると、AIが職種、想定ポジション、面接官タイプ、評価観点、質問、理想回答の下書きを作成します。

#### STEP2: 面接対策項目と理想回答を登録

ここでは、実際に練習したい質問セットを登録します。

- 想定企業・ポジション
- 求人票・募集要項
- 自分の経験概要
- 面接対策したい項目
- 各項目の質問
- 各項目の理想回答

面接対策項目は複数登録できます。

例:

- 技術課題の深掘り
- 技術選定理由
- チーム開発・DevOps
- 合意形成
- 課題設定・仮説思考
- ビジネスインパクト

入力後、`模擬面接で使うために登録` を押すとFirestoreに保存されます。
保存が完了すると、ボタンが `模擬面接へ進む` に変わります。

### 3. 登録済みの会社別対策で模擬面接する

トップ画面で `模擬面接` を選びます。

#### STEP3: 対策内容を選ぶ

保存済みの会社別対策から、今回使う面接対策を選択します。

選択すると、登録済みの内容が表示されます。
この画面でも以下を編集して更新できます。

- 企業名・対策名
- 想定ポジション
- 面接官タイプ
- 難易度
- 評価観点
- 求人票
- 経験概要
- 複数の面接対策項目
- 各項目の質問・理想回答

編集した場合は `この内容で更新保存` を押してから、`STEP4 模擬面接へ` に進みます。

#### STEP4: AI面接官と模擬面接する

登録した面接対策項目をもとに、AI面接官が1問ずつ質問します。

出題順は切り替えできます。

- `順番`: 登録した順番で質問
- `順不同`: 登録した質問をランダム順で出題

1問ごとの流れは以下です。

```text
AI面接官が質問
↓
音声またはテキストで回答
↓
回答をAI分析
↓
スコア・差分・改善Issue・添削回答を確認
↓
次の質問へ
```

登録した質問をすべて終えると、改善ログに各Attemptが残ります。

### 4. 改善ログを確認する

回答をAI分析すると、Attemptログが保存されます。

Attemptログでは以下を確認できます。

- どの面接項目に回答したか
- 質問文
- スコア
- 総評
- 作成時刻

会社別対策ごとにログが残るため、同じ企業・同じポジションに対して回答を改善していく流れを確認できます。

## 審査員向けの確認手順

1. デプロイURLを開く
2. 事前共有された審査員用メールアドレス / パスワードでログイン
3. `登録` から新規の面接対策を作成
4. STEP1でAI面接官を設定
5. STEP2で複数の面接対策項目を登録
6. 保存後、`模擬面接へ進む`
7. STEP4でAI面接官の質問に回答
8. `回答をAI分析する` を押して結果を確認
9. `次の質問へ` で複数質問の連続模擬面接を確認

すでに登録済みの会社別対策がある場合は、トップ画面の `模擬面接` から直接確認できます。

## AI機能とGemini API

このアプリのAI生成・AI分析はGemini APIを使用します。

| ボタン / 機能 | 内部API | Gemini APIの利用 |
| --- | --- | --- |
| 求人票PDF / TXTをアップロード | `/api/prep-draft` | 求人票から職種・面接官タイプ・評価観点・理想回答を生成 |
| 面接官設定をAIで作る | `/api/prep-draft` | 面接官タイプ・難易度・重点評価観点を生成 |
| 面接準備をAIで入力 | `/api/prep-draft` | 求人票・経験概要・質問・理想回答を生成 |
| AI面接官を開始 | 画面内の登録済み質問セット | 登録した質問をAI面接官アバターが出題 |
| 回答をAI分析する | `/api/analyze` | 回答評価、差分、改善Issue、添削案を生成 |

`GEMINI_API_KEY` が未設定、またはGemini API呼び出しに失敗した場合は、UI確認用のデモ回答にフォールバックします。

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
4. Cloud Runなど本番URLのドメインをAuthenticationの承認済みドメインに追加
5. Cloud Firestoreを作成
6. Firebase Admin SDK用のサービスアカウントキーを発行し、`FIREBASE_CLIENT_EMAIL` と `FIREBASE_PRIVATE_KEY` に設定
7. Firestore Rulesをデプロイ

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
