import { NextResponse } from "next/server";

export async function GET() {
  const hasServerKey = Boolean(
    process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
  );
  return NextResponse.json({
    status: "ok",
    hasServerKey,
    timestamp: new Date().toISOString(),
  });
}
