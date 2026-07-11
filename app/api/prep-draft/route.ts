import { NextResponse } from "next/server";
import type { InterviewInput, PrepDraft, UploadedJobDocument } from "../../types";

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

type PrepDraftRequest = InterviewInput & {
  sourceDocument?: UploadedJobDocument;
};

type GeminiPart =
  | { text: string }
  | {
      inline_data: {
        mime_type: string;
        data: string;
      };
    };

function hasSupportedDocument(document?: UploadedJobDocument) {
  return (
    document?.mimeType === "application/pdf" ||
    document?.mimeType === "text/plain"
  );
}

function fallbackDraft(input: InterviewInput): PrepDraft {
  const isEngineer = input.role === "engineer";

  if (isEngineer) {
    return {
      role: "engineer",
      interviewerStyle:
        input.interviewerStyle ||
        "深掘り重視。候補者の技術選定理由、設計判断、障害対応、成果指標を具体的に確認する面接官。",
      difficulty: input.difficulty || "通常面接より少し厳しめ",
      evaluationFocus:
        input.evaluationFocus || "技術選定理由、設計判断、障害対応、DevOps理解、成果指標、自分の役割",
      targetPosition: input.targetPosition || "SaaS企業のWebアプリケーションエンジニア",
      jobDescription:
        "BtoB SaaSの開発チームで、Webアプリケーションの機能開発、API設計、パフォーマンス改善、CI/CD改善、障害対応を担当するポジション。技術選定の理由を説明し、チームで品質を高めながら継続的に改善できることが求められる。",
      experience:
        "バックエンド中心に3年経験。Node.jsとReactで業務管理システムを開発。APIレスポンス改善、ログ調査、CIの安定化、チームレビューを経験している。",
      question: "これまで最も難しかった技術課題と、その解決方法を教えてください。",
      idealAnswer:
        "最も難しかった課題は、主要APIのレスポンスが遅く、ユーザーの作業待ち時間が長くなっていたことです。私はまずアプリケーションログとDBクエリログを確認し、特定画面で不要な同期処理と重いクエリが発生していることを特定しました。改善策としてキャッシュ、クエリ改善、処理分割を比較し、影響範囲と運用リスクを踏まえて、クエリ見直しと一部処理の非同期化を選びました。実装後はチームでレビューし、CIで既存処理への影響を確認しました。結果としてレスポンスが改善し、問い合わせも減りました。この経験から、技術課題は感覚ではなくログで原因を絞り、運用まで含めて改善することが重要だと学びました。"
    };
  }

  return {
    role: "consultant",
    interviewerStyle:
      input.interviewerStyle ||
      "論理構成とビジネスインパクトを重視し、課題設定と合意形成を深掘りするITコンサル面接官。",
    difficulty: input.difficulty || "ケース面接寄りに少し厳しめ",
    evaluationFocus:
      input.evaluationFocus || "課題設定、仮説思考、ステークホルダー調整、業務理解、ROI、プロジェクト推進力",
    targetPosition: input.targetPosition || "製造業向けDXプロジェクトのITコンサルタント",
    jobDescription:
      "クライアントの業務課題を整理し、システム化構想、要件定義、関係者調整、導入計画策定をリードするポジション。業務理解、課題設定、仮説検証、ステークホルダー調整、ビジネスインパクトの説明力が求められる。",
    experience:
      "SIerで要件定義とPM補佐を4年経験。販売管理システム刷新プロジェクトで業務フロー整理、部門間調整、要件定義、導入前の合意形成を担当した。",
    question: "ステークホルダー間で意見が割れたプロジェクトを、どのように前に進めましたか。",
    idealAnswer:
      "販売管理システム刷新で、営業部門は入力項目削減を求め、経理部門は請求精度を担保するため入力項目維持を求めて対立しました。私はまず双方の主張を要望ではなく業務課題として整理し、営業側は入力工数削減、経理側は請求ミス防止が目的だと再定義しました。そのうえで、入力項目を一律削減するのではなく、マスタ参照による自動補完と例外時のみ追加入力する案を仮説として提示しました。現行データを使って入力削減率と請求チェック観点を検証し、営業の入力工数を下げつつ経理の確認観点を維持できる見通しを示しました。結果として両部門の合意を得て要件を確定できました。"
  };
}

function extractJson(text: string): unknown {
  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/i);
  const raw = fenced?.[1] ?? text;
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");

  if (first === -1 || last === -1 || last <= first) {
    throw new Error("JSON object not found.");
  }

  return JSON.parse(raw.slice(first, last + 1));
}

function buildSourceDocumentPrompt(input: PrepDraftRequest) {
  const document = input.sourceDocument;

  if (!hasSupportedDocument(document)) {
    return "求人票ファイル: なし";
  }

  if (document?.mimeType === "application/pdf") {
    return `求人票ファイル:
ファイル名: ${document.fileName}
形式: PDF
このリクエストに添付されたPDFを求人票・募集要項として解析してください。`;
  }

  return `求人票ファイル:
ファイル名: ${document?.fileName}
形式: TXT
本文:
${document?.text?.slice(0, 60000) || ""}`;
}

