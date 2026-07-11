"use client";

import { useMemo, useRef, useState } from "react";
import { roleDescriptions, roleLabels, sampleInputs } from "./lib/samples";
import type { AnalysisResult, Attempt, InterviewInput, RoleMode } from "./types";

type SpeechRecognitionAlternativeLike = {
  transcript: string;
};

type SpeechRecognitionResultLike = {
  0: SpeechRecognitionAlternativeLike;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

function scoreTone(score: number) {
  if (score >= 82) return "scoreGood";
  if (score >= 65) return "scoreWarn";
  return "scoreRisk";
}

function priorityLabel(priority: string) {
  if (priority === "High") return "高";
  if (priority === "Medium") return "中";
  return "低";
}

export default function Home() {
  const [input, setInput] = useState<InterviewInput>(sampleInputs.engineer);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(false);
  const [interviewStarting, setInterviewStarting] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [interviewOpening, setInterviewOpening] = useState("");
  const [interviewQuestion, setInterviewQuestion] = useState(input.question);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");
  const [responseMode, setResponseMode] = useState<"gemini" | "fallback" | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const selectedRoleDescription = roleDescriptions[input.role];

  const averageScore = useMemo(() => {
    if (!attempts.length) return null;
    return Math.round(attempts.reduce((sum, attempt) => sum + attempt.score, 0) / attempts.length);
  }, [attempts]);

  const isBrowser = typeof window !== "undefined";
  const speechSupported =
    isBrowser && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  const isLocalhost =
    isBrowser &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  const isSecureForVoice = isBrowser && (window.isSecureContext || isLocalhost);
  const voiceAvailable = speechSupported && isSecureForVoice;

  function update<K extends keyof InterviewInput>(key: K, value: InterviewInput[K]) {
    setInput((current) => ({ ...current, [key]: value }));
  }

  function switchRole(role: RoleMode) {
    setInput(sampleInputs[role]);
    setInterviewQuestion(sampleInputs[role].question);
    setInterviewOpening("");
    setSessionStarted(false);
    setResult(null);
    setError("");
    setResponseMode(null);
  }

  function loadSample() {
    const sample = sampleInputs[input.role];
    setInput(sample);
    setInterviewQuestion(sample.question);
    setInterviewOpening("");
    setSessionStarted(false);
    setResult(null);
    setError("");
    setResponseMode(null);
  }

  async function startInterview() {
    setInterviewStarting(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "AI面接官の開始に失敗しました。");
      }

      const nextQuestion = payload.result.question as string;
      setInterviewOpening(payload.result.opening as string);
      setInterviewQuestion(nextQuestion);
      update("question", nextQuestion);
      update("userAnswer", "");
      setSessionStarted(true);
      setResponseMode(payload.mode);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "AI面接官の開始に失敗しました。");
    } finally {
      setInterviewStarting(false);
    }
  }

  function startVoiceAnswer() {
    setError("");

    if (!speechSupported) {
      setError("このブラウザでは音声入力が利用できません。Chrome / Edgeで試すか、テキストで回答してください。");
      return;
    }

    if (!isSecureForVoice) {
      setError(
        "音声入力にはHTTPSまたはlocalhostが必要です。いまのようなLANのHTTPアドレスでは録音できません。http://localhost:3000 で開くか、HTTPSでデプロイしてください。"
      );
      return;
    }

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return;

    const recognition = new Recognition();
    recognition.lang = "ja-JP";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.onresult = (event) => {
      const transcript = Array.from({ length: event.results.length }, (_, index) => {
        return event.results[index]?.[0]?.transcript ?? "";
      })
        .join("")
        .trim();

      if (transcript) {
        update("userAnswer", transcript);
      }
    };
    recognition.onerror = (event) => {
      setError(`音声入力でエラーが発生しました。${event.error ? `(${event.error})` : ""}`);
      setRecording(false);
    };
    recognition.onend = () => {
      setRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  }

  function stopVoiceAnswer() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setRecording(false);
  }

  async function analyze() {
    setLoading(true);
    setError("");

    try {
      const analysisInput = {
        ...input,
        question: interviewQuestion || input.question
      };

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(analysisInput)
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "分析に失敗しました。");
      }

      const nextResult = payload.result as AnalysisResult;
      setResult(nextResult);
      setResponseMode(payload.mode);
      setAttempts((current) => [
        {
          id: current.length + 1,
          role: input.role,
          question: nextResult.generatedQuestion,
          score: nextResult.overallScore,
          summary: nextResult.summary,
          createdAt: new Date().toLocaleTimeString("ja-JP", {
            hour: "2-digit",
            minute: "2-digit"
          }),
          issues: nextResult.nextIssues
        },
        ...current
      ]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "分析に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <section className="hero">
        <div className="heroCopy">
          <p className="eyebrow">DevOps × AI Agent Hackathon MVP</p>
          <h1>InterviewOps</h1>
          <p className="lead">
            AI面接官が質問し、音声またはテキスト回答をAIエージェントが評価。理想回答との差分、添削、次の改善Issueまで返します。
          </p>
          <div className="heroActions">
            <button className="primaryButton" onClick={startInterview} disabled={interviewStarting}>
              {interviewStarting ? "AI面接官を準備中..." : "AI面接官を開始"}
            </button>
            <button className="secondaryButton" onClick={loadSample}>
              サンプルを読み込む
            </button>
          </div>
        </div>

        <div className="pipelineCard" aria-label="InterviewOps pipeline">
          <div className={`pipelineStep ${sessionStarted ? "active" : ""}`}>Interview</div>
          <div className="pipelineLine" />
          <div className={`pipelineStep ${input.userAnswer ? "active" : ""}`}>Voice Answer</div>
          <div className="pipelineLine" />
          <div className={`pipelineStep ${result ? "active" : ""}`}>Evaluate</div>
          <div className="pipelineLine" />
          <div className={`pipelineStep ${result ? "active" : ""}`}>Diff & Coach</div>
          <div className="pipelineLine" />
          <div className="pipelineStep">Retry</div>
        </div>
      </section>

      <section className="metricsGrid">
        <div className="metricCard">
          <span>Role Mode</span>
          <strong>{roleLabels[input.role]}</strong>
        </div>
        <div className="metricCard">
          <span>Attempts</span>
          <strong>{attempts.length}</strong>
        </div>
        <div className="metricCard">
          <span>Average Score</span>
          <strong>{averageScore ?? "—"}</strong>
        </div>
        <div className="metricCard">
          <span>Runtime</span>
          <strong>{responseMode === "gemini" ? "Gemini" : responseMode === "fallback" ? "Demo" : "Ready"}</strong>
        </div>
      </section>

      <section className="workspace">
        <div className="panel inputPanel">
          <div className="panelHeader">
            <div>
              <p className="sectionLabel">Setup</p>
              <h2>面接前の事前情報</h2>
            </div>
            <span className="badge">Interview Session</span>
          </div>

          <div className="roleSwitch" role="tablist" aria-label="職種モード">
            {(["engineer", "consultant"] as const).map((role) => (
              <button
                key={role}
                className={input.role === role ? "roleButton selected" : "roleButton"}
                onClick={() => switchRole(role)}
                type="button"
              >
                {roleLabels[role]}
              </button>
            ))}
          </div>
          <p className="hint">{selectedRoleDescription}</p>

          <div className="sessionActions">
            <button className="primaryButton wideButton" onClick={startInterview} disabled={interviewStarting}>
              {interviewStarting ? "AI面接官を準備中..." : "AI面接官を開始"}
            </button>
            <button className="secondaryButton wideButton" onClick={loadSample}>
              サンプルを戻す
            </button>
          </div>

          <label>
            想定企業・ポジション
            <input
              value={input.targetPosition}
              onChange={(event) => update("targetPosition", event.target.value)}
              placeholder="例: SaaS企業のWebアプリケーションエンジニア"
            />
          </label>

          <label>
            求人票・募集要項
            <textarea
              value={input.jobDescription}
              onChange={(event) => update("jobDescription", event.target.value)}
              placeholder="求人票や求められるスキルを貼り付けてください"
            />
          </label>

          <label>
            自分の経験概要
            <textarea
              value={input.experience}
              onChange={(event) => update("experience", event.target.value)}
              placeholder="職務経歴やアピールしたい経験を入力してください"
            />
          </label>

          <label>
            練習したい質問・テーマ
            <input
              value={input.question}
              onChange={(event) => update("question", event.target.value)}
              placeholder="例: これまで最も難しかった技術課題は？"
            />
          </label>

          <label>
            理想回答
            <textarea
              value={input.idealAnswer}
              onChange={(event) => update("idealAnswer", event.target.value)}
              placeholder="理想回答や模範回答を入力してください"
            />
          </label>

          {error ? <p className="errorText">{error}</p> : null}
        </div>

        <div className="panel resultPanel">
          <div className="panelHeader">
            <div>
              <p className="sectionLabel">Interview</p>
              <h2>AI面接官セッション</h2>
            </div>
            {result ? <span className={`scorePill ${scoreTone(result.overallScore)}`}>{result.overallScore}/100</span> : null}
          </div>

          {!sessionStarted ? (
            <div className="emptyState">
              <div className="emptyIcon">🎙</div>
              <h3>「AI面接官を開始」を押すと、模擬面接が始まります。</h3>
              <p>AIが事前情報をもとに質問し、音声またはテキスト回答を分析します。</p>
            </div>
          ) : (
            <div className="interviewSession">
              <section className="interviewerCard">
                <p className="sectionLabel">AI Interviewer</p>
                <h3>{interviewOpening || "模擬面接を始めます。"}</h3>
                <div className="questionBubble">{interviewQuestion}</div>
              </section>

              <section className="answerCard">
                <div className="answerHeader">
                  <div>
                    <p className="sectionLabel">Your Answer</p>
                    <h3>音声で回答する</h3>
                  </div>
                  <span className={recording ? "recordingBadge activeRecording" : "recordingBadge"}>
                    {recording
                      ? "Recording"
                      : voiceAvailable
                        ? "Voice Ready"
                        : speechSupported
                          ? "HTTPS/localhost required"
                          : "Text Only"}
                  </span>
                </div>

                {!voiceAvailable ? (
                  <div className="voiceNotice">
                    <strong>音声入力を使うには</strong>
                    <span>
                      Chrome/Edgeで <code>http://localhost:3000</code> を開いてください。LANの
                      <code>192.168.x.x</code> は保護されていない通信のため、ブラウザが録音をブロックします。
                    </span>
                  </div>
                ) : null}

                <div className="voiceActions">
                  {!recording ? (
                    <button className="primaryButton" onClick={startVoiceAnswer} disabled={!voiceAvailable}>
                      録音開始
                    </button>
                  ) : (
                    <button className="dangerButton" onClick={stopVoiceAnswer}>
                      録音停止
                    </button>
                  )}
                  <button className="secondaryButton" onClick={() => update("userAnswer", "")}>
                    回答をクリア
                  </button>
                </div>

                <label>
                  音声認識された回答・またはテキスト回答
                  <textarea
                    className="answerBox"
                    value={input.userAnswer}
                    onChange={(event) => update("userAnswer", event.target.value)}
                    placeholder="録音するとここに文字起こしされます。手入力で回答してもOKです。"
                  />
                </label>

                <button className="primaryButton analyzeButton" onClick={analyze} disabled={loading || !input.userAnswer.trim()}>
                  {loading ? "AIが回答を分析中..." : "回答をAI分析する"}
                </button>
              </section>

              {!result ? (
                <div className="emptyState compactEmpty">
                  <div className="emptyIcon">△</div>
                  <h3>回答後に「回答をAI分析する」を押してください。</h3>
                  <p>理想回答との差分、添削、改善Issueが表示されます。</p>
                </div>
              ) : (
                <div className="resultStack">
                  <div className="summaryCard">
                    <p className="sectionLabel">Summary</p>
                    <h3>{result.summary}</h3>
                    <p>
                      深掘り質問: <strong>{result.deepDiveQuestion}</strong>
                    </p>
                  </div>

                  <div className="scoreGrid">
                    {result.scores.map((score) => (
                      <article key={score.name} className="scoreCard">
                        <div>
                          <h4>{score.name}</h4>
                          <p>{score.comment}</p>
                        </div>
                        <strong>
                          {score.score}/{score.maxScore}
                        </strong>
                      </article>
                    ))}
                  </div>

                  <div className="twoColumn">
                    <section>
                      <p className="sectionLabel">Diff Agent</p>
                      <h3>理想回答との差分</h3>
                      <div className="gapList">
                        {result.gaps.map((gap) => (
                          <article key={gap.axis} className="gapCard">
                            <h4>{gap.axis}</h4>
                            <p>
                              <strong>理想:</strong> {gap.ideal}
                            </p>
                            <p>
                              <strong>現状:</strong> {gap.actual}
                            </p>
                            <p>
                              <strong>改善:</strong> {gap.suggestion}
                            </p>
                          </article>
                        ))}
                      </div>
                    </section>

                    <section>
                      <p className="sectionLabel">Coach Agent</p>
                      <h3>改善Issue</h3>
                      <div className="issueList">
                        {result.nextIssues.map((issue) => (
                          <article key={issue.title} className="issueCard">
                            <span className={`priority priority${issue.priority}`}>
                              優先度 {priorityLabel(issue.priority)}
                            </span>
                            <h4>{issue.title}</h4>
                            <p>{issue.detail}</p>
                          </article>
                        ))}
                      </div>
                    </section>
                  </div>

                  <section className="rewriteCard">
                    <p className="sectionLabel">Rewritten Answer</p>
                    <h3>添削後の回答</h3>
                    <p>{result.rewrittenAnswer}</p>
                    <div className="shortAnswer">
                      <strong>60秒版</strong>
                      <span>{result.shortVersion}</span>
                    </div>
                  </section>

                  <section>
                    <p className="sectionLabel">Agent Trace</p>
                    <div className="traceList">
                      {result.agentTrace.map((trace) => (
                        <div key={`${trace.agent}-${trace.action}`} className="traceItem">
                          <strong>{trace.agent}</strong>
                          <span>{trace.action}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="panel attemptsPanel">
        <div className="panelHeader">
          <div>
            <p className="sectionLabel">Attempts</p>
            <h2>改善ログ</h2>
          </div>
          <span className="badge">Answer Pipeline</span>
        </div>

        {attempts.length === 0 ? (
          <p className="hint">まだAttemptはありません。回答を分析すると、改善履歴がここに残ります。</p>
        ) : (
          <div className="attemptList">
            {attempts.map((attempt) => (
              <article key={attempt.id} className="attemptCard">
                <div>
                  <span className="attemptMeta">
                    Attempt #{attempt.id} ・ {roleLabels[attempt.role]} ・ {attempt.createdAt}
                  </span>
                  <h3>{attempt.question}</h3>
                  <p>{attempt.summary}</p>
                </div>
                <strong className={`scorePill ${scoreTone(attempt.score)}`}>{attempt.score}</strong>
              </article>
            ))}
          </div>
        )}
      </section>

      <footer>
        <p>
          InterviewOpsは面接練習用のAIコーチです。AI評価は参考情報であり、採用合否を保証するものではありません。機密情報や個人情報の入力は避けてください。
        </p>
      </footer>
    </main>
  );
}
