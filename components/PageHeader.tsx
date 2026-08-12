import type { ReactNode } from "react";

type Props = {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function PageHeader({ eyebrow, title, description, actions }: Props) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-600">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-navy">{title}</h1>
        {description ? (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-navy/65">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 gap-2">{actions}</div> : null}
    </header>
  );
}
