"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Send, Sparkles } from "lucide-react";
import { useStore, type ChatMsg } from "@/lib/store";
import { useStream } from "@/hooks/useStream";
import { Markdown } from "@/components/Markdown";
import { Button } from "@/components/ui";

const STARTERS = [
  "I'm starting from zero. What should I study first for the AMC?",
  "How is chest pain managed differently in an Australian ED compared with India?",
  "Explain Gillick competence with an example the AMC might use",
  "Make me a one-week plan for revising child health",
  "Quiz me on antibiotic choices for community-acquired pneumonia in Australia",
  "What is the PBS, and why does it matter in exam questions?",
];

export default function TutorPage() {
  return (
    <Suspense>
      <Tutor />
    </Suspense>
  );
}

function Tutor() {
  const params = useSearchParams();
  const messages = useStore((s) => s.tutor);
  const setMessages = useStore((s) => s.setTutor);
  const markStudied = useStore((s) => s.markStudied);
  const ai = useStream();
  const [input, setInput] = useState(() => {
    const about = params.get("about");
    return about ? `Teach me the most important things about ${about} for the AMC.` : "";
  });
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, ai.text]);

  const send = (text: string) => {
    const t = text.trim();
    if (!t || ai.loading) return;
    const next: ChatMsg[] = [...messages, { role: "user", content: t }];
    setMessages(next);
    setInput("");
    ai.run("/api/tutor", { messages: next }, (reply) => {
      setMessages([...next, { role: "assistant", content: reply }]);
      ai.reset();
      markStudied();
    });
  };

  return (
    <div className="mx-auto flex min-h-[calc(100dvh-8rem)] max-w-3xl flex-col">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Ask the tutor</h1>
          <p className="mt-2 text-muted">Any question, however basic. It teaches to Australian guidelines and flags where India does it differently.</p>
        </div>
        {messages.length > 0 && (
          <Button variant="quiet" size="sm" onClick={() => setMessages([])}>
            New conversation
          </Button>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-6">
        {messages.length === 0 && !ai.loading && (
          <div>
            <p className="mb-3 flex items-center gap-2 font-medium">
              <Sparkles size={16} className="text-ochre-ink" /> Try one of these
            </p>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {STARTERS.map((s) => (
                <li key={s}>
                  <button onClick={() => send(s)} className="h-full w-full rounded-xl border border-line bg-surface p-4 text-left hover:border-brand">
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {messages.map((m, i) =>
          m.role === "user" ? (
            <p key={i} className="max-w-[85%] self-end whitespace-pre-wrap rounded-2xl bg-brand px-4 py-2.5 text-brand-ink">
              {m.content}
            </p>
          ) : (
            <div key={i} className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
              <Markdown>{m.content}</Markdown>
            </div>
          ),
        )}
        {ai.loading && (
          <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
            {ai.text ? <Markdown className="caret">{ai.text}</Markdown> : <p className="text-muted">Thinking…</p>}
          </div>
        )}
        {ai.error && <p className="text-bad">{ai.error}</p>}
        <div ref={end} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="sticky bottom-16 mt-6 bg-paper pb-4 pt-2 lg:bottom-0"
      >
        <div className="flex items-end gap-2 rounded-3xl border border-line bg-surface p-2 focus-within:border-brand">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={2}
            placeholder="Ask anything. Shift+Enter for a new line."
            className="flex-1 resize-none bg-transparent px-3 py-2 outline-none"
          />
          <Button type="submit" className="h-11 w-11 shrink-0 px-0" aria-label="Send" disabled={!input.trim() || ai.loading}>
            <Send size={17} />
          </Button>
        </div>
      </form>
    </div>
  );
}
