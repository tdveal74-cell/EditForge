import { clsx } from "clsx";
import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const base =
  "w-full rounded-control border border-border bg-surface-elevated px-3 py-2 text-sm text-navy " +
  "transition-colors duration-flagship placeholder:text-navy/35 hover:border-border-strong";

/** Label wrapper so every form control in the studio sits the same way. */
export function Label({ children, text }: { children: React.ReactNode; text: string }) {
  return (
    <label className="block text-sm text-navy/70">
      <span className="text-xs font-medium uppercase tracking-wide text-navy/45">{text}</span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx(base, className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={clsx(base, "cursor-pointer", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={clsx(base, "min-h-[120px] leading-relaxed", className)} {...props} />;
}

/** Monospace result panel — the studio's one dark surface. */
export function Output({ children }: { children: React.ReactNode }) {
  return (
    <pre className="mt-6 overflow-x-auto rounded-card border border-navy-700 bg-navy p-4 text-xs leading-relaxed text-surface/90">
      {children}
    </pre>
  );
}
