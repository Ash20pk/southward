"use client";

import { Cloud, CloudOff, RefreshCw, TriangleAlert } from "lucide-react";
import { useSyncStatus } from "@/hooks/useSync";

export function SyncBadge() {
  const { status } = useSyncStatus();
  const view =
    status === "saving"
      ? { icon: RefreshCw, text: "Saving…", cls: "text-muted" }
      : status === "offline"
        ? { icon: CloudOff, text: "Offline. Saved on this device", cls: "text-ochre-ink" }
        : status === "error"
          ? { icon: TriangleAlert, text: "Couldn't save. Will retry", cls: "text-bad" }
          : { icon: Cloud, text: "Synced to your account", cls: "text-muted" };
  const Icon = view.icon;
  return (
    <p className={`flex items-center gap-2 px-2 text-xs ${view.cls}`} role="status">
      <Icon size={14} className={status === "saving" ? "animate-spin" : undefined} /> {view.text}
    </p>
  );
}
