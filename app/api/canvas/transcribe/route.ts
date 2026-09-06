import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createHash } from "node:crypto";
import { isAuthenticated, SESSION_COOKIE } from "@/lib/auth";
import { durableCollection } from "@/lib/durable";
export const dynamic = "force-dynamic";
export const maxDuration = 90;
type Transcript = {
  id: string;
  createdAt: number;
  text?: string;
  pending: boolean;
  error?: string;
};
const requests = durableCollection<Transcript>({
  key: "editforge:transcripts",
  file: "canvas-transcripts.json",
  seed: () => [],
});
export async function POST(req: Request) {
  let id = "";
  try {
    if (
      !(await isAuthenticated({
        authorization: req.headers.get("authorization"),
        sessionCookie: (await cookies()).get(SESSION_COOKIE)?.value,
      }))
    )
      return NextResponse.json(
        { error: "Sign in to use voice input." },
        { status: 401 },
      );
    const key = process.env.XAI_API_KEY?.trim();
    if (!key)
      return NextResponse.json(
        { error: "Voice transcription needs XAI_API_KEY on the server." },
        { status: 503 },
      );
    if (Number(req.headers.get("content-length")) > 8_500_000)
      return NextResponse.json(
        { error: "Use an audio recording smaller than 8 MB." },
        { status: 413 },
      );
    const form = await req.formData();
    const file = form.get("audio");
    if (
      !(file instanceof File) ||
      file.size < 100 ||
      file.size > 8_000_000 ||
      !/^audio\/(webm|mp4|mpeg|ogg|wav)(;|$)/.test(file.type)
    )
      throw new Error("Record up to 60 seconds of audio, under 8 MB.");
    const bytes = await file.arrayBuffer();
    id = createHash("sha256").update(new Uint8Array(bytes)).digest("hex");
    let existing: Transcript | undefined;
    let claimed = false;
    await requests.mutate((all) => {
      claimed = false;
      existing = all.find((t) => t.id === id);
      if (existing) return;
      if (all.filter((t) => Date.now() - t.createdAt < 3600000).length >= 60)
        throw new Error(
          "The studio has reached its hourly transcription limit.",
        );
      all.push({ id, createdAt: Date.now(), pending: true });
      if (all.length > 500) all.splice(0, all.length - 500);
      claimed = true;
    });
    if (!claimed)
      return NextResponse.json(
        existing?.text
          ? { text: existing.text }
          : {
              error:
                existing?.error ||
                "This recording is still being transcribed. Try again shortly.",
            },
        { status: existing?.text ? 200 : 409 },
      );
    const upload = new FormData();
    upload.append("format", "true");
    upload.append("keyterm", "EditForge");
    upload.append(
      "file",
      new Blob([bytes], { type: file.type }),
      file.type.includes("mp4") ? "recording.m4a" : "recording.webm",
    );
    const res = await fetch("https://api.x.ai/v1/stt", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: upload,
      signal: AbortSignal.timeout(70000),
    });
    if (!res.ok)
      throw new Error(
        `Transcription returned HTTP ${res.status}. You can type your message instead.`,
      );
    const result = await res.json();
    if (typeof result.text !== "string" || !result.text.trim())
      throw new Error("No speech was detected. Try a clearer recording.");
    const text = result.text.slice(0, 6000);
    await requests.mutate((all) => {
      const t = all.find((t) => t.id === id)!;
      t.pending = false;
      t.text = text;
    });
    return NextResponse.json({ text });
  } catch (err) {
    const error = (err as Error).message;
    if (id)
      await requests.mutate((all) => {
        const t = all.find((t) => t.id === id);
        if (t) {
          t.pending = false;
          t.error = error;
        }
      });
    return NextResponse.json({ error }, { status: 409 });
  }
}
