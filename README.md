# InterviewOps

InterviewOps is an AI-agent interview coaching app for engineer and IT consultant interviews.

It turns interview preparation into a continuous improvement pipeline:

```text
Answer → Evaluate → Diff against ideal answer → Coach → Retry
```

## Features

- Engineer / IT consultant interview modes
- AI interviewer question generation
- Role-specific answer evaluation
- Ideal-answer diff analysis
- Improved answer drafting
- Interview CI-style attempts and improvement issues
- Agent Trace visualization
- Cloud Run-ready Dockerfile

## Tech Stack

- Next.js
- React
- Gemini API
- Cloud Run
- GitHub Actions

## Local Development

```bash
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:3000.

If `GEMINI_API_KEY` is not set, the app uses a demo fallback response so the UI remains testable.

## Environment Variables

| Name | Description |
| --- | --- |
| `GEMINI_API_KEY` | Gemini API key |
| `GEMINI_MODEL` | Gemini model name. Defaults to `gemini-1.5-flash` |

## Build

```bash
npm run build
```

## Cloud Run Deployment

Example:

```bash
gcloud run deploy interview-ops \
  --source . \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=YOUR_KEY
```

## Safety Notice

InterviewOps is intended for interview practice and coaching. AI feedback is a reference, not a hiring decision or guarantee.
