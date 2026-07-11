export type RoleMode = "engineer" | "consultant";

export type InterviewInput = {
  role: RoleMode;
  interviewerStyle: string;
  difficulty: string;
  evaluationFocus: string;
  targetPosition: string;
  jobDescription: string;
  experience: string;
  question: string;
  idealAnswer: string;
  userAnswer: string;
};

export type PrepDraft = {
  interviewerStyle: string;
  difficulty: string;
  evaluationFocus: string;
  targetPosition: string;
  jobDescription: string;
  experience: string;
  question: string;
  idealAnswer: string;
};

export type ScoreItem = {
  name: string;
  score: number;
  maxScore: number;
  comment: string;
};

export type GapItem = {
  axis: string;
  ideal: string;
  actual: string;
  suggestion: string;
};

export type NextIssue = {
  title: string;
  priority: "High" | "Medium" | "Low";
  detail: string;
};

export type AgentTraceItem = {
  agent: string;
  action: string;
};

export type AnalysisResult = {
  generatedQuestion: string;
  deepDiveQuestion: string;
  overallScore: number;
  summary: string;
  scores: ScoreItem[];
  gaps: GapItem[];
  improvementPoints: string[];
  rewrittenAnswer: string;
  shortVersion: string;
  followUpPrep: string[];
  nextIssues: NextIssue[];
  agentTrace: AgentTraceItem[];
};

export type Attempt = {
  id: number;
  role: RoleMode;
  question: string;
  score: number;
  summary: string;
  createdAt: string;
  issues: NextIssue[];
};
