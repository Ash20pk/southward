import type { Contrast } from "@/lib/types";

/**
 * India vs Australia, side by side. The Australia column carries the brand tint because
 * that's the answer the AMC marks as correct.
 */
export function ContrastTable({ rows, caption }: { rows: Contrast[]; caption?: string }) {
  if (!rows.length) return null;
  return (
    <div>
      {caption && <p className="mb-3 text-muted">{caption}</p>}
      {/* Wide screens: a real table. */}
      <table className="hidden w-full border-separate border-spacing-0 overflow-hidden rounded-xl border border-line md:table">
        <thead>
          <tr className="text-left text-sm">
            <th className="w-[22%] border-b border-line bg-surface px-4 py-3 font-medium text-muted">Aspect</th>
            <th className="w-[39%] border-b border-l border-line bg-sunk px-4 py-3">
              <span className="block text-base font-semibold">India (MBBS)</span>
              <span className="block font-normal text-muted">What you learn in MBBS</span>
            </th>
            <th className="w-[39%] border-b border-l border-line bg-brand-soft px-4 py-3">
              <span className="block text-base font-semibold text-brand">Australia (AMC)</span>
              <span className="block font-normal text-muted">What the exam marks as correct</span>
            </th>
          </tr>
        </thead>
        <tbody className="align-top font-serif leading-relaxed">
          {rows.map((r, i) => (
            <tr key={r.aspect + i}>
              <th scope="row" className="border-t border-line bg-surface px-4 py-3 text-left font-sans text-[0.95rem] font-medium first:border-t-0">
                {r.aspect}
              </th>
              <td className="border-l border-t border-line bg-sunk/60 px-4 py-3">{r.india}</td>
              <td className="border-l border-t border-line bg-brand-soft/60 px-4 py-3">{r.australia}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* Phones: one card per row, stacked. */}
      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map((r, i) => (
          <li key={r.aspect + i} className="overflow-hidden rounded-xl border border-line">
            <p className="bg-surface px-4 py-2.5 font-medium">{r.aspect}</p>
            <div className="border-t border-line bg-sunk/60 px-4 py-2.5">
              <p className="text-xs font-semibold text-muted">India (MBBS)</p>
              <p className="mt-0.5 font-serif leading-relaxed">{r.india}</p>
            </div>
            <div className="border-t border-line bg-brand-soft/60 px-4 py-2.5">
              <p className="text-xs font-semibold text-brand">Australia (AMC): what the exam expects</p>
              <p className="mt-0.5 font-serif leading-relaxed">{r.australia}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
