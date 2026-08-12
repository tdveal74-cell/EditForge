import { clsx } from "clsx";
import type { ReactNode } from "react";

type Props = {
  title: string;
  /** Rendered next to the title as a quiet count — pass a number of items. */
  count?: number;
  /** Right-aligned control or note. */
  aside?: ReactNode;
  className?: string;
  children: ReactNode;
};

/** Labelled band of content. The one place section headings are styled. */
export function Section({ title, count, aside, className, children }: Props) {
  return (
    <section className={clsx("mt-12 first:mt-10", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="flex items-baseline gap-2 text-xs font-medium uppercase tracking-[0.15em] text-navy/45">
          {title}
          {count !== undefined && <span className="tabular-nums text-navy/30">{count}</span>}
        </h2>
        {aside ? <div className="text-[11px] text-navy/40">{aside}</div> : null}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}
