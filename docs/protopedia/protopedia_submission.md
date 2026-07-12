# ProtoPedia投稿用テキスト

## 作品ステータス

完成

## 作品タイトル

InterviewOps - 模擬面接をCI/CDするAI面接官エージェント

## 作品のURL

https://interview-ops-5zwizexmva-an.a.run.app

## 概要

面接官設定、理想回答登録、模擬面接、AI分析をつなぎ、面接回答を継続改善するAIエージェント。

## 画像

推奨アップロード:

- `docs/protopedia/assets/interview-ops-main.png`
- `docs/protopedia/assets/interview-ops-architecture.png`

## 動画

YouTubeまたはVimeoへアップロードしたデモ動画URLを入力してください。

動画URL未作成の場合は、下の「デモ動画台本」を使って2〜3分程度で録画するのがおすすめです。

## システム構成

画像アップロード:

- `docs/protopedia/assets/interview-ops-architecture.png`

Markdown欄に貼る説明:

```markdown
InterviewOpsは、Next.js / Cloud Run / Firebase / Gemini APIで構成したAI模擬面接アプリです。

### 全体構成

1. ユーザーはCloud Run上のNext.jsアプリへアクセスします。
2. Firebase Authenticationでメールアドレス / パスワードログインを行います。
3. Next.js API RouteがFirebase IDトークンを検証し、許可メールアドレスのみ利用できます。
4. 会社別対策、面接官設定、複数の質問・理想回答、AttemptログはCloud Firestoreへ保存します。
5. 求人票解析、面接準備の下書き、回答分析はGemini APIで実行します。
6. AI面接官アバターの表示、質問読み上げ、音声入力はブラウザのWeb Speech API / Speech Synthesis APIを使います。

### 保存データ

- users/{uid}/companies/{companyId}
- users/{uid}/companies/{companyId}/attempts/{attemptId}

### セキュリティ

- Firebase Authでログイン必須
- ALLOWED_EMAILSに含まれるメールアドレスのみ利用可能
- Gemini APIキーとFirebase Admin SDK秘密鍵はCloud Run環境変数で管理
- Firestoreはクライアント直接アクセスを拒否し、Next.js API Route経由で操作
```

## 開発素材

入力候補:

```text
Next.js, React, TypeScript, Google Cloud Run, Gemini API, Firebase Authentication, Cloud Firestore, Firebase Admin SDK, Web Speech API, Web Speech Synthesis API, Docker, GitHub
```

## タグ

必須タグ:

```text
findy_hackathon
```

追加候補:

```text
AIエージェント, Gemini API, Google Cloud, Cloud Run, Firebase, 面接対策, DevOps, Next.js
```

## ストーリー

```markdown
## 解決したい課題と背景

面接対策は、単発の壁打ちや模範回答の暗記で終わりがちです。
しかし実際の面接では、質問の意図を読み取り、自分の経験を構造化し、評価観点に沿って具体的に話す必要があります。

特にエンジニアやITコンサルの面接では、単に「何をしたか」だけではなく、技術選定理由、課題設定、合意形成、定量成果、再現性まで問われます。
そこでInterviewOpsでは、面接準備を一度きりの練習ではなく、回答を継続的に改善するInterview Pipelineとして設計しました。

## 想定ユーザー

- エンジニア転職の面接対策をしたい人
- ITコンサル転職のケース面接・経験面接を練習したい人
- 求人票に合わせて回答を磨き込みたい人
- 自分の回答と理想回答の差分を客観的に把握したい人
- 面接練習の履歴を会社別に残して改善したい人

## プロダクトの特徴

### 1. 会社別に面接対策を保存できる

企業名・ポジション・求人票・面接官設定・複数の質問・理想回答を会社別に保存できます。
一度作った対策は後から編集でき、同じ会社の面接練習を継続できます。

### 2. AI面接官を設計できる

職種、面接官タイプ、難易度、重点評価観点を設定できます。
求人票PDF / TXTをアップロードすると、Gemini APIが面接官設定や質問、理想回答の下書きを作成します。

### 3. 複数質問を連続で模擬面接できる

面接対策したい項目を複数登録し、順番通りまたは順不同で出題できます。
「質問 → 回答 → AI分析 → 次の質問」という流れで、本番に近い面接練習ができます。

### 4. 回答をAIが多面的に分析する

Gemini APIを使い、回答を総合スコア、評価観点別スコア、理想回答との差分、改善Issue、添削後回答、60秒版回答に分解します。
単なる感想ではなく、次に何を改善すべきかが具体的に分かります。

### 5. DevOps的に回答改善を回せる

InterviewOpsは「面接回答をCI/CDする」ことをテーマにしています。
会社別対策を登録し、模擬面接を実行し、AI分析結果をAttemptログとして保存し、次の回答改善につなげます。

## 技術的なこだわり

- Next.js App RouterでUIとAPI Routeを一体構成
- Cloud RunへDockerデプロイ
- Firebase Authenticationでログイン必須化
- サーバー側でFirebase IDトークンと許可メールアドレスを検証
- Cloud Firestoreに会社別対策とAttemptログを保存
- Gemini APIで求人票解析、面接準備下書き、回答分析を実行
- Web Speech APIで音声回答
- Speech Synthesis APIでAI面接官の読み上げ
- Cloud Run環境変数でAPIキー・秘密鍵を管理し、GitHubへ秘密情報を置かない設計

## 今後の展望

- 企業ごとの質問テンプレート自動生成
- 職務経歴書PDFの読み込み
- 面接官ペルソナの保存
- 回答スコア推移のグラフ化
- チームやメンターによるレビュー機能
```

## 関連リンク

```text
https://github.com/azest-morishita/interview-ops
https://interview-ops-5zwizexmva-an.a.run.app
```

## メンバー登録

表示名:

```text
t mori @tomori25
```

役割候補:

```text
企画 / 開発 / デプロイ
```

## デモ動画台本

```markdown
# InterviewOps デモ動画台本（2〜3分）

## 0:00 - 0:15 作品紹介

InterviewOpsは、エンジニア・ITコンサル向けに、面接回答を継続改善するAI面接官エージェントです。
面接官設定、理想回答登録、模擬面接、AI分析、改善ログ保存までを一つの流れで行えます。

## 0:15 - 0:35 ログインとトップ画面

Firebase Authenticationでログインします。
ログイン後は、最初に「登録」か「模擬面接」を選びます。
初めて使う場合は登録から始めます。

## 0:35 - 1:10 STEP1 AI面接官設定

エンジニアまたはITコンサルを選び、面接官タイプ、難易度、重点評価観点を設定します。
求人票PDFやTXTをアップロードすると、Gemini APIが求人票を解析し、面接官設定や質問案を作成します。

## 1:10 - 1:40 STEP2 面接対策項目登録

想定ポジション、求人票、自分の経験概要を入力します。
さらに、技術課題、技術選定理由、チーム開発など、複数の面接対策項目を登録できます。
それぞれの質問と理想回答を保存します。

## 1:40 - 2:20 STEP4 模擬面接

保存した対策を使い、AI面接官が質問します。
質問は順番通り、または順不同で出題できます。
ユーザーは音声またはテキストで回答します。

## 2:20 - 2:50 AI分析

回答をAI分析すると、総合スコア、評価観点別スコア、理想回答との差分、改善Issue、添削後の回答が表示されます。
次の質問へ進むことで、登録した質問セットを連続で練習できます。

## 2:50 - 3:00 まとめ

InterviewOpsは、面接準備を単発の練習で終わらせず、会社別に保存し、回答を継続的に改善するためのInterview Pipelineです。
```
