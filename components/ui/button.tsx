import { clsx } from "clsx";
import type { ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "accent";
  size?: "sm" | "md" | "lg";
};

export function Button({ className, variant = "primary", size = "md", ...props }: Props) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-control font-medium transition-all duration-flagship ease-flagship",
        "active:translate-y-px disabled:pointer-events-none disabled:opacity-45",
        size === "sm" && "px-3 py-1.5 text-xs",
        size === "md" && "px-4 py-2 text-sm",
        size === "lg" && "px-5 py-2.5 text-sm",
        variant === "primary" && "bg-navy text-surface shadow-card hover:bg-navy-800 hover:shadow-lifted",
        variant === "secondary" &&
          "border border-border bg-surface-elevated text-navy hover:border-border-strong hover:shadow-card",
        variant === "ghost" && "text-navy/70 hover:bg-surface-muted hover:text-navy",
        variant === "accent" && "bg-amber text-navy shadow-card hover:bg-amber-600 hover:shadow-lifted",
        className
      )}
      {...props}
    />
  );
}
