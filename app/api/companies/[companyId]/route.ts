import { NextResponse } from "next/server";
import { getAdminDb } from "../../../lib/firebase-admin";
import { requireAuthenticatedUser } from "../../../lib/server-auth";
import type { SavedCompany } from "../../../types";

type RouteContext = {
  params: Promise<{ companyId: string }>;
};

function timestampToIso(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  return undefined;
}

function toSavedCompany(id: string, data: FirebaseFirestore.DocumentData): SavedCompany {
  return {
    id,
    saveKey: data.saveKey,
    companyName: data.companyName || "名称未設定の企業",
    input: data.input,
    attemptsCount: data.attemptsCount || 0,
    latestScore: typeof data.latestScore === "number" ? data.latestScore : null,
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt)
  };
}

export async function GET(request: Request, context: RouteContext) {
  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) return auth.response;

  const { companyId } = await context.params;
  const doc = await getAdminDb()
    .collection("users")
    .doc(auth.user.uid)
    .collection("companies")
    .doc(companyId)
    .get();

  if (!doc.exists) {
    return NextResponse.json({ error: "会社別対策が見つかりません。" }, { status: 404 });
  }

  return NextResponse.json({
    company: toSavedCompany(doc.id, doc.data() || {})
  });
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) return auth.response;

  const { companyId } = await context.params;
  const db = getAdminDb();
  const docRef = db.collection("users").doc(auth.user.uid).collection("companies").doc(companyId);
  const doc = await docRef.get();

  if (!doc.exists) {
    return NextResponse.json({ error: "会社別対策が見つかりません。" }, { status: 404 });
  }

  while (true) {
    const attempts = await docRef.collection("attempts").limit(450).get();
    if (attempts.empty) break;

    const batch = db.batch();
    attempts.docs.forEach((attemptDoc) => batch.delete(attemptDoc.ref));
    await batch.commit();
  }

  await docRef.delete();

  return NextResponse.json({ ok: true });
}
