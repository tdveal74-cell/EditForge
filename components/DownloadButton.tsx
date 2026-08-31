"use client";

import { downloadText } from "@/lib/download";
import { Button } from "@/components/ui/button";

type Props = {
  filename: string;
  body: string;
  mime?: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
};

export function DownloadButton({ filename, body, mime, children, variant = "primary" }: Props) {
  return (
    <Button
      type="button"
      variant={variant}
      onClick={() => downloadText(filename, body, mime)}
    >
      {children}
    </Button>
  );
}
