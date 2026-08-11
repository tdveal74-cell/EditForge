import { clsx } from "clsx";
import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({ className, variant = "primary", ...props }: Props) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center rounded-control px-4 py-2 text-sm font-medium transition-colors duration-flagship",
        variant === "primary" && "bg-navy text-surface hover:bg-navy-800",
        variant === "secondary" && "border border-border bg-surface-elevated text-navy hover:border-border-strong",
        variant === "ghost" && "text-navy/70 hover:text-navy hover:bg-surface-muted",
        className
      )}
      {...props}
    />
  );
}
