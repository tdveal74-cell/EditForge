"use client";

import { useEffect, useState } from "react";

type InstallPrompt = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaInstall() {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    function ready(event: Event) {
      event.preventDefault();
      setPrompt(event as InstallPrompt);
    }
    window.addEventListener("beforeinstallprompt", ready);
    return () => window.removeEventListener("beforeinstallprompt", ready);
  }, []);

  if (!prompt) return null;
  return (
    <button
      type="button"
      className="pwa-install"
      onClick={async () => {
        await prompt.prompt();
        await prompt.userChoice;
        setPrompt(null);
      }}
    >
      Install mobile app
    </button>
  );
}

