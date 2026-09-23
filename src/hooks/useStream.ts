"use client";

import { useCallback, useRef, useState } from "react";

const ERR = /\n*\[\[error:([\s\S]*?)\]\]\s*$/;

/** POSTs JSON to a streaming text route and exposes the growing text. */
export function useStream() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  const run = useCallback(async (url: string, body: unknown, onDone?: (full: string) => void) => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setText("");
    setError(null);
    setLoading(true);
    let full = "";
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) throw new Error((await res.text()) || `Request failed (${res.status})`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        full += dec.decode(value, { stream: true });
        setText(full.replace(ERR, ""));
      }
      const m = full.match(ERR);
      if (m) {
        setError(m[1]);
        full = full.replace(ERR, "");
      }
      setText(full);
      if (!m) onDone?.(full);
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      setLoading(false);
    }
    return full;
  }, []);

  const stop = useCallback(() => abort.current?.abort(), []);
  const reset = useCallback(() => {
    abort.current?.abort();
    setText("");
    setError(null);
  }, []);

  return { text, loading, error, run, stop, reset };
}
