// Geliştirici imzası
export default function Credit() {
  return (
    <div className="mt-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 backdrop-blur-md">
      <div>
        <h4 className="text-sm font-semibold text-slate-200">Auren DGS Pro Max</h4>
        <p className="mt-0.5 text-xs text-slate-400">Geliştirici &amp; Tasarımcı: <span className="font-medium text-emerald-400">Emin Uykusuz</span></p>
      </div>
      <div className="flex items-center gap-3">
        <a href="https://instagram.com/eminuyksz" target="_blank" rel="noopener noreferrer" className="rounded-xl bg-white/[0.05] px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/[0.1]">
          Instagram: @eminuyksz
        </a>
        <a href="https://github.com/EminUykusuz" target="_blank" rel="noopener noreferrer" className="rounded-xl bg-white/[0.05] px-3 py-1.5 text-xs text-slate-300 transition hover:bg-white/[0.1]">
          GitHub: Emin Uykusuz
        </a>
      </div>
    </div>
  );
}
