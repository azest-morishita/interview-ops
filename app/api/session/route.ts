import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "../../lib/server-auth";

export async function GET(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  if ("response" in auth) return auth.response;

  return NextResponse.json({
    user: auth.user
  });
}
