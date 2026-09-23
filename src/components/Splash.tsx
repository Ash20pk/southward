/**
 * Branded launch screen. Rendered in the server HTML while the app starts, so it appears instantly,
 * and again while an account's progress loads. Matches the installed app's native splash.
 */
export function Splash({ note }: { note?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-5 bg-[#152640] text-[#eef2f7]" role="status" aria-label="Loading Southward">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icons/icon.svg" alt="" width={112} height={112} className="splash-mark h-28 w-28 rounded-[26px] shadow-[0_12px_40px_rgba(0,0,0,0.35)]" />
      <div className="text-center">
        <p className="text-3xl font-semibold tracking-tight">Southward</p>
        {note && <p className="mt-1 text-[#b3c0d2]">{note}</p>}
      </div>
    </div>
  );
}
