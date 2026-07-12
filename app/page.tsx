"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { getClientAuth } from "./lib/firebase-client";
import { roleDescriptions, roleLabels, sampleInputs } from "./lib/samples";
import type {
  AnalysisResult,
  Attempt,
  InterviewInput,
  InterviewItem,
  PrepDraft,
  RoleMode,
  SavedCompany,
  UploadedJobDocument
} from "./types";

type StepId = "interviewer" | "ideal" | "select" | "interview";
type CompanyPanelMode = "home" | "register" | "interview";
type InterviewOrderMode = "ordered" | "random";

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

const steps: Array<{ id: StepId; title: string; description: string }> = [
  {
    id: "interviewer",
    title: "AI面接官を設定",
    description: "職種、面接官のタイプ、難易度、評価観点を決めます。"
  },
  {
    id: "ideal",
    title: "理想回答を登録",
    description: "求人票、経験、練習テーマ、理想回答を登録します。"
  },
  {
    id: "interview",
    title: "模擬面接する",
    description: "AI面接官の質問に音声またはテキストで回答し、分析します。"
  }
];

const registrationSteps = steps.filter((step) => step.id !== "interview");
const interviewSteps: Array<{ id: StepId; title: string; description: string }> = [
  {
    id: "select",
    title: "対策内容を選ぶ",
    description: "保存済みの会社別対策から、今回使う内容を選びます。"
  },
  {
    id: "interview",
    title: "模擬面接する",
    description: "AI面接官の質問に回答し、分析します。"
  }
];

const MAX_JOB_DOCUMENT_BYTES = 8 * 1024 * 1024;
const COMPANIES_PER_PAGE = 8;

type CompanyEditorMode = "new" | "edit" | null;

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

