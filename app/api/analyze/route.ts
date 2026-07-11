import { NextResponse } from "next/server";
import { createFallbackAnalysis } from "../../lib/fallback";
import type { AnalysisResult, InterviewInput } from "../../types";

const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

function extractJson(text: string): unknown {
  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/i);
  const raw = fenced?.[1] ?? text;
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");

  if (first === -1 || last === -1 || last <= first) {
    throw new Error("JSON object not found in Gemini response.");
  }

  return JSON.parse(raw.slice(first, last + 1));
}

function buildPrompt(input: InterviewInput) {
  const roleLabel = input.role === "engineer" ? "エンジニア" : "ITコンサル";
  const roleRubric =
    input.role === "engineer"
      ? [
          "技術的具体性",
          "技術選定理由",
          "問題解決力",
          "チーム開発経験",
          "DevOps理解",
          "障害対応・改善経験"
        ]
      : [
          "課題設定力",
          "仮説思考",
          "業務理解",
          "ステークホルダー調整",
          "ビジネスインパクト",
          "プロジェクト推進力"
        ];

  return `あなたはInterviewOpsという面接対策AIエージェント群です。
対象は${roleLabel}面接です。

以下の4つのAgentとして協調し、面接回答を評価してください。
- Interviewer Agent: 質問と深掘り質問を設計
- Evaluator Agent: 職種別ルーブリックで採点
- Diff Agent: 理想回答との差分を分析
- Coach Agent: 改善回答と次回練習課題を生成

共通評価軸:
- 結論の明確さ
- 論理構成
- 具体性
- 再現性
- 面接回答としての簡潔さ

職種別評価軸:
${roleRubric.map((item) => `- ${item}`).join("\n")}

入力:
想定ポジション:
${input.targetPosition}

求人票・募集要項:
${input.jobDescription}

経験概要:
${input.experience}

練習したい質問:
${input.question}

理想回答:
${input.idealAnswer}

ユーザー回答:
${input.userAnswer}

必ず以下のJSONのみを返してください。Markdownや説明文は不要です。
{
  "generatedQuestion": "質問文",
  "deepDiveQuestion": "深掘り質問",
  "overallScore": 0,
  "summary": "総評",
  "scores": [
    {
      "name": "評価軸名",
      "score": 1,
      "maxScore": 5,
      "comment": "コメント"
    }
  ],
  "gaps": [
    {
      "axis": "評価軸名",
      "ideal": "理想回答にある要素",
      "actual": "実回答の状態",
      "suggestion": "改善提案"
    }
  ],
  "improvementPoints": ["改善点"],
  "rewrittenAnswer": "添削後の回答文",
  "shortVersion": "60秒以内で話す短縮版",
  "followUpPrep": ["深掘り対策質問"],
  "nextIssues": [
    {
      "title": "Issueタイトル",
      "priority": "High",
      "detail": "Issue詳細"
    }
  ],
  "agentTrace": [
    {
      "agent": "Agent名",
      "action": "実行したこと"
    }
  ]
}

制約:
- overallScoreは0から100の整数
- scoreは1から5の整数
- scoresは4〜7件
- gapsは2〜4件
- nextIssuesのpriorityはHigh, Medium, Lowのいずれか
- 採用合否を断定しない
- 個人属性による不公平な評価をしない
- 面接で実際に話せる自然な日本語にする`;
}

function normalizeResult(value: unknown, input: InterviewInput): AnalysisResult {
  const fallback = createFallbackAnalysis(input);
  const data = value as Partial<AnalysisResult>;

  return {
    generatedQuestion: data.generatedQuestion || fallback.generatedQuestion,
    deepDiveQuestion: data.deepDiveQuestion || fallback.deepDiveQuestion,
    overallScore:
      typeof data.overallScore === "number"
        ? Math.max(0, Math.min(100, Math.round(data.overallScore)))
        : fallback.overallScore,
    summary: data.summary || fallback.summary,
    scores: Array.isArray(data.scores) && data.scores.length > 0 ? data.scores : fallback.scores,
    gaps: Array.isArray(data.gaps) && data.gaps.length > 0 ? data.gaps : fallback.gaps,
    improvementPoints:
      Array.isArray(data.improvementPoints) && data.improvementPoints.length > 0
        ? data.improvementPoints
        : fallback.improvementPoints,
    rewrittenAnswer: data.rewrittenAnswer || fallback.rewrittenAnswer,
    shortVersion: data.shortVersion || fallback.shortVersion,
    followUpPrep:
      Array.isArray(data.followUpPrep) && data.followUpPrep.length > 0
        ? data.followUpPrep
        : fallback.followUpPrep,
    nextIssues:
      Array.isArray(data.nextIssues) && data.nextIssues.length > 0
        ? data.nextIssues
        : fallback.nextIssues,
    agentTrace:
      Array.isArray(data.agentTrace) && data.agentTrace.length > 0
        ? data.agentTrace
        : fallback.agentTrace
  };
}

export async function POST(request: Request) {
  const input = (await request.json()) as InterviewInput;

  if (!input.userAnswer?.trim()) {
    return NextResponse.json({ error: "回答文を入力してください。" }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL || "gemini-1.5-flash";

  if (!apiKey) {
    return NextResponse.json({
      result: createFallbackAnalysis(input),
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
          temperature: 0.35,
          responseMimeType: "application/json"
        }
      })
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message);
    }

    const payload = await response.json();
    const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text || typeof text !== "string") {
      throw new Error("Gemini response text is empty.");
    }

    const parsed = extractJson(text);

    return NextResponse.json({
      result: normalizeResult(parsed, input),
      mode: "gemini"
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({
      result: createFallbackAnalysis(input),
      mode: "fallback",
      warning: "Gemini APIの応答を解析できなかったため、デモ用フォールバックを返しました。"
    });
  }
}
