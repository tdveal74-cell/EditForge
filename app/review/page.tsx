import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { ReviewDeck, type Note } from "./ReviewDeck";

export const metadata: Metadata = { title: "Review" };

const notes: Note[] = [
  { id: "r1", at: "00:01:12", author: "Editor", body: "Trim breath before VO.", status: "open" },
  { id: "r2", at: "00:04:40", author: "Color", body: "Hold grade inside envelope.", status: "resolved" },
  { id: "r3", at: "00:09:58", author: "Director", body: "Still hold longer on end.", status: "open" },
];

export default function ReviewPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <PageHeader
        eyebrow="Review"
        title="Frame notes"
        description="Studio QC — timestamped notes against the cut. Open notes are the work left before the rubric can be run."
      />
      <ReviewDeck notes={notes} />
    </main>
  );
}