function makeInterviewItemId() {
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeInterviewItems(input: InterviewInput): InterviewItem[] {
  const items = Array.isArray(input.interviewItems)
    ? input.interviewItems
        .filter((item) => item.question?.trim() || item.idealAnswer?.trim() || item.title?.trim())
        .map((item, index) => ({
          id: item.id || `item-${index + 1}`,
          title: item.title || `面接項目 ${index + 1}`,
          question: item.question || "",
          idealAnswer: item.idealAnswer || ""
        }))
    : [];

  if (items.length) return items;

  return [
    {
      id: "item-1",
      title: "面接項目 1",
      question: input.question || "",
      idealAnswer: input.idealAnswer || ""
    }
  ];
}

function withNormalizedInterviewItems(input: InterviewInput): InterviewInput {
  const items = normalizeInterviewItems(input);
  const first = items[0];

  return {
    ...input,
    question: input.question || first.question,
    idealAnswer: input.idealAnswer || first.idealAnswer,
    interviewItems: items
  };
}

function shuffleIndexes(length: number) {
  const indexes = Array.from({ length }, (_, index) => index);

  for (let index = indexes.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [indexes[index], indexes[swapIndex]] = [indexes[swapIndex], indexes[index]];
  }

  return indexes;
}

export default function Home() {
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [signingIn, setSigningIn] = useState(false);
  const [input, setInput] = useState<InterviewInput>(sampleInputs.engineer);
  const [currentStep, setCurrentStep] = useState<StepId>("interviewer");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [companies, setCompanies] = useState<SavedCompany[]>([]);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [companyStatus, setCompanyStatus] = useState("");
  const [companyLoading, setCompanyLoading] = useState(false);
  const [companyPanelMode, setCompanyPanelMode] = useState<CompanyPanelMode>("home");
  const [companyEditorMode, setCompanyEditorMode] = useState<CompanyEditorMode>(null);
  const [registrationSavedCompanyId, setRegistrationSavedCompanyId] = useState<string | null>(null);
  const [companySearch, setCompanySearch] = useState("");
  const [companyPage, setCompanyPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [interviewStarting, setInterviewStarting] = useState(false);
  const [draftingPrep, setDraftingPrep] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [interviewOpening, setInterviewOpening] = useState("");
  const [interviewQuestion, setInterviewQuestion] = useState(input.question);
  const [activeInterviewItemIndex, setActiveInterviewItemIndex] = useState(0);
  const [interviewOrderMode, setInterviewOrderMode] = useState<InterviewOrderMode>("ordered");
  const [interviewQueue, setInterviewQueue] = useState<number[]>([0]);
  const [interviewQueuePosition, setInterviewQueuePosition] = useState(0);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");
  const [jobDocument, setJobDocument] = useState<UploadedJobDocument | null>(null);
  const [jobDocumentStatus, setJobDocumentStatus] = useState("");
  const [responseMode, setResponseMode] = useState<"gemini" | "fallback" | null>(null);
  const [ttsAvailable, setTtsAvailable] = useState(false);
  const [avatarSpeaking, setAvatarSpeaking] = useState(false);
  const [avatarStatus, setAvatarStatus] = useState("AI面接官は待機中です。");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const selectedRoleDescription = roleDescriptions[input.role];
  const interviewItems = useMemo(() => normalizeInterviewItems(input), [input]);
  const activeInterviewItem = interviewItems[activeInterviewItemIndex] || interviewItems[0];
  const currentQueueItemIndex = interviewQueue[interviewQueuePosition] ?? activeInterviewItemIndex;
  const currentQueueItem = interviewItems[currentQueueItemIndex] || activeInterviewItem;
  const hasNextInterviewItem = interviewQueuePosition < interviewQueue.length - 1;

  const averageScore = useMemo(() => {
    if (!attempts.length) return null;
    return Math.round(attempts.reduce((sum, attempt) => sum + attempt.score, 0) / attempts.length);
  }, [attempts]);

  const latestImprovement = attempts.length >= 2 ? attempts[0].score - attempts[1].score : null;
  const filteredCompanies = useMemo(() => {
    const keyword = companySearch.trim().toLowerCase();
    if (!keyword) return companies;

    return companies.filter((company) => {
      const searchable = [
        company.companyName,
        company.input.targetPosition,
        company.input.jobDescription,
        roleLabels[company.input.role]
      ]
        .join(" ")
        .toLowerCase();

      return searchable.includes(keyword);
    });
  }, [companies, companySearch]);
  const companyPageCount = Math.max(1, Math.ceil(filteredCompanies.length / COMPANIES_PER_PAGE));
  const normalizedCompanyPage = Math.min(companyPage, companyPageCount);
  const visibleCompanies = filteredCompanies.slice(
    (normalizedCompanyPage - 1) * COMPANIES_PER_PAGE,
    normalizedCompanyPage * COMPANIES_PER_PAGE
  );
  const companyRangeStart = filteredCompanies.length ? (normalizedCompanyPage - 1) * COMPANIES_PER_PAGE + 1 : 0;
  const companyRangeEnd = Math.min(normalizedCompanyPage * COMPANIES_PER_PAGE, filteredCompanies.length);

  const isBrowser = typeof window !== "undefined";
  const speechSupported =
    isBrowser && Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  const isLocalhost =
    isBrowser &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  const isSecureForVoice = isBrowser && (window.isSecureContext || isLocalhost);
  const voiceAvailable = speechSupported && isSecureForVoice;

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    async function initializeAuth() {
      try {
        const auth = await getClientAuth();

        if (cancelled) return;

        unsubscribe = onAuthStateChanged(auth, async (user) => {
          if (!user) {
            setAuthUser(null);
            setAuthLoading(false);
            return;
          }

          try {
            const token = await user.getIdToken();
            const response = await fetch("/api/session", {
              headers: {
                Authorization: `Bearer ${token}`
              }
            });
            const payload = await response.json();

            if (!response.ok) {
              throw new Error(payload.error || "このアカウントは利用できません。");
            }

            setAuthUser(user);
            setAuthError("");
          } catch (caught) {
            console.error(caught);
            setAuthUser(null);
            setAuthError(caught instanceof Error ? caught.message : "このアカウントは利用できません。");
            await signOut(auth);
          } finally {
            setAuthLoading(false);
          }
        });
      } catch (caught) {
        console.error(caught);
        setAuthLoading(false);
        setAuthError("Firebaseクライアント設定が未設定です。Cloud Runの環境変数を確認してください。");
      }
    }

    initializeAuth();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      "speechSynthesis" in window &&
      "SpeechSynthesisUtterance" in window;

    setTtsAvailable(supported);
    setAvatarStatus(
      supported
        ? "AI面接官の音声読み上げが使えます。"
        : "このブラウザではAI面接官の音声読み上げが使えません。"
    );

    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (authUser) {
      loadCompanies();
    } else {
      setCompanies([]);
      setActiveCompanyId(null);
      setCompanyName("");
      setCompanyPanelMode("home");
      setCompanyEditorMode(null);
    }
  }, [authUser]);

  useEffect(() => {
    setCompanyPage(1);
  }, [companySearch]);

  useEffect(() => {
    if (companyPage > companyPageCount) {
      setCompanyPage(companyPageCount);
    }
  }, [companyPage, companyPageCount]);

  async function getAuthHeaders() {
    if (!authUser) {
      throw new Error("ログインが必要です。");
    }

    const token = await authUser.getIdToken();
    return {
      Authorization: `Bearer ${token}`
    };
  }

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSigningIn(true);
    setAuthError("");

    try {
      const auth = await getClientAuth();
      await signInWithEmailAndPassword(auth, authEmail.trim(), authPassword);
      setAuthPassword("");
    } catch (caught) {
      console.error(caught);
      setAuthError("ログインできませんでした。メールアドレスまたはパスワードを確認してください。");
    } finally {
      setSigningIn(false);
    }
  }

  async function handleSignOut() {
    stopInterviewerSpeech();
    const auth = await getClientAuth();
    await signOut(auth);
  }

  async function loadCompanies() {
    if (!authUser) return;

    setCompanyLoading(true);
    setCompanyStatus("");

    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/companies", { headers });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "会社別対策の取得に失敗しました。");
      }

      setCompanies(payload.companies || []);
    } catch (caught) {
      setCompanyStatus(caught instanceof Error ? caught.message : "会社別対策の取得に失敗しました。");
    } finally {
      setCompanyLoading(false);
    }
  }

  async function saveCompany() {
    setCompanyLoading(true);
    setCompanyStatus("");
    const inputToSave = withNormalizedInterviewItems(input);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch("/api/companies", {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          companyId: activeCompanyId,
          companyName: companyName.trim() || inputToSave.targetPosition,
          input: inputToSave
        })
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "会社別対策の保存に失敗しました。");
      }

      const saved = payload.company as SavedCompany;
      setActiveCompanyId(saved.id);
      setCompanyName(saved.companyName);
      setInput(withNormalizedInterviewItems(saved.input));
      setCompanies((current) => {
        const rest = current.filter((company) => company.id !== saved.id);
        return [saved, ...rest];
      });
      if (activeCompanyId) {
        setCompanyStatus("読み込み中の会社別対策を更新しました。");
      } else if (payload.saveAction === "updated") {
        setCompanyStatus("同じ企業名・職種・想定ポジションの対策が見つかったため、既存の対策を更新しました。");
      } else {
        setCompanyStatus("新しい会社別対策として保存しました。");
      }
      if (companyPanelMode === "register") {
        setRegistrationSavedCompanyId(saved.id);
      }
      setCompanyEditorMode("edit");
    } catch (caught) {
      setCompanyStatus(caught instanceof Error ? caught.message : "会社別対策の保存に失敗しました。");
    } finally {
      setCompanyLoading(false);
    }
  }

  async function loadCompany(company: SavedCompany, mode: "edit" | "select" | "interview" = "edit") {
    setCompanyLoading(true);
    setCompanyStatus("");

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/companies/${company.id}/attempts`, { headers });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "面接ログの取得に失敗しました。");
      }

      const loadedInput = withNormalizedInterviewItems(company.input);
      const firstItem = loadedInput.interviewItems?.[0];
      setInput(loadedInput);
      setActiveInterviewItemIndex(0);
      setInterviewQueue([0]);
      setInterviewQueuePosition(0);
      setInterviewQuestion(firstItem?.question || loadedInput.question);
      setInterviewOpening("");
      setSessionStarted(false);
      setResult(null);
      setAttempts(payload.attempts || []);
      setActiveCompanyId(company.id);
      setCompanyName(company.companyName);
      if (mode === "interview") {
        setCompanyPanelMode("interview");
        setCompanyEditorMode(null);
        setCurrentStep("interview");
        setCompanyStatus(`${company.companyName} の模擬面接を開始できます。`);
      } else if (mode === "select") {
        setCompanyPanelMode("interview");
        setCompanyEditorMode(null);
        setCurrentStep("select");
        setCompanyStatus(`${company.companyName} の登録内容を表示しました。必要なら編集して更新できます。`);
      } else {
        setCompanyPanelMode("register");
        setCompanyEditorMode("edit");
        setRegistrationSavedCompanyId(null);
        setCurrentStep("interviewer");
        setCompanyStatus(`${company.companyName} を編集画面に読み込みました。STEP1〜2で内容を編集できます。`);
      }
    } catch (caught) {
      setCompanyStatus(caught instanceof Error ? caught.message : "会社別対策の読み込みに失敗しました。");
    } finally {
      setCompanyLoading(false);
    }
  }

  function startNewCompanyPlan() {
    stopInterviewerSpeech();
    const nextInput = withNormalizedInterviewItems(sampleInputs.engineer);
    setInput(nextInput);
    setActiveInterviewItemIndex(0);
    setInterviewQueue([0]);
    setInterviewQueuePosition(0);
    setInterviewQuestion(nextInput.interviewItems?.[0]?.question || nextInput.question);
    setInterviewOpening("");
    setSessionStarted(false);
    setResult(null);
    setAttempts([]);
    setActiveCompanyId(null);
    setCompanyName("");
    setCompanyPanelMode("register");
    setCompanyEditorMode("new");
    setRegistrationSavedCompanyId(null);
    setCurrentStep("interviewer");
    setCompanyStatus("新規作成画面を開きました。STEP1〜2を編集し、最後に企業名・対策名を入力して保存してください。");
  }

  function closeCompanyEditor() {
    setCompanyEditorMode(null);
    setCompanyStatus("");
  }

  function openCompanyHome() {
    setCompanyPanelMode("home");
    setCompanyEditorMode(null);
    setRegistrationSavedCompanyId(null);
    setCompanyStatus("");
  }

  function openCompanyRegister() {
    setCompanyPanelMode("register");
    setCompanyEditorMode(null);
    setCompanyStatus("");
  }

  function openCompanyInterview() {
    setCompanyPanelMode("interview");
    setCompanyEditorMode(null);
    setRegistrationSavedCompanyId(null);
    setCompanySearch("");
    setActiveCompanyId(null);
    setCompanyName("");
    setAttempts([]);
    setActiveInterviewItemIndex(0);
    setInterviewQueue([0]);
    setInterviewQueuePosition(0);
    setResult(null);
    setInterviewOpening("");
    setSessionStarted(false);
    setCurrentStep("select");
    setCompanyStatus("");
  }

  function clearSelectedInterviewCompany() {
    stopInterviewerSpeech();
    setActiveCompanyId(null);
    setCompanyName("");
    setAttempts([]);
    setActiveInterviewItemIndex(0);
    setInterviewQueue([0]);
    setInterviewQueuePosition(0);
    setResult(null);
    setInterviewOpening("");
    setSessionStarted(false);
    setCurrentStep("select");
    setCompanyStatus("");
  }

  function proceedToMockInterview() {
    if (!activeCompanyId) {
      setCompanyStatus("先に模擬面接で使う対策内容を選んでください。");
      return;
    }

    stopInterviewerSpeech();
    const itemCount = Math.max(1, interviewItems.length);
    const queue =
      interviewOrderMode === "random"
        ? shuffleIndexes(itemCount)
        : Array.from({ length: itemCount }, (_, index) => index);
    setInterviewQueue(queue);
    setInterviewQueuePosition(0);
    setActiveInterviewItemIndex(queue[0] ?? 0);
    setCompanyPanelMode("interview");
    setCompanyEditorMode(null);
    setRegistrationSavedCompanyId(null);
    setSessionStarted(false);
    setResult(null);
    setInterviewOpening("");
    setCurrentStep("interview");
    setCompanyStatus("");
  }

  async function deleteCompany(company: SavedCompany) {
    const confirmed = window.confirm(
      `${company.companyName} を削除しますか？\nこの会社別対策と紐づく模擬面接ログも削除されます。`
    );
    if (!confirmed) return;

    setCompanyLoading(true);
    setCompanyStatus("");

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`/api/companies/${company.id}`, {
        method: "DELETE",
        headers
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "会社別対策の削除に失敗しました。");
      }

      setCompanies((current) => current.filter((item) => item.id !== company.id));
      if (activeCompanyId === company.id) {
        setActiveCompanyId(null);
        setCompanyName("");
        setAttempts([]);
        setResult(null);
        setCompanyPanelMode("home");
        setCompanyEditorMode(null);
      }
      setCompanyStatus(`${company.companyName} を削除しました。`);
    } catch (caught) {
      setCompanyStatus(caught instanceof Error ? caught.message : "会社別対策の削除に失敗しました。");
    } finally {
      setCompanyLoading(false);
    }
  }

  async function saveAttemptForActiveCompany(attempt: Attempt) {
    if (!activeCompanyId) return;

    try {
      const headers = await getAuthHeaders();
      await fetch(`/api/companies/${activeCompanyId}/attempts`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ attempt })
      });
      loadCompanies();
    } catch (caught) {
      console.error(caught);
      setCompanyStatus("面接ログの自動保存に失敗しました。会社別対策は手動保存できます。");
    }
  }

  function update<K extends keyof InterviewInput>(key: K, value: InterviewInput[K]) {
    if (companyPanelMode === "register" && (currentStep === "interviewer" || currentStep === "ideal")) {
      setRegistrationSavedCompanyId(null);
    }
    setInput((current) => ({ ...current, [key]: value }));
  }

  function updateInterviewItem(index: number, field: keyof InterviewItem, value: string) {
    if (companyPanelMode === "register") {
      setRegistrationSavedCompanyId(null);
    }

    setInput((current) => {
      const items = normalizeInterviewItems(current);
      const nextItems = items.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item));
      const first = nextItems[0];
      const active = nextItems[activeInterviewItemIndex] || first;

      return {
        ...current,
        interviewItems: nextItems,
        question: active?.question || first.question,
        idealAnswer: active?.idealAnswer || first.idealAnswer
      };
    });
  }

  function addInterviewItem() {
    if (companyPanelMode === "register") {
      setRegistrationSavedCompanyId(null);
    }

    setInput((current) => {
      const items = normalizeInterviewItems(current);
      const nextItem: InterviewItem = {
        id: makeInterviewItemId(),
        title: `面接項目 ${items.length + 1}`,
        question: "",
        idealAnswer: ""
      };

      return {
        ...current,
        interviewItems: [...items, nextItem]
      };
    });
    setActiveInterviewItemIndex(interviewItems.length);
  }

  function removeInterviewItem(index: number) {
    if (interviewItems.length <= 1) {
      setCompanyStatus("面接項目は最低1つ必要です。");
      return;
    }

    if (companyPanelMode === "register") {
      setRegistrationSavedCompanyId(null);
    }

    setInput((current) => {
      const nextItems = normalizeInterviewItems(current).filter((_, itemIndex) => itemIndex !== index);
      const nextActiveIndex = Math.min(activeInterviewItemIndex, nextItems.length - 1);
      const active = nextItems[nextActiveIndex] || nextItems[0];
      setActiveInterviewItemIndex(nextActiveIndex);

      return {
        ...current,
        interviewItems: nextItems,
        question: active.question,
        idealAnswer: active.idealAnswer
      };
    });
  }

  function selectInterviewItem(index: number) {
    const item = interviewItems[index];
    if (!item) return;

    setActiveInterviewItemIndex(index);
    setInput((current) => ({
      ...current,
      question: item.question,
      idealAnswer: item.idealAnswer,
      userAnswer: ""
    }));
    setInterviewQuestion(item.question);
    setInterviewOpening("");
    setResult(null);
    setSessionStarted(false);
  }

  function switchRole(role: RoleMode) {
    if (companyPanelMode === "register") {
      setRegistrationSavedCompanyId(null);
    }
    const next = withNormalizedInterviewItems(sampleInputs[role]);
    setInput(next);
    setActiveInterviewItemIndex(0);
    setInterviewQueue([0]);
    setInterviewQueuePosition(0);
    setInterviewQuestion(next.interviewItems?.[0]?.question || next.question);
    setInterviewOpening("");
    setSessionStarted(false);
    setResult(null);
    setError("");
    setResponseMode(null);
  }

  function loadSample() {
    if (companyPanelMode === "register") {
      setRegistrationSavedCompanyId(null);
    }
    const sample = withNormalizedInterviewItems(sampleInputs[input.role]);
    setInput(sample);
    setActiveInterviewItemIndex(0);
    setInterviewQueue([0]);
    setInterviewQueuePosition(0);
    setInterviewQuestion(sample.interviewItems?.[0]?.question || sample.question);
    setInterviewOpening("");
    setSessionStarted(false);
    setResult(null);
    setError("");
    setResponseMode(null);
  }

  function goToStep(step: StepId) {
    setCurrentStep(step);
    setError("");
  }

  function stopInterviewerSpeech() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    utteranceRef.current = null;
    setAvatarSpeaking(false);
  }

  function speakInterviewerQuestion(text = interviewQuestion) {
    const question = text.trim();

    if (!question) {
      setAvatarStatus("読み上げる質問がまだありません。");
      return;
    }

    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window) ||
      !("SpeechSynthesisUtterance" in window)
    ) {
      setTtsAvailable(false);
      setAvatarSpeaking(false);
      setAvatarStatus("このブラウザではAI面接官の音声読み上げが使えません。");
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(question);
    utterance.lang = "ja-JP";
    utterance.rate = 0.94;
    utterance.pitch = 0.96;
    utterance.volume = 1;

    const japaneseVoice = window.speechSynthesis
      .getVoices()
      .find((voice) => voice.lang.toLowerCase().startsWith("ja"));

    if (japaneseVoice) {
      utterance.voice = japaneseVoice;
    }

    utterance.onstart = () => {
      setAvatarSpeaking(true);
      setAvatarStatus("AI面接官が質問を読み上げています。");
    };
    utterance.onend = () => {
      utteranceRef.current = null;
      setAvatarSpeaking(false);
      setAvatarStatus("読み上げ完了。回答を録音または入力してください。");
    };
    utterance.onerror = () => {
      utteranceRef.current = null;
      setAvatarSpeaking(false);
      setAvatarStatus("音声読み上げに失敗しました。ボタンからもう一度試してください。");
    };

    utteranceRef.current = utterance;
    setAvatarStatus("AI面接官の音声を準備しています。");
    window.speechSynthesis.speak(utterance);

    window.setTimeout(() => {
      if (utteranceRef.current === utterance && !window.speechSynthesis.speaking) {
        setAvatarSpeaking(false);
        setAvatarStatus("自動読み上げが始まらない場合は「質問を読み上げる」を押してください。");
      }
    }, 900);
  }

  function readAsDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("ファイルの読み込みに失敗しました。"));
      reader.readAsDataURL(file);
    });
  }

  function readAsText(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(new Error("ファイルの読み込みに失敗しました。"));
      reader.readAsText(file);
    });
  }

  async function startInterview(itemIndex = currentQueueItemIndex) {
    setInterviewStarting(true);
    setError("");
    setResult(null);

    try {
      const item = interviewItems[itemIndex] || interviewItems[0];
      const nextQuestion = item.question.trim();

      if (!nextQuestion) {
        throw new Error("この面接項目には質問が登録されていません。STEP3で質問を入力してください。");
      }

      setActiveInterviewItemIndex(itemIndex);
      setInterviewOpening(`${item.title || "面接項目"}について質問します。`);
      setInterviewQuestion(nextQuestion);
      setInput((current) => ({
        ...current,
        question: nextQuestion,
        idealAnswer: item.idealAnswer,
        userAnswer: ""
      }));
      setSessionStarted(true);
      setCurrentStep("interview");
      setTimeout(() => speakInterviewerQuestion(nextQuestion), 120);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "AI面接官の開始に失敗しました。");
    } finally {
      setInterviewStarting(false);
    }
  }

  function startNextInterviewItem() {
    if (!hasNextInterviewItem) {
      setSessionStarted(false);
      setInterviewOpening("");
      setCompanyStatus("登録されている面接項目をすべて完了しました。改善ログを確認してください。");
      return;
    }

    const nextPosition = interviewQueuePosition + 1;
    const nextItemIndex = interviewQueue[nextPosition] ?? 0;
    stopInterviewerSpeech();
    setInterviewQueuePosition(nextPosition);
    setResult(null);
    setSessionStarted(false);
    setInterviewOpening("");
    setInput((current) => ({ ...current, userAnswer: "" }));
    startInterview(nextItemIndex);
  }

  async function generatePrepDraft(sourceDocument = jobDocument) {
    setDraftingPrep(true);
    setError("");

    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch("/api/prep-draft", {
        method: "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ...input,
          sourceDocument: sourceDocument ?? undefined
        })
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "面接準備の下書き生成に失敗しました。");
      }

      const draft = payload.result as PrepDraft;
      if (companyPanelMode === "register") {
        setRegistrationSavedCompanyId(null);
      }
      setInput((current) => {
        const items = normalizeInterviewItems(current);
        const nextItems = items.map((item, index) =>
          index === activeInterviewItemIndex
            ? {
                ...item,
                title: item.title || "AI下書き項目",
                question: draft.question,
                idealAnswer: draft.idealAnswer
              }
            : item
        );

        return {
          ...current,
          role: draft.role || current.role,
          interviewerStyle: draft.interviewerStyle,
          difficulty: draft.difficulty,
          evaluationFocus: draft.evaluationFocus,
          targetPosition: draft.targetPosition,
          jobDescription: draft.jobDescription,
          experience: draft.experience,
          question: draft.question,
          idealAnswer: draft.idealAnswer,
          interviewItems: nextItems
        };
      });
      setInterviewQuestion(draft.question);
      setSessionStarted(false);
      setResult(null);
      setResponseMode(payload.mode);
      if (sourceDocument) {
        setJobDocumentStatus(
          payload.mode === "gemini"
            ? "求人票ファイルからAI解析して反映しました。"
            : "Gemini APIに接続できないため、デモ用の下書きを反映しました。"
        );
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "面接準備の下書き生成に失敗しました。");
    } finally {
      setDraftingPrep(false);
    }
  }

  async function handleJobDocumentUpload(file: File | undefined) {
    if (!file) return;

    setError("");
    setJobDocumentStatus("");

    const lowerName = file.name.toLowerCase();
    const isPdf = file.type === "application/pdf" || lowerName.endsWith(".pdf");
    const isText =
      file.type === "text/plain" ||
      lowerName.endsWith(".txt") ||
      lowerName.endsWith(".md");

    if (!isPdf && !isText) {
      setError("求人票ファイルはPDFまたはTXTのみ対応しています。");
      return;
    }

    if (file.size > MAX_JOB_DOCUMENT_BYTES) {
      setError("求人票ファイルは8MB以下にしてください。大きいPDFは要約版やTXT化したものを使うと安定します。");
      return;
    }

    try {
      setJobDocumentStatus(`${file.name} を読み込み中...`);

      const document: UploadedJobDocument = isPdf
        ? {
            fileName: file.name,
            mimeType: "application/pdf",
            data: (await readAsDataUrl(file)).split(",")[1] || ""
          }
        : {
            fileName: file.name,
            mimeType: "text/plain",
            text: (await readAsText(file)).slice(0, 60000)
          };

      setJobDocument(document);
      setJobDocumentStatus(`${file.name} をAI解析中...`);
      await generatePrepDraft(document);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "求人票ファイルの解析に失敗しました。");
      setJobDocumentStatus("");
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
        "音声入力にはHTTPSまたはlocalhostが必要です。LANのHTTPアドレスでは録音できません。http://localhost:3000 で開くか、HTTPSでデプロイしてください。"
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
        question: interviewQuestion || currentQueueItem.question || input.question,
        idealAnswer: currentQueueItem.idealAnswer || input.idealAnswer
      };
      const authHeaders = await getAuthHeaders();

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(analysisInput)
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "分析に失敗しました。");
      }

      const nextResult = payload.result as AnalysisResult;
      setResult(nextResult);
      setResponseMode(payload.mode);
      const attempt: Attempt = {
        id: attempts.length + 1,
        role: input.role,
        itemTitle: currentQueueItem.title,
        question: nextResult.generatedQuestion,
        score: nextResult.overallScore,
        summary: nextResult.summary,
        createdAt: new Date().toLocaleTimeString("ja-JP", {
          hour: "2-digit",
          minute: "2-digit"
        }),
        issues: nextResult.nextIssues
      };
      setAttempts((current) => [attempt, ...current]);
      saveAttemptForActiveCompany(attempt);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "分析に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  function renderInterviewItemsEditor() {
    return (
      <section className="interviewItemsEditor">
        <div className="interviewItemsHeader">
          <div>
            <p className="sectionLabel">Question Set</p>
            <h3>面接対策したい項目</h3>
            <p>質問と理想回答を複数登録できます。模擬面接ではここに登録した項目を1つずつ出題します。</p>
          </div>
          <button className="secondaryButton tinyButton" onClick={addInterviewItem} type="button">
            項目を追加
          </button>
        </div>

        <div className="interviewItemTabs" role="tablist" aria-label="面接対策項目">
          {interviewItems.map((item, index) => (
            <button
              key={item.id}
              className={index === activeInterviewItemIndex ? "interviewItemTab activeInterviewItemTab" : "interviewItemTab"}
              onClick={() => selectInterviewItem(index)}
              type="button"
            >
              <span>{index + 1}</span>
              <strong>{item.title || `面接項目 ${index + 1}`}</strong>
            </button>
          ))}
        </div>

        <div className="interviewItemEditor">
          <div className="interviewItemEditorHeader">
            <strong>項目 {activeInterviewItemIndex + 1}</strong>
            <button
              className="dangerButton tinyButton"
              onClick={() => removeInterviewItem(activeInterviewItemIndex)}
              disabled={interviewItems.length <= 1}
              type="button"
            >
              この項目を削除
            </button>
          </div>

          <label>
            項目名
            <input
              value={activeInterviewItem.title}
              onChange={(event) => updateInterviewItem(activeInterviewItemIndex, "title", event.target.value)}
              placeholder="例: 技術選定理由 / 合意形成 / 成果指標"
            />
          </label>

          <label>
            質問
            <input
              value={activeInterviewItem.question}
              onChange={(event) => updateInterviewItem(activeInterviewItemIndex, "question", event.target.value)}
              placeholder="例: これまで最も難しかった技術課題は？"
            />
          </label>

          <label>
            理想回答
            <textarea
              className="idealAnswerBox"
              value={activeInterviewItem.idealAnswer}
              onChange={(event) => updateInterviewItem(activeInterviewItemIndex, "idealAnswer", event.target.value)}
              placeholder="この質問で話したい理想回答や模範回答を入力してください"
            />
          </label>
        </div>
      </section>
    );
  }

  if (authLoading) {
    return (
      <main>
        <section className="authShell">
          <div className="authCard">
            <p className="eyebrow">InterviewOps Secure Access</p>
            <h1>Loading</h1>
            <p className="lead">ログイン状態を確認しています。</p>
          </div>
        </section>
      </main>
    );
  }

  if (!authUser) {
    return (
      <main>
        <section className="authShell">
          <form className="authCard" onSubmit={handleSignIn}>
            <p className="eyebrow">InterviewOps Secure Access</p>
            <h1>Sign in</h1>
            <p className="lead">
              事前に許可されたメールアドレスとパスワードでログインしてください。ログイン後にAI面接官と会社別対策を利用できます。
            </p>

            <label>
              メールアドレス
              <input
                autoComplete="email"
                type="email"
                value={authEmail}
                onChange={(event) => setAuthEmail(event.target.value)}
                placeholder="you@example.com"
                required
              />
            </label>

            <label>
              パスワード
              <input
                autoComplete="current-password"
                type="password"
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
                placeholder="••••••••"
                required
              />
            </label>

            {authError ? <p className="errorText">{authError}</p> : null}

            <button className="primaryButton authButton" type="submit" disabled={signingIn}>
              {signingIn ? "ログイン中..." : "ログインして開始"}
            </button>
            <p className="authNote">
              新規登録はできません。利用するアカウントはFirebase Authenticationで事前作成してください。
            </p>
          </form>
        </section>
      </main>
    );
  }

  if (companyPanelMode === "home") {
    return (
      <main>
        <div className="appTopBar">
          <span />
          <button className="secondaryButton miniButton" onClick={handleSignOut} type="button">
            ログアウト
          </button>
        </div>
        <section className="launchShell">
          <button className="launchButton" onClick={startNewCompanyPlan} type="button">
            登録
          </button>
          <button className="launchButton" disabled={!companies.length} onClick={openCompanyInterview} type="button">
            模擬面接
          </button>
        </section>
      </main>
    );
  }

  const registrationReadyForInterview =
    companyPanelMode === "register" && !!activeCompanyId && registrationSavedCompanyId === activeCompanyId;

  return (
    <main>
      {companyPanelMode === "register" ? (
        <section className="registrationTop">
          <div className="appTopBar">
            <button className="secondaryButton miniButton" onClick={openCompanyHome} type="button">
              ホームに戻る
            </button>
            <button className="secondaryButton miniButton" onClick={handleSignOut} type="button">
              ログアウト
            </button>
          </div>
          <div className="wizardStepper registrationStepper" aria-label="InterviewOps setup steps">
            {registrationSteps.map((step, index) => (
              <button
                key={step.id}
                className={currentStep === step.id ? "wizardStep selectedWizardStep" : "wizardStep"}
                onClick={() => goToStep(step.id)}
                type="button"
              >
                <span>STEP {index + 1}</span>
                <strong>{step.title}</strong>
                <small>{step.description}</small>
              </button>
            ))}
          </div>
        </section>
      ) : companyPanelMode === "interview" ? (
        <section className="registrationTop">
          <div className="appTopBar">
            <button className="secondaryButton miniButton" onClick={openCompanyHome} type="button">
              ホームに戻る
            </button>
            <button className="secondaryButton miniButton" onClick={handleSignOut} type="button">
              ログアウト
            </button>
          </div>
          <div className="wizardStepper registrationStepper" aria-label="InterviewOps interview steps">
            {interviewSteps.map((step, index) => (
              <button
                key={step.id}
                className={currentStep === step.id ? "wizardStep selectedWizardStep" : "wizardStep"}
                onClick={() => goToStep(step.id)}
                disabled={step.id === "interview" && !activeCompanyId}
                type="button"
              >
                <span>STEP {index + 3}</span>
                <strong>{step.title}</strong>
                <small>{step.description}</small>
              </button>
            ))}
          </div>
        </section>
      ) : (
        <>
          <section className="hero wizardHero">
            <div className="heroCopy">
              <p className="eyebrow">DevOps × AI Agent Hackathon MVP</p>
              <h1>InterviewOps</h1>
              <p className="lead">
                AI面接官の設計、理想回答の登録、模擬面接、AI分析までを1つのInterview Pipelineとして回します。
              </p>
              <div className="heroActions">
                <button className="primaryButton" onClick={() => goToStep("interviewer")}>
                  1から設定する
                </button>
                <button className="secondaryButton" onClick={loadSample}>
                  サンプルを読み込む
                </button>
                <button className="secondaryButton" onClick={handleSignOut}>
                  ログアウト
                </button>
              </div>
            </div>

            <div className="wizardStepper" aria-label="InterviewOps setup steps">
              {steps.map((step, index) => (
                <button
                  key={step.id}
                  className={currentStep === step.id ? "wizardStep selectedWizardStep" : "wizardStep"}
                  onClick={() => goToStep(step.id)}
                  type="button"
                >
                  <span>{index + 1}</span>
                  <strong>{step.title}</strong>
                  <small>{step.description}</small>
                </button>
              ))}
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
        </>
      )}

      <section className={companyPanelMode === "register" || companyPanelMode === "interview" ? "registrationFlow" : "flowLayout"}>
        {companyPanelMode === "register" || companyPanelMode === "interview" ? null : (
        <aside className="panel flowSummary">
          <p className="sectionLabel">Current Setup</p>
          <h2>今回の面接設定</h2>
          <div className="accountCard">
            <span>Signed in</span>
            <strong>{authUser.email}</strong>
          </div>

          <div className="companyManager">
            <div className="companyManagerHeader">
              <div>
                <p className="sectionLabel">Interview</p>
                <h3>模擬面接する対策を選択</h3>
              </div>
            </div>

            {companyStatus ? <p className="companyStatus">{companyStatus}</p> : null}

            <>
                <div className="companySearchBox">
                  <label>
                    模擬面接する対策を検索
                    <input
                      value={companySearch}
                      onChange={(event) => setCompanySearch(event.target.value)}
                      placeholder="企業名・職種・求人票キーワード"
                    />
                  </label>
                  <small>
                    {filteredCompanies.length}件表示 / 全{companies.length}件
                  </small>
                </div>

                <div className="companyList">
                  {visibleCompanies.length ? (
                    visibleCompanies.map((company) => (
                      <div
                        key={company.id}
                        className={company.id === activeCompanyId ? "companyItem activeCompanyItem" : "companyItem"}
                      >
                        <strong>{company.companyName}</strong>
                        <span>{company.input.targetPosition || roleLabels[company.input.role]}</span>
                        <small>
                          Attempts {company.attemptsCount}
                          {company.latestScore !== null ? ` / Latest ${company.latestScore}` : ""}
                        </small>
                        <div className="companyActions">
                          <button className="primaryButton tinyButton" onClick={() => loadCompany(company, "interview")} type="button">
                            模擬面接へ
                          </button>
                          <button className="secondaryButton tinyButton" onClick={() => loadCompany(company, "edit")} type="button">
                            編集してから面接
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="emptyCompanyList">
                      {companies.length
                        ? "検索条件に一致する会社別対策はありません。"
                        : "模擬面接に使う会社別対策がまだありません。"}
                    </p>
                  )}
                </div>

                {filteredCompanies.length > COMPANIES_PER_PAGE ? (
                  <div className="companyPager">
                    <span>
                      {companyRangeStart}-{companyRangeEnd} / {filteredCompanies.length}
                    </span>
                    <div>
                      <button
                        className="secondaryButton tinyButton"
                        disabled={normalizedCompanyPage <= 1}
                        onClick={() => setCompanyPage((page) => Math.max(1, page - 1))}
                        type="button"
                      >
                        前へ
                      </button>
                      <button
                        className="secondaryButton tinyButton"
                        disabled={normalizedCompanyPage >= companyPageCount}
                        onClick={() => setCompanyPage((page) => Math.min(companyPageCount, page + 1))}
                        type="button"
                      >
                        次へ
                      </button>
                    </div>
                  </div>
                ) : null}
            </>
          </div>

        </aside>
        )}

        <section className="panel flowMain">
          {currentStep === "select" ? (
            <div className="stepPanel">
              <div className="panelHeader">
                <div>
                  <p className="sectionLabel">Step 3</p>
                  <h2>対策する面接内容を選ぶ</h2>
                </div>
                <span className="badge">Interview Setup</span>
              </div>

              {companyStatus ? <p className="companyStatus">{companyStatus}</p> : null}

              {!activeCompanyId ? (
                <>
                  <p className="hint">模擬面接で使う会社別対策を選ぶと、登録済みの内容を確認・編集できます。</p>

                  <div className="companyList interviewSelectList">
                    {visibleCompanies.length ? (
                      visibleCompanies.map((company) => (
                        <div key={company.id} className="companyItem">
                          <strong>{company.companyName}</strong>
                          <span>{company.input.targetPosition || roleLabels[company.input.role]}</span>
                          <small>{roleLabels[company.input.role]} ・ {company.input.difficulty}</small>
                          <div className="companyActions">
                            <button className="primaryButton tinyButton" onClick={() => loadCompany(company, "select")} type="button">
                              登録内容を表示
                            </button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="emptyCompanyList">模擬面接に使う会社別対策がまだありません。</p>
                    )}
                  </div>

                  {companies.length > COMPANIES_PER_PAGE ? (
                    <div className="companyPager">
                      <span>
                        {companyRangeStart}-{companyRangeEnd} / {companies.length}
                      </span>
                      <div>
                        <button
                          className="secondaryButton tinyButton"
                          disabled={normalizedCompanyPage <= 1}
                          onClick={() => setCompanyPage((page) => Math.max(1, page - 1))}
                          type="button"
                        >
                          前へ
                        </button>
                        <button
                          className="secondaryButton tinyButton"
                          disabled={normalizedCompanyPage >= companyPageCount}
                          onClick={() => setCompanyPage((page) => Math.min(companyPageCount, page + 1))}
                          type="button"
                        >
                          次へ
                        </button>
                      </div>
                    </div>
                  ) : null}
                </>
              ) : (
                <section className="selectedPlanEditor">
                  <div className="selectedPlanHeader">
                    <div>
                      <p className="sectionLabel">Selected Plan</p>
                      <h3>{companyName || input.targetPosition || "選択中の面接対策"}</h3>
                      <p>登録済みの内容です。必要ならこの画面で編集し、更新してから模擬面接に進めます。</p>
                    </div>
                    <button className="secondaryButton tinyButton" onClick={clearSelectedInterviewCompany} type="button">
                      別の対策を選ぶ
                    </button>
                  </div>

                  <div className="formGrid">
                    <label>
                      企業名・対策名
                      <input
                        value={companyName}
                        onChange={(event) => setCompanyName(event.target.value)}
                        placeholder="例: A社 Webエンジニア面接"
                      />
                    </label>

                    <label>
                      職種
                      <select value={input.role} onChange={(event) => update("role", event.target.value as RoleMode)}>
                        <option value="engineer">エンジニア</option>
                        <option value="consultant">ITコンサル</option>
                      </select>
                    </label>

                    <label>
                      想定企業・ポジション
                      <input
                        value={input.targetPosition}
                        onChange={(event) => update("targetPosition", event.target.value)}
                        placeholder="例: SaaS企業のWebアプリケーションエンジニア"
                      />
                    </label>

                    <label>
                      難易度
                      <select value={input.difficulty} onChange={(event) => update("difficulty", event.target.value)}>
                        <option>やさしめ</option>
                        <option>通常</option>
                        <option>通常面接より少し厳しめ</option>
                        <option>最終面接レベルで厳しめ</option>
                        <option>ケース面接寄りに少し厳しめ</option>
                      </select>
                    </label>

                    <label>
                      AI面接官のタイプ
                      <textarea
                        value={input.interviewerStyle}
                        onChange={(event) => update("interviewerStyle", event.target.value)}
                        placeholder="例: 深掘り重視。技術選定理由と障害対応を厳しめに確認する面接官。"
                      />
                    </label>

                    <label>
                      重点評価観点
                      <textarea
                        value={input.evaluationFocus}
                        onChange={(event) => update("evaluationFocus", event.target.value)}
                        placeholder="例: 技術選定理由、設計判断、成果指標、自分の役割"
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

                    {renderInterviewItemsEditor()}
                  </div>

                  <div className="stepActions splitStepActions">
                    <button className="secondaryButton" onClick={saveCompany} disabled={companyLoading} type="button">
                      {companyLoading ? "更新中..." : "この内容で更新保存"}
                    </button>
                    <button className="primaryButton" onClick={proceedToMockInterview} type="button">
                      STEP4 模擬面接へ
                    </button>
                  </div>
                </section>
              )}
            </div>
          ) : null}

          {currentStep === "interviewer" ? (
            <div className="stepPanel">
              <div className="panelHeader">
                <div>
                  <p className="sectionLabel">Step 1</p>
                  <h2>どういうAI面接官にするか設定</h2>
                </div>
                <span className="badge">Interviewer Agent</span>
              </div>

              <div className="jobUploadCard">
                <div>
                  <p className="sectionLabel">Job Description Parser</p>
                  <h3>求人票PDF / TXTから面接設定を作る</h3>
                  <p>
                    求人票をアップロードすると、職種、想定ポジション、面接官タイプ、難易度、重点評価観点、練習質問、理想回答の下書きまでAIが入力します。
                  </p>
                  {jobDocument ? (
                    <span className="sourceChip">読み込み済み: {jobDocument.fileName}</span>
                  ) : null}
                  {jobDocumentStatus ? <p className="uploadStatus">{jobDocumentStatus}</p> : null}
                </div>
                <label className="fileDropLabel">
                  <input
                    className="fileInput"
                    type="file"
                    accept=".pdf,.txt,.md,application/pdf,text/plain"
                    onChange={(event) => handleJobDocumentUpload(event.target.files?.[0])}
                  />
                  <span>{draftingPrep ? "AI解析中..." : "求人票をアップロード"}</span>
                  <small>PDF / TXT・8MBまで</small>
                </label>
              </div>

              <div className="draftAssistCard">
                <div>
                  <p className="sectionLabel">AI Suggest</p>
                  <h3>面接官タイプと評価観点をAIで提案</h3>
                  <p>
                    職種と想定ポジションをもとに、面接官の振る舞い、難易度、重点評価観点を自動で作ります。
                  </p>
                </div>
                <button className="primaryButton" onClick={() => generatePrepDraft()} disabled={draftingPrep}>
                  {draftingPrep ? "AIが提案中..." : "面接官設定をAIで作る"}
                </button>
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

              <div className="formGrid">
                <label>
                  AI面接官のタイプ
                  <textarea
                    value={input.interviewerStyle}
                    onChange={(event) => update("interviewerStyle", event.target.value)}
                    placeholder="例: 深掘り重視。技術選定理由と障害対応を厳しめに確認する面接官。"
                  />
                </label>

                <label>
                  難易度
                  <select value={input.difficulty} onChange={(event) => update("difficulty", event.target.value)}>
                    <option>やさしめ</option>
                    <option>通常</option>
                    <option>通常面接より少し厳しめ</option>
                    <option>最終面接レベルで厳しめ</option>
                    <option>ケース面接寄りに少し厳しめ</option>
                  </select>
                </label>

                <label>
                  重点評価観点
                  <textarea
                    value={input.evaluationFocus}
                    onChange={(event) => update("evaluationFocus", event.target.value)}
                    placeholder="例: 技術選定理由、設計判断、成果指標、自分の役割"
                  />
                </label>
              </div>

              <div className="stepActions">
                <button className="primaryButton" onClick={() => goToStep("ideal")}>
                  STEP2へ
                </button>
              </div>
            </div>
          ) : null}

          {currentStep === "ideal" ? (
            <div className="stepPanel">
              <div className="panelHeader">
                <div>
                  <p className="sectionLabel">Step 2</p>
                  <h2>どういう面接回答が良いか登録</h2>
                </div>
                <span className="badge">Diff Standard</span>
              </div>

              <div className="draftAssistCard">
                <div>
                  <p className="sectionLabel">AI Draft</p>
                  <h3>面接準備をAIで下書き</h3>
                  <p>
                    Step 1の面接官設定と想定ポジションをもとに、面接官タイプ・評価観点・求人票・経験概要・質問・理想回答をまとめて生成します。
                  </p>
                </div>
                <button className="primaryButton" onClick={() => generatePrepDraft()} disabled={draftingPrep}>
                  {draftingPrep ? "AIが下書き中..." : "面接準備をAIで入力"}
                </button>
              </div>

              <div className="formGrid">
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

                {renderInterviewItemsEditor()}
              </div>

              <div className={companyPanelMode === "register" ? "stepActions leftStepActions" : "stepActions"}>
                <button className="secondaryButton" onClick={() => goToStep("interviewer")}>
                  STEP1へ
                </button>
                {companyPanelMode !== "register" ? (
                  <button className="primaryButton" onClick={() => startInterview()} disabled={interviewStarting}>
                    {interviewStarting ? "AI面接官を準備中..." : "次へ：模擬面接を開始"}
                  </button>
                ) : null}
              </div>

              {companyPanelMode === "register" ? (
                <section className="finalSaveCard">
                  <div className="companyEditorHeader">
                    <div>
                      <span>
                        {registrationReadyForInterview
                          ? "登録済み"
                          : companyEditorMode === "edit"
                            ? "模擬面接用に更新"
                            : "模擬面接用に登録"}
                      </span>
                      <strong>{companyName || input.targetPosition || "名称未設定の対策"}</strong>
                    </div>
                  </div>

                  <label>
                    企業名・対策名
                    <input
                      value={companyName}
                      onChange={(event) => {
                        setRegistrationSavedCompanyId(null);
                        setCompanyName(event.target.value);
                      }}
                      placeholder="例: A社 Webエンジニア面接"
                    />
                  </label>

                  {companyStatus ? <p className="companyStatus">{companyStatus}</p> : null}

                  <button
                    className="primaryButton wideButton"
                    onClick={registrationReadyForInterview ? proceedToMockInterview : saveCompany}
                    disabled={companyLoading}
                    type="button"
                  >
                    {registrationReadyForInterview
                      ? "模擬面接へ進む"
                      : companyLoading
                        ? "保存中..."
                        : companyEditorMode === "edit"
                          ? "模擬面接で使うために更新"
                          : "模擬面接で使うために登録"}
                  </button>
                </section>
              ) : null}

            </div>
          ) : null}

          {currentStep === "interview" ? (
            <div className="stepPanel">
              <div className="panelHeader">
                <div>
                  <p className="sectionLabel">{companyPanelMode === "interview" ? "Step 4" : "Step 3"}</p>
                  <h2>模擬面接する</h2>
                </div>
                {result ? <span className={`scorePill ${scoreTone(result.overallScore)}`}>{result.overallScore}/100</span> : null}
              </div>

              <section className="interviewRunConfig">
                <div>
                  <p className="sectionLabel">Interview Queue</p>
                  <h3>
                    {interviewQueuePosition + 1} / {interviewQueue.length || interviewItems.length}問目
                  </h3>
                  <p>{currentQueueItem?.title || "面接項目"}：{currentQueueItem?.question || "質問未設定"}</p>
                </div>
                <div className="orderSwitch" role="tablist" aria-label="出題順">
                  <button
                    className={interviewOrderMode === "ordered" ? "selectedOrderMode" : ""}
                    onClick={() => {
                      setInterviewOrderMode("ordered");
                      const queue = Array.from({ length: interviewItems.length }, (_, index) => index);
                      setInterviewQueue(queue);
                      setInterviewQueuePosition(0);
                      setActiveInterviewItemIndex(queue[0] ?? 0);
                      setSessionStarted(false);
                      setResult(null);
                    }}
                    type="button"
                  >
                    順番
                  </button>
                  <button
                    className={interviewOrderMode === "random" ? "selectedOrderMode" : ""}
                    onClick={() => {
                      setInterviewOrderMode("random");
                      const queue = shuffleIndexes(interviewItems.length);
                      setInterviewQueue(queue);
                      setInterviewQueuePosition(0);
                      setActiveInterviewItemIndex(queue[0] ?? 0);
                      setSessionStarted(false);
                      setResult(null);
                    }}
                    type="button"
                  >
                    順不同
                  </button>
                </div>
              </section>

              {!sessionStarted ? (
                <div className="emptyState">
                  <div className="emptyIcon">🎙</div>
                  <h3>準備ができたらAI面接官を開始してください。</h3>
                  <p>登録してある面接項目を、選択した順序で1問ずつ出題します。</p>
                  <button className="primaryButton" onClick={() => startInterview()} disabled={interviewStarting}>
                    {interviewStarting ? "AI面接官を準備中..." : `${currentQueueItem?.title || "現在の項目"}を開始`}
                  </button>
                </div>
              ) : (
                <div className="interviewSession">
                  <section className={avatarSpeaking ? "interviewerCard speakingInterviewer" : "interviewerCard"}>
                    <div className="interviewerStage">
                      <div className="avatarFrame" aria-hidden="true">
                        <div className="avatarAura" />
                        <div className="aiAvatar">
                          <div className="avatarHair" />
                          <div className="avatarFace">
                            <span className="avatarEye leftEye" />
                            <span className="avatarEye rightEye" />
                            <span className="avatarMouth" />
                          </div>
                          <div className="avatarBody" />
                        </div>
                        <div className="speakingBars">
                          <span />
                          <span />
                          <span />
                        </div>
                      </div>

                      <div className="interviewerCopy">
                        <p className="sectionLabel">AI Interviewer Avatar</p>
                        <h3>{interviewOpening || "模擬面接を始めます。"}</h3>
                        <p className="avatarStatus">{avatarStatus}</p>
                        <div className="avatarControls">
                          <button
                            className="secondaryButton"
                            onClick={() => speakInterviewerQuestion()}
                            disabled={!ttsAvailable || avatarSpeaking}
                            type="button"
                          >
                            質問を読み上げる
                          </button>
                          <button
                            className="secondaryButton"
                            onClick={stopInterviewerSpeech}
                            disabled={!avatarSpeaking}
                            type="button"
                          >
                            読み上げ停止
                          </button>
                        </div>
                      </div>
                    </div>

                    {!ttsAvailable ? (
                      <div className="voiceNotice avatarNotice">
                        <strong>AI面接官の音声読み上げについて</strong>
                        <span>
                          このブラウザではText-to-Speechが利用できません。Chrome / Edge / Safariの最新版で試してください。
                        </span>
                      </div>
                    ) : null}

                    <div className="questionBubble">{interviewQuestion}</div>
                  </section>

                  <section className="answerCard">
                    <div className="answerHeader">
                      <div>
                        <p className="sectionLabel">Your Answer</p>
                        <h3>音声またはテキストで回答</h3>
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
                    <>
                      <AnalysisResultView result={result} />
                      <div className="nextQuestionCard">
                        <div>
                          <p className="sectionLabel">Next</p>
                          <h3>{hasNextInterviewItem ? "次の質問へ進めます。" : "登録した質問はすべて完了です。"}</h3>
                          <p>
                            {hasNextInterviewItem
                              ? "次の面接項目を開始すると、回答欄と分析結果がリセットされます。"
                              : "改善ログを確認し、必要ならSTEP3で質問セットを編集してください。"}
                          </p>
                        </div>
                        {hasNextInterviewItem ? (
                          <button className="primaryButton" onClick={startNextInterviewItem} type="button">
                            次の質問へ
                          </button>
                        ) : null}
                      </div>
                    </>
                  )}
                </div>
              )}

              {error ? <p className="errorText">{error}</p> : null}

            </div>
          ) : null}
        </section>
      </section>

      {companyPanelMode === "interview" && currentStep === "interview" ? (
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
                    Attempt #{attempt.id} ・ {attempt.itemTitle ? `${attempt.itemTitle} ・ ` : ""}{roleLabels[attempt.role]} ・ {attempt.createdAt}
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
      ) : null}

      <footer>
        <p>
          InterviewOpsは面接練習用のAIコーチです。AI評価は参考情報であり、採用合否を保証するものではありません。機密情報や個人情報の入力は避けてください。
        </p>
      </footer>
    </main>
  );
}

function AnalysisResultView({ result }: { result: AnalysisResult }) {
  return (
    <div className="resultStack">
      <section className="agentTraceCard">
        <p className="sectionLabel">Agent Trace</p>
        <div className="agentRail">
          {result.agentTrace.map((trace, index) => (
            <div key={`${trace.agent}-${trace.action}`} className="agentRailItem">
              <span>{index + 1}</span>
              <strong>{trace.agent}</strong>
              <small>{trace.action}</small>
            </div>
          ))}
        </div>
      </section>

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
    </div>
  );
}
