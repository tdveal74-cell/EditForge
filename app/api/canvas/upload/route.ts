import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE, isAuthenticated } from "@/lib/auth";
import { artifactStoreConfigured, storeArtifact } from "@/lib/artifacts";
import { getProject, saveProject } from "@/modules/canvas/server-store";
import { classifyUpload, MAX_UPLOAD_BYTES } from "@/modules/canvas/files";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(req: Request) {
  try {
    if (
      !(await isAuthenticated({
        authorization: req.headers.get("authorization"),
        sessionCookie: (await cookies()).get(SESSION_COOKIE)?.value,
      }))
    )
      return NextResponse.json(
        { error: "Sign in to save production files." },
        { status: 401 },
      );
    if (!artifactStoreConfigured())
      return NextResponse.json(
        { error: "Configure EDITFORGE_ARTIFACT_DIR to save files." },
        { status: 503 },
      );
    if (!req.body) throw new Error("No file received.");
    if (Number(req.headers.get("content-length")) > MAX_UPLOAD_BYTES + 65536)
      return NextResponse.json(
        { error: "Each file can be up to 100 MB." },
        { status: 413 },
      );
    let size = 0;
    const limited = req.body.pipeThrough(
      new TransformStream({
        transform(chunk, controller) {
          size += chunk.byteLength;
          if (size > MAX_UPLOAD_BYTES + 65536)
            throw new Error("Each file can be up to 100 MB.");
          controller.enqueue(chunk);
        },
      }),
    );
    const request = new Request(req.url, {
      method: "POST",
      headers: req.headers,
      body: limited,
      duplex: "half",
    } as RequestInit);
    const form = await request.formData();
    const file = form.get("file");
    if (
      !(file instanceof File) ||
      file.size === 0 ||
      file.size > MAX_UPLOAD_BYTES
    )
      throw new Error("Choose a non-empty file up to 100 MB.");
    const project = await getProject(String(form.get("projectId") || ""));
    if (!project) throw new Error("Save the project before uploading.");
    if (project.revision !== Number(form.get("revision")))
      throw new Error("The project changed. Reload it before uploading.");
    if (project.assets.length >= 120)
      throw new Error("This project has reached its 120 asset limit.");
    const { extension, kind } = classifyUpload(file.name);
    const bytes = new Uint8Array(await file.arrayBuffer());
    // ZIPs remain sealed files. Never extract paths or execute uploaded content.
    const stored = await storeArtifact({
      bytes,
      extension,
      prefix: `upload-${file.name.replace(/\.[^.]+$/, "").slice(0, 70)}`,
    });
    const excerpt = ["md", "txt", "srt", "vtt", "csv"].includes(extension)
      ? new TextDecoder().decode(bytes.slice(0, 4000))
      : undefined;
    const asset = {
      excerpt,
      id: `upload-${stored.sha256.slice(0, 24)}`,
      url: stored.url,
      kind,
      title: file.name.slice(0, 160),
      filename: file.name.slice(0, 240),
      mimeType: stored.contentType,
      size: stored.byteLength,
      uploaded: true,
      prompt: "Uploaded production asset",
      createdAt: Date.now(),
      aspectRatio: "16:9" as const,
    };
    const assets = project.assets.some((a) => a.id === asset.id)
      ? project.assets
      : [...project.assets, asset];
    const saved = await saveProject({ ...project, assets });
    return NextResponse.json({ project: saved, asset }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          (err as Error).message ||
          "Upload failed. Your original file is unchanged.",
      },
      { status: 409 },
    );
  }
}
