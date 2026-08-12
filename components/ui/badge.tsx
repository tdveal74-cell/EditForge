import { clsx } from "clsx";
import type { HTMLAttributes } from "react";

type Props = HTMLAttributes<HTMLSpanElement> & {
  tone?: "neutral" | "outline" | "accent" | "quiet";
};

export function Badge({ className, tone = "neutral", ...props }: Props) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em]",
        tone === "neutral" && "bg-surface-muted text-navy/70",
        tone === "outline" && "border border-border-strong text-navy/60",
        tone === "accent" && "bg-amber-50 text-amber-700",
        tone === "quiet" && "text-navy/40",
        className
      )}
      {...props}
    />
  );
}
