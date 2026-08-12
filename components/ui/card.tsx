import { clsx } from "clsx";
import type { HTMLAttributes } from "react";

type Props = HTMLAttributes<HTMLDivElement> & {
  interactive?: boolean;
};

export function Card({ className, interactive = false, ...props }: Props) {
  return (
    <div
      className={clsx(
        "rounded-card border border-border bg-surface-elevated shadow-card",
        interactive &&
          "transition-all duration-flagship ease-flagship hover:-translate-y-0.5 hover:border-border-strong hover:shadow-lifted",
        className
      )}
      {...props}
    />
  );
}