function buildPrompt(input: PrepDraftRequest) {
  const roleLabel = input.role === "engineer" ? "エンジニア" : "ITコンサル";

  return `あなたは面接対策サービスInterviewOpsの準備支援AIです。
ユーザーが入力した職種や想定ポジションをもとに、模擬面接に使う「AI面接官のタイプ・難易度・重点評価観点・求人票・経験概要・練習質問・理想回答」の下書きを作ってください。
求人票PDFまたはTXTが添付されている場合は、その内容を最優先で解析してください。

職種:
${roleLabel}

想定ポジション:
${input.targetPosition}

AI面接官のタイプ:
${input.interviewerStyle}

難易度:
${input.difficulty}

重点評価観点:
${input.evaluationFocus}

既存の求人票・募集要項:
${input.jobDescription}

${buildSourceDocumentPrompt(input)}

既存の経験概要:
${input.experience}

既存の練習質問:
${input.question}

既存の理想回答:
${input.idealAnswer}

必ず以下のJSONのみを返してください。Markdownや説明文は不要です。
{
  "role": "engineer または consultant",
  "interviewerStyle": "AI面接官のタイプ",
  "difficulty": "難易度",
  "evaluationFocus": "重点評価観点",
  "targetPosition": "想定企業・ポジション",
  "jobDescription": "求人票・募集要項の下書き",
  "experience": "候補者の経験概要の下書き",
  "question": "練習したい質問",
  "idealAnswer": "理想回答"
}

制約:
- 求人票から職種を判定し、エンジニア系なら "engineer"、ITコンサル・PMO・DX推進・業務改革系なら "consultant" を返す
- 実在企業名は出さず、汎用的な想定企業にする
- 求人票ファイルがある場合は、職種、想定ポジション、求人票、面接官タイプ、重点評価観点を求人票から具体的に抽出・要約する
- AI面接官のタイプは、面接官の振る舞い・深掘り方針が分かる文章にする
- 難易度は「やさしめ」「通常」「通常面接より少し厳しめ」「最終面接レベルで厳しめ」「ケース面接寄りに少し厳しめ」のいずれかに近い表現にする
- 重点評価観点はカンマ区切りの短い観点リストにする
- 理想回答は面接で話せる自然な日本語
- 理想回答には、課題、行動、判断理由、成果、学びを含める
- エンジニアなら技術選定理由、設計判断、DevOps理解、成果指標を含める
- ITコンサルなら課題設定、仮説、合意形成、業務インパクトを含める
- 既存入力がある場合は、それを尊重して補強する`;
}

function normalizeDraft(value: unknown, input: InterviewInput): PrepDraft {
  const fallback = fallbackDraft(input);
  const data = value as Partial<PrepDraft>;
  const role = data.role === "engineer" || data.role === "consultant" ? data.role : fallback.role;

  return {
    role,
    interviewerStyle: data.interviewerStyle || fallback.interviewerStyle,
    difficulty: data.difficulty || fallback.difficulty,
    evaluationFocus: data.evaluationFocus || fallback.evaluationFocus,
    targetPosition: data.targetPosition || fallback.targetPosition,
    jobDescription: data.jobDescription || fallback.jobDescription,
    experience: data.experience || fallback.experience,
    question: data.question || fallback.question,
    idealAnswer: data.idealAnswer || fallback.idealAnswer
  };
}

function buildGeminiParts(input: PrepDraftRequest): GeminiPart[] {
  const parts: GeminiPart[] = [];
  const document = input.sourceDocument;

  if (document?.mimeType === "application/pdf" && document.data) {
    parts.push({
      inline_data: {
        mime_type: "application/pdf",
        data: document.data
      }
    });
  }

  parts.push({ text: buildPrompt(input) });

  return parts;
}

export async function POST(request: Request) {
  const input = (await request.json()) as PrepDraftRequest;
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-3.5-flash";

  if (!apiKey) {
    return NextResponse.json({
      result: fallbackDraft(input),
      mode: "fallback"
    });
  }

  try {
    const response = await fetch(`${GEMINI_ENDPOINT}/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: buildGeminiParts(input)
          }
        ],
        generationConfig: {
          temperature: 0.45,
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const payload = await response.json();
    const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text || typeof text !== "string") {
      throw new Error("Gemini response text is empty.");
    }

    return NextResponse.json({
      result: normalizeDraft(extractJson(text), input),
      mode: "gemini"
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({
      result: fallbackDraft(input),
      mode: "fallback",
      warning: "Gemini APIの下書き生成に失敗したため、デモ用下書きを返しました。"
    });
  }
}
