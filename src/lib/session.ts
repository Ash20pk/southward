"use client";

import { create } from "zustand";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

interface Session {
  loaded: boolean;
  mode: "local" | "account";
  user: SessionUser | null;
  load: () => Promise<void>;
  setUser: (u: SessionUser | null) => void;
}

/** Who is signed in, and whether this server has accounts at all ("local" means browser-only mode). */
export const useSession = create<Session>()((set) => ({
  loaded: false,
  mode: "local",
  user: null,
  load: async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const me = await res.json();
      set({ loaded: true, mode: me.mode, user: me.user });
    } catch {
      // Offline on first load: fall back to whatever is in the browser.
      set({ loaded: true, mode: "local", user: null });
    }
  },
  setUser: (user) => set({ user }),
}));
