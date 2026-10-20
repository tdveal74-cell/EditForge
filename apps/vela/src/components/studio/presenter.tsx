import type { Look } from "@/lib/studio/model";

const BODY: Record<Look, string> = {
  ink: "bg-raise",
  paper: "bg-paper",
  lamp: "bg-ink",
};

const HEAD: Record<Look, string> = {
  ink: "bg-paper",
  paper: "bg-paper",
  lamp: "bg-copper",
};

const MOUTH: Record<Look, string> = {
  ink: "bg-ink",
  paper: "bg-copper",
  lamp: "bg-ink",
};

export function Presenter({ look, mouth, label }: { look: Look; mouth: boolean; label?: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-end pb-2">
      {label && <p className="mb-1 text-xs tracking-wide text-copper uppercase">{label}</p>}
      <div className={`relative h-[42%] w-[34%] rounded-full ${HEAD[look]}`}>
        <span className="absolute top-[34%] left-[22%] h-[8%] w-[10%] rounded-full bg-ink" />
        <span className="absolute top-[34%] right-[22%] h-[8%] w-[10%] rounded-full bg-ink" />
        <span
          className={`absolute bottom-[24%] left-1/2 w-[26%] -translate-x-1/2 rounded-full ${MOUTH[look]}`}
          style={{ height: mouth ? "16%" : "5%" }}
        />
      </div>
      <div className={`-mt-[6%] h-[36%] w-[72%] rounded-t-[40%] ${BODY[look]}`} />
    </div>
  );
}
