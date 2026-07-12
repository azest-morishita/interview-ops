import { NextResponse } from "next/server";
import { getAdminAuth } from "./firebase-admin";

export type AuthenticatedUser = {
  uid: string;
  email: string;
};

function getAllowedEmails() {
  return (process.env.ALLOWED_EMAILS || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function extractBearerToken(request: Request) {
  const authorization = request.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? "";
}

export async function requireAuthenticatedUser(
  request: Request
): Promise<{ user: AuthenticatedUser } | { response: NextResponse }> {
  const allowedEmails = getAllowedEmails();

  if (!allowedEmails.length) {
    return {
      response: NextResponse.json(
        { error: "ALLOWED_EMAILSが未設定です。許可するログインメールアドレスを設定してください。" },
        { status: 500 }
      )
    };
  }

  const token = extractBearerToken(request);
  if (!token) {
    return {
      response: NextResponse.json({ error: "ログインが必要です。" }, { status: 401 })
    };
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    const email = decoded.email?.toLowerCase();

    if (!email || !allowedEmails.includes(email)) {
      return {
        response: NextResponse.json({ error: "このメールアドレスはInterviewOpsの利用を許可されていません。" }, { status: 403 })
      };
    }

    return {
      user: {
        uid: decoded.uid,
        email
      }
    };
  } catch (error) {
    console.error(error);
    return {
      response: NextResponse.json({ error: "ログイン情報を確認できませんでした。再ログインしてください。" }, { status: 401 })
    };
  }
}
