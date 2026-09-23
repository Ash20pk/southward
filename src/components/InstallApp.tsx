"use client";

import { useEffect, useState } from "react";
import { Check, Download, Share } from "lucide-react";
import { Button } from "./ui";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** Offers "Install" where the browser supports it, and Add to Home Screen steps on iPhone and iPad. */
export function InstallApp() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInstalled(window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true);
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed)
    return (
      <p className="flex items-center gap-2 text-ok">
        <Check size={18} /> Southward is installed on this device.
      </p>
    );

  if (prompt)
    return (
      <Button
        onClick={async () => {
          await prompt.prompt();
          const { outcome } = await prompt.userChoice;
          if (outcome === "accepted") setInstalled(true);
          setPrompt(null);
        }}
      >
        <Download size={16} /> Install Southward
      </Button>
    );

  if (ios)
    return (
      <ol className="list-decimal pl-5 leading-relaxed">
        <li>
          Open Southward in <span className="font-medium">Safari</span>.
        </li>
        <li>
          Tap the Share button <Share size={15} className="inline align-[-2px]" />.
        </li>
        <li>
          Choose <span className="font-medium">Add to Home Screen</span>, then <span className="font-medium">Add</span>.
        </li>
      </ol>
    );

  return (
    <p className="leading-relaxed text-muted">
      In Chrome or Edge, use the install icon at the right of the address bar, or the browser menu&rsquo;s{" "}
      <span className="font-medium text-ink">Install Southward</span>. On Android, choose{" "}
      <span className="font-medium text-ink">Add to Home screen</span> from the menu.
    </p>
  );
}
