"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ArrowLeft, FileText, Trash2, Upload } from "lucide-react";
import { topicName } from "@/lib/content";
import { useStore, type CustomCard } from "@/lib/store";
import { Bar, Button, Chip, PageHeader, Panel } from "@/components/ui";
import { SCANNED_MAX_BYTES, chunkPages, fileSize, isPdf, looksScanned, pageRange, readPdf, toBase64 } from "@/lib/pdf";

type Draft = { front: string; back: string; topic: string; keep: boolean };
type Stage = { kind: "pick" } | { kind: "reading"; done: number; total: number; label: string } | { kind: "review" };

const CHUNK_CHARS = 24_000; // per AI request
const MAX_CHUNKS = 12; // about 150 pages of dense notes per upload
const DENSITY = { fewer: 1600, standard: 900, more: 550 } as const; // characters of text per card
type Density = keyof typeof DENSITY;

export default function ImportPdf() {
  const router = useRouter();
  const addDeck = useStore((s) => s.addDeck);
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [density, setDensity] = useState<Density>("standard");
  const [focus, setFocus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [stage, setStage] = useState<Stage>({ kind: "pick" });
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [error, setError] = useState<string | null>(null);

  const choose = (f: File | undefined) => {
    if (!f) return;
    if (!isPdf(f)) return setError("Choose a PDF file.");
    setError(null);
    setFile(f);
    setName(f.name.replace(/\.pdf$/i, ""));
  };

  const ask = async (body: object) => {
    const res = await fetch("/api/cards-from-pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Couldn't make cards (${res.status}).`);
    return data.cards as Omit<Draft, "keep">[];
  };

  const run = async () => {
    if (!file) return;
    setError(null);
    setStage({ kind: "reading", done: 0, total: 1, label: "Reading the PDF…" });
    try {
      const { totalPages, pages } = await readPdf(file);
      const { a, b } = pageRange(totalPages, from, to);
      const picked = pages.slice(a - 1, b);
      const out: Omit<Draft, "keep">[] = [];

      if (looksScanned(picked)) {
        // Little or no text layer: a scanned PDF. Let the model read the pages directly.
        if (file.size > SCANNED_MAX_BYTES) throw new Error("This looks like a scanned PDF and it's too large to read. Split it into files under 3 MB, or export it with selectable text.");
        setStage({ kind: "reading", done: 0, total: 1, label: "Reading scanned pages…" });
        out.push(...(await ask({ pdfBase64: toBase64(await file.arrayBuffer()), filename: file.name, count: Math.min(40, Math.max(8, picked.length * 3)), focus })));
      } else {
        // Group pages into chunks so each request carries a manageable amount of text.
        const chunks = chunkPages(picked, a, CHUNK_CHARS);
        if (chunks.length > MAX_CHUNKS) throw new Error(`That's a lot of material (pages ${a} to ${b}). Choose a page range of about ${Math.round(((b - a + 1) * MAX_CHUNKS) / chunks.length)} pages at a time.`);
        for (let i = 0; i < chunks.length; i++) {
          setStage({ kind: "reading", done: i, total: chunks.length, label: `Writing cards from part ${i + 1} of ${chunks.length}…` });
          const count = Math.min(40, Math.max(5, Math.round(chunks[i].length / DENSITY[density])));
          out.push(...(await ask({ text: chunks[i], filename: file.name, count, focus })));
        }
      }

      // Drop near-duplicate questions across chunks.
      const seen = new Set<string>();
      const unique = out.filter((c) => {
        const key = c.front.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 60);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      if (!unique.length) throw new Error("No flashcards could be made from this PDF. Is it medical study material?");
      setDrafts(unique.map((c) => ({ ...c, keep: true })));
      setStage({ kind: "review" });
    } catch (e) {
      setError((e as Error).message);
      setStage({ kind: "pick" });
    }
  };

  const save = () => {
    const id = Date.now().toString(36);
    const cards: CustomCard[] = drafts
      .filter((d) => d.keep && d.front.trim() && d.back.trim())
      .map((d, i) => ({ id: `cu-${id}-${i + 1}`, front: d.front.trim(), back: d.back.trim(), topic: d.topic }));
    addDeck({ id, name: name.trim() || "My deck", source: file?.name ?? "", createdAt: Date.now(), cards });
    router.push("/flashcards");
  };

  const kept = drafts.filter((d) => d.keep).length;
  const edit = (i: number, patch: Partial<Draft>) => setDrafts((ds) => ds.map((d, k) => (k === i ? { ...d, ...patch } : d)));

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/flashcards" className="mb-5 inline-flex items-center gap-1.5 text-muted hover:text-ink">
        <ArrowLeft size={16} /> Flashcards
      </Link>
      <PageHeader
        title="Make cards from a PDF"
        lede="Upload your own notes, a guideline or lecture slides. The AI writes exam-focused flashcards from them, you check them, and they join your review deck."
      />

      {stage.kind === "pick" && (
        <Panel>
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              choose(e.dataTransfer.files[0]);
            }}
            className={clsx(
              "flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors",
              file ? "border-brand bg-brand-soft/50" : "border-line hover:border-brand",
            )}
          >
            {file ? <FileText size={28} className="text-brand" /> : <Upload size={28} className="text-muted" />}
            <span className="font-medium">{file ? file.name : "Choose a PDF, or drop it here"}</span>
            <span className="text-sm text-muted">{file ? `${fileSize(file.size)}. Tap to change.` : "Text PDFs of any length; scanned PDFs up to 3 MB"}</span>
          </button>
          <input ref={fileInput} type="file" accept="application/pdf,.pdf" hidden onChange={(e) => choose(e.target.files?.[0])} />

          {file && (
            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-sm text-muted">Deck name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl border border-line bg-surface px-3 outline-none focus:border-brand" />
              </label>
              <fieldset className="sm:col-span-2">
                <legend className="mb-2 text-sm text-muted">How many cards</legend>
                <div className="flex flex-wrap gap-2">
                  {(["fewer", "standard", "more"] as Density[]).map((d) => (
                    <Chip key={d} active={density === d} onClick={() => setDensity(d)}>
                      {d === "fewer" ? "Fewer, key facts only" : d === "standard" ? "Standard" : "More detail"}
                    </Chip>
                  ))}
                </div>
              </fieldset>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm text-muted">Pages (optional)</span>
                <span className="flex items-center gap-2">
                  <input value={from} onChange={(e) => setFrom(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="From" className="h-11 w-full min-w-0 rounded-xl border border-line bg-surface px-3 outline-none focus:border-brand" />
                  <span className="text-muted">to</span>
                  <input value={to} onChange={(e) => setTo(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="To" className="h-11 w-full min-w-0 rounded-xl border border-line bg-surface px-3 outline-none focus:border-brand" />
                </span>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm text-muted">Focus on (optional)</span>
                <input value={focus} onChange={(e) => setFocus(e.target.value)} placeholder="e.g. drug doses, red flags" className="h-11 rounded-xl border border-line bg-surface px-3 outline-none focus:border-brand" />
              </label>
            </div>
          )}

          {error && (
            <p role="alert" className="mt-5 rounded-xl bg-bad-soft px-4 py-3 text-bad">
              {error}
            </p>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button onClick={run} disabled={!file}>
              Make flashcards
            </Button>
            <span className="text-sm text-muted">
              Your PDF is read in your browser and only its text goes to the AI. Scanned PDFs have no text, so those are sent whole.
            </span>
          </div>
        </Panel>
      )}

      {stage.kind === "reading" && (
        <Panel>
          <p className="font-semibold">{stage.label}</p>
          <Bar value={stage.total ? (stage.done / stage.total) * 100 : 0} className="mt-4" />
          <p className="mt-3 text-sm text-muted">This takes about 20 to 40 seconds per part. Keep this page open.</p>
        </Panel>
      )}

      {stage.kind === "review" && (
        <div>
          <div className="sticky top-14 z-10 -mx-4 mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur lg:top-0">
            <p>
              <span className="font-semibold">{kept}</span> <span className="text-muted">of {drafts.length} cards selected</span>
            </p>
            <div className="flex gap-2">
              <Button variant="quiet" size="sm" onClick={() => setStage({ kind: "pick" })}>
                Start over
              </Button>
              <Button size="sm" onClick={save} disabled={!kept}>
                Save {kept} cards
              </Button>
            </div>
          </div>
          <p className="mb-4 text-sm text-muted">Check each card against your source. Edit anything that&rsquo;s off, and untick cards you don&rsquo;t want.</p>
          <ol className="flex flex-col gap-3">
            {drafts.map((d, i) => (
              <li key={i} className={clsx("rounded-2xl border bg-surface p-4", d.keep ? "border-line" : "border-dashed border-line opacity-60")}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={d.keep} onChange={(e) => edit(i, { keep: e.target.checked })} className="h-4 w-4 accent-[var(--brand)]" />
                    <span>
                      Card {i + 1}
                      {d.topic && <span className="text-muted">, {topicName(d.topic)}</span>}
                    </span>
                  </label>
                  <button aria-label="Remove card" onClick={() => setDrafts((ds) => ds.filter((_, k) => k !== i))} className="rounded-full p-1.5 text-muted hover:bg-sunk hover:text-bad">
                    <Trash2 size={15} />
                  </button>
                </div>
                <textarea
                  value={d.front}
                  onChange={(e) => edit(i, { front: e.target.value })}
                  rows={2}
                  aria-label={`Card ${i + 1} question`}
                  className="w-full resize-y rounded-xl border border-line bg-paper px-3 py-2 font-medium outline-none focus:border-brand"
                />
                <textarea
                  value={d.back}
                  onChange={(e) => edit(i, { back: e.target.value })}
                  rows={3}
                  aria-label={`Card ${i + 1} answer`}
                  className="mt-2 w-full resize-y rounded-xl border border-line bg-paper px-3 py-2 font-serif outline-none focus:border-brand"
                />
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
