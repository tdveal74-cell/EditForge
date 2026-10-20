import type { ReactNode } from "react";

export function Btn({
  children,
  onClick,
  tone = "ghost",
  disabled,
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "ghost" | "copper" | "quiet";
  disabled?: boolean;
  title?: string;
}) {
  const toneClass = {
    ghost: "border border-line bg-raise text-paper hover:border-mute",
    copper: "bg-copper text-copper-ink hover:opacity-90",
    quiet: "text-mute hover:text-paper",
  }[tone];
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium transition disabled:opacity-40 ${toneClass}`}
    >
      {children}
    </button>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-mute">
      <span className="flex items-center justify-between gap-3">
        <span>{label}</span>
        <span className="tabular-nums text-paper">{value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export function Field({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  const className =
    "w-full rounded-md border border-line bg-ink px-3 py-2 text-sm text-paper outline-none focus:border-copper";
  return (
    <label className="flex flex-col gap-1 text-xs text-mute">
      <span>{label}</span>
      {multiline ? (
        <textarea className={`${className} min-h-24 resize-y`} value={value} onChange={(event) => onChange(event.target.value)} />
      ) : (
        <input className={`${className} min-h-11`} value={value} onChange={(event) => onChange(event.target.value)} />
      )}
    </label>
  );
}

export function Kicker({ children }: { children: ReactNode }) {
  return <p className="text-xs font-medium tracking-wide text-mute uppercase">{children}</p>;
}
