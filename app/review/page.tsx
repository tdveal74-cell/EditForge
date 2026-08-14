import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { ReviewDeck, type Note } from "./ReviewDeck";
import { PRIMARY_CLIP } from "@/lib/mediaLibrary";

export const metadata: Metadata = { title: "Review" };

// Timed against the clip below, not invented. Notes land inside the take.
const notes: Note[] = [
  {
    id: "r1",
    at: "00:00:02",
    author: "Editor",
    body: "Hold the establishing beat before the first figure crosses.",
    status: "open",
  },
  {
    id: "r2",
    at: "00:00:06",
    author: "Color",
    body: "Sodium practicals are the warm anchor — keep the grade inside the envelope.",
    status: "resolved",
  },
  {
    id: "r3",
    at: "00:00:11",
    author: "Director",
    body: "Let the reflection carry the last beat. Do not cut early.",
    status: "open",
  },
];

export default function ReviewPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
      <PageHeader
        eyebrow="Review"
        title="Frame notes"
        description="Studio QC — timestamped notes against the cut. Open notes are the work left before the rubric can be run. Click a note to seek."
      />
      <ReviewDeck notes={notes} src={PRIMARY_CLIP.src} />
    </main>
  );
}
