# InterviewOps テスト資料

求人票アップロード機能の動作確認用サンプルです。

## ファイル構成

| ファイル | 用途 |
| --- | --- |
| `job-descriptions/engineer-job-description.txt` | エンジニア求人票のTXTサンプル |
| `job-descriptions/engineer-job-description.pdf` | エンジニア求人票のPDFサンプル |
| `job-descriptions/consultant-job-description.txt` | ITコンサル求人票のTXTサンプル |
| `job-descriptions/consultant-job-description.pdf` | ITコンサル求人票のPDFサンプル |

## PDFについて

PDFには以下を含めています。

- 表示用の求人票本文
- AIやPDF抽出器が読み取りやすい透明テキスト層
- Title / Subject / Author / Keywords の基本メタデータ

そのため、InterviewOpsの求人票アップロード機能で、職種、面接官タイプ、重点評価観点、練習質問、理想回答の下書き生成を試す用途に向いています。
