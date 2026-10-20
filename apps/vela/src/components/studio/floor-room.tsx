import { useState } from "react";
import { Btn, Kicker } from "@/components/studio/controls";
import type { FloorSeat } from "@/lib/studio/floor";
import { useStudio } from "@/lib/studio/store";

const ORDERS = ["Rebuild the piece", "Tighten the script", "Pull captions", "Pull the board", "Block a shot", "Drop the score"];

const SEAT: Record<FloorSeat, string> = {
  floor: "Floor",
  script: "Script",
  cut: "Cut",
  board: "Board",
  stage: "Stage",
  score: "Score",
};

export function FloorRoom() {
  const log = useStudio((state) => state.floorLog);
  const seat = useStudio((state) => state.floorSeat);
  const busy = useStudio((state) => state.floorBusy);
  const runFloor = useStudio((state) => state.runFloor);
  const [order, setOrder] = useState("Rebuild the piece");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-3 md:p-6">
      <div>
        <h1 className="font-display text-4xl">Floor</h1>
        <p className="mt-2 max-w-xl text-pretty text-mute">
          One agent holds the floor and grants it to a single seat. The rules ship with the app. No model and no account.
        </p>
      </div>
      <p className="text-sm text-paper">
        {busy ? `${SEAT[seat]} has the floor.` : seat === "floor" ? "The floor is open." : `${SEAT[seat]} yielded.`}
      </p>
      <label className="flex flex-col gap-1 text-xs text-mute">
        Order
        <textarea
          value={order}
          onChange={(event) => setOrder(event.target.value)}
          rows={2}
          className="rounded-md border border-line bg-ink px-3 py-2 text-sm text-paper outline-none focus:border-copper"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {ORDERS.map((item) => (
          <Btn key={item} tone={order === item ? "copper" : "ghost"} onClick={() => setOrder(item)}>
            {item}
          </Btn>
        ))}
      </div>
      <Btn tone="copper" disabled={busy} onClick={() => void runFloor(order)}>
        {busy ? "On the floor" : "Grant the floor"}
      </Btn>
      <Kicker>Call sheet</Kicker>
      {log.length === 0 && <p className="text-sm text-mute">No grants yet.</p>}
      <ol className="flex flex-col gap-2">
        {log.map((mark, index) => (
          <li key={mark.id} className="rounded-md border border-line px-3 py-2">
            <span className="text-xs text-copper">
              {index + 1}. {SEAT[mark.seat]}
            </span>
            <span className="mt-1 block text-sm text-paper">{mark.grant}</span>
            <span className="mt-1 block text-xs text-mute">{mark.yielded ? mark.note : "Has the floor."}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
