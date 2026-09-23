import { MBBS } from "@/lib/content";

export function PostingSelect({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const phases = [...new Set(MBBS.map((s) => s.phase))];
  return (
    <select className={className} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Not set</option>
      {phases.map((p) => (
        <optgroup key={p} label={p}>
          {MBBS.filter((s) => s.phase === p).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
