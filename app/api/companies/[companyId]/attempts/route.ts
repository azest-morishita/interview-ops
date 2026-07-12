import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { getAdminDb } from "../../../../lib/firebase-admin";
import { requireAuthenticatedUser } from "../../../../lib/server-auth";
import type { Attempt } from "../../../../types";

type RouteContext = {
  params: Promise<{ companyId: string }>;
};

type SaveAttemptPayload = {
  attempt: Attempt;
};

function timestampToIso(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  return new Date().toISOString();
}

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) return auth.response;

  const { companyId } = await context.params;
  const db = getAdminDb();
  const companyRef = db.collection("users").doc(auth.user.uid).collection("companies").doc(companyId);
  const company = await companyRef.get();

  if (!company.exists) {
    return NextResponse.json({ error: "会社別対策が見つかりません。" }, { status: 404 });
  }

  const snapshot = await companyRef.collection("attempts").orderBy("createdAt", "desc").limit(20).get();
  const attempts = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: data.id || Number(doc.id),
      role: data.role,
      question: data.question,
      score: data.score,
      summary: data.summary,
      createdAt: timestampToIso(data.createdAt),
      issues: data.issues || []
    } satisfies Attempt;
  });

  return NextResponse.json({ attempts });
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) return auth.response;

  const { companyId } = await context.params;
  const payload = (await request.json()) as SaveAttemptPayload;

  if (!payload.attempt) {
    return NextResponse.json({ error: "保存する面接ログがありません。" }, { status: 400 });
  }

  const db = getAdminDb();
  const companyRef = db.collection("users").doc(auth.user.uid).collection("companies").doc(companyId);
  const company = await companyRef.get();

  if (!company.exists) {
    return NextResponse.json({ error: "会社別対策が見つかりません。" }, { status: 404 });
  }

  await companyRef.collection("attempts").add({
    ...payload.attempt,
    ownerUid: auth.user.uid,
    ownerEmail: auth.user.email,
    createdAt: FieldValue.serverTimestamp()
  });

  await companyRef.set(
    {
      attemptsCount: FieldValue.increment(1),
      latestScore: payload.attempt.score,
      updatedAt: FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  return NextResponse.json({ ok: true });
}
