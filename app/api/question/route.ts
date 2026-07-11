import { NextResponse } from "next/server";
import type { InterviewInput } from "../../types";

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

function fallbackQuestion(input: InterviewInput) {
  const roleLabel = input.role === "engineer" ? "エンジニア" : "ITコンサル";

  return {
    opening: `${roleLabel}面接を始めます。あなたの経験に沿って、まず1問質問します。`,
    question:
      input.question?.trim() ||
      (input.role === "engineer"
        ? "これまで最も難しかった技術課題と、その解決方法を教えてください。"
        : "ステークホルダー間で意見が割れたプロジェクトを、どのように前に進めましたか。")
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

function buildPrompt(input: InterviewInput) {
  const roleLabel = input.role === "engineer" ? "エンジニア" : "ITコンサル";

  return `あなたは${roleLabel}採用面接のAI面接官です。
候補者の事前情報をもとに、模擬面接の最初の質問を1つだけ作ってください。

想定ポジション:
${input.targetPosition}

求人票・募集要項:
${input.jobDescription}

候補者の経験概要:
${input.experience}

ユーザーが練習したい質問:
${input.question}

制約:
- 質問は1つだけ
- 面接官として自然な日本語
- 回答しやすいが、職種の評価観点が見える質問にする
- エンジニアなら技術選定・設計判断・障害対応・DevOps理解を引き出す
- ITコンサルなら課題設定・仮説思考・業務理解・合意形成・ビジネスインパクトを引き出す
- 採用合否を断定しない

必ず以下のJSONのみを返してください。
{
  "opening": "面接開始時の短い声かけ",
  "question": "面接質問"
}`;
}

export async function POST(request: Request) {
  const input = (await request.json()) as InterviewInput;
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";

  if (!apiKey) {
    return NextResponse.json({
      result: fallbackQuestion(input),
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
            parts: [{ text: buildPrompt(input) }]
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

    const parsed = extractJson(text) as Partial<ReturnType<typeof fallbackQuestion>>;
    const fallback = fallbackQuestion(input);

    return NextResponse.json({
      result: {
        opening: parsed.opening || fallback.opening,
        question: parsed.question || fallback.question
      },
      mode: "gemini"
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({
      result: fallbackQuestion(input),
      mode: "fallback",
      warning: "Gemini APIの質問生成に失敗したため、デモ用質問を返しました。"
    });
  }
}
