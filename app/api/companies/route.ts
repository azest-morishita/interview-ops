import { createHash } from "crypto";
import { FieldValue } from "firebase-admin/firestore";
import { NextResponse } from "next/server";
import { getAdminDb } from "../../lib/firebase-admin";
import { requireAuthenticatedUser } from "../../lib/server-auth";
import type { InterviewInput, SavedCompany } from "../../types";

type SaveCompanyPayload = {
  companyId?: string;
  companyName?: string;
  input: InterviewInput;
};

function userCompaniesPath(uid: string) {
  return getAdminDb().collection("users").doc(uid).collection("companies");
}

function timestampToIso(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().toISOString();
  }

  return undefined;
}

function normalizeForSaveKey(value: string | undefined) {
  return (value || "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function makeSaveKey(companyName: string, input: InterviewInput) {
  const source = [
    normalizeForSaveKey(companyName),
    normalizeForSaveKey(input.role),
    normalizeForSaveKey(input.targetPosition)
  ].join("|");

  return createHash("sha256").update(source).digest("hex").slice(0, 28);
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

async function findExistingCompanyBySaveKey(
  companiesRef: FirebaseFirestore.CollectionReference,
  saveKey: string,
  companyName: string,
  input: InterviewInput
) {
  const exactMatch = await companiesRef.where("saveKey", "==", saveKey).limit(1).get();
  if (!exactMatch.empty) {
    return exactMatch.docs[0].ref;
  }

  // 既存バージョンで保存されたドキュメントには saveKey が無い場合があるため、
  // 直近の保存済み対策も一度だけ照合して、移行時の重複作成を避けます。
  const recent = await companiesRef.orderBy("updatedAt", "desc").limit(100).get();
  const legacyMatch = recent.docs.find((doc) => {
    const data = doc.data();
    if (!data.input) return false;
    return makeSaveKey(data.companyName || companyName, data.input) === makeSaveKey(companyName, input);
  });

  return legacyMatch?.ref || null;
}

export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) return auth.response;

  const snapshot = await userCompaniesPath(auth.user.uid).orderBy("updatedAt", "desc").limit(200).get();
  const companies = snapshot.docs.map((doc) => toSavedCompany(doc.id, doc.data()));

  return NextResponse.json({ companies });
}

export async function POST(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) return auth.response;

  const payload = (await request.json()) as SaveCompanyPayload;

  if (!payload.input) {
    return NextResponse.json({ error: "保存する面接設定がありません。" }, { status: 400 });
  }

  const companyName =
    payload.companyName?.trim() ||
    payload.input.targetPosition?.trim() ||
    "名称未設定の企業";

  const companiesRef = userCompaniesPath(auth.user.uid);
  const saveKey = makeSaveKey(companyName, payload.input);
  const now = FieldValue.serverTimestamp();

  if (payload.companyId) {
    const duplicate = await companiesRef.where("saveKey", "==", saveKey).limit(2).get();
    const duplicateDoc = duplicate.docs.find((doc) => doc.id !== payload.companyId);
    if (duplicateDoc) {
      return NextResponse.json(
        {
          error:
            "同じ企業名・職種・想定ポジションの会社別対策が既にあります。保存済み一覧から該当対策を読み込んで更新してください。"
        },
        { status: 409 }
      );
    }
  }

  const docRef = payload.companyId
    ? companiesRef.doc(payload.companyId)
    : (await findExistingCompanyBySaveKey(companiesRef, saveKey, companyName, payload.input)) || companiesRef.doc(saveKey);
  const existing = await docRef.get();

  if (payload.companyId && !existing.exists) {
    return NextResponse.json({ error: "更新対象の会社別対策が見つかりません。新規として保存し直してください。" }, { status: 404 });
  }

  await docRef.set(
    {
      saveKey,
      companyName,
      input: payload.input,
      ownerUid: auth.user.uid,
      ownerEmail: auth.user.email,
      updatedAt: now,
      ...(!existing?.exists ? { createdAt: now } : {})
    },
    { merge: true }
  );

  const saved = await docRef.get();

  return NextResponse.json({
    saveAction: existing.exists ? "updated" : "created",
    company: toSavedCompany(saved.id, saved.data() || {})
  });
}
