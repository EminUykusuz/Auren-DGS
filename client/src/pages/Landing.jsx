import { useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Flame, Target, Trophy, GraduationCap, ArrowRight } from 'lucide-react';
import Logo from '../components/Logo.jsx';
import JsonLd from '../components/JsonLd.jsx';
import LegalLinks from '../components/LegalLinks.jsx';
import { SITE, DEFAULT_DESC } from '../hooks/useSEO.js';
import { net, fmt } from '../lib/api.js';
import { EST, partMax, partNet, approxScore } from '../lib/estimate.js';
import '../landing.css';

gsap.registerPlugin(ScrollTrigger);

/* Landing, giriş sonrası panelle aynı dili konuşur: koyu cam yüzeyler, zümrüt/camgöbeği vurgu, aynı ışıma katmanı.
   Gösterilen ekran parçaları örnek veridir; panelin gerçek bileşenlerinin görünümünü taşır. Animasyonlar GSAP ile. */

const MAIL = import.meta.env.VITE_CONTACT_EMAIL || '';
const wrap = 'mx-auto w-full max-w-[1200px] px-5 md:px-8';
const fmtTr = (n, d = 0) => n.toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d });
const glow = (n) => `radial-gradient(closest-side, rgb(var(--glow-${n}) / var(--glow-${n}-o)), rgb(var(--glow-${n}) / 0))`;

const FAQ = [
  ['Fiyat', 'Auren Study ücretsiz mi?', 'Evet. Hesap açmak ve bireysel özelliklerin tümünü kullanmak ücretsizdir.'],
  ['Hibrit', 'İkisine birden hazırlanabilir miyim?', 'Kayıtta hibrit hesabı seç. DGS ve YKS modüllerini birlikte açar; üst çubuktan tek dokunuşla geçersin. Verilerin her sınav için ayrı tutulur.'],
  ['LGS', 'LGS’ye de hazırlanabilir miyim?', 'Evet. LGS hesabında 90 soruluk altı dersli deneme girişi, 3 yanlışın 1 doğruyu götürdüğü net hesabı, müfredat ve geri sayım hazırdır. LGS hesabı DGS ve YKS ile karışmaz.'],
  ['Geçiş', 'Sınav türümü sonra değiştirebilir miyim?', 'DGS, YKS ve hibrit arasında Ayarlar sayfasından geçebilirsin; mevcut verilerin silinmez. LGS ayrı bir hesap türüdür.'],
  ['Netler', 'TYT ve AYT netlerim karışır mı?', 'Karışmaz. Karşılaştırma ve trend grafikleri TYT ile AYT için ayrı çalışır.'],
  ['Arkadaş', 'Arkadaşlarımla nasıl yarışırım?', 'Kullanıcı adıyla arkadaş ekle. Haftalık puan; seçili sınavdaki çalışma süren, çözdüğün soru sayısı ve deneme netlerinden oluşur.'],
  ['Puan', 'Puan tahmini kesin mi?', 'Hayır; yaklaşık bir göstergedir. Gerçek puan, sınavın zorluğuna ve adayların genel başarısına göre ÖSYM ya da MEB tarafından hesaplanır.'],
  ['Dershane', 'Dershane olarak kullanabilir miyiz?', 'Evet. Kurum paneliyle logonuzla markalı giriş sayfası, sınıflar, Excel’den toplu öğrenci ekleme, haftalık ödev (Excel olarak indirilir) ve sınıf değiştirme önerisi alırsınız. Öğrenci hesaplarını siz açarsınız.'],
];

const LD = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Organization', '@id': `${SITE}/#org`, name: 'Auren Study', url: `${SITE}/`, logo: `${SITE}/favicon.svg` },
    { '@type': 'WebSite', '@id': `${SITE}/#site`, url: `${SITE}/`, name: 'Auren Study', inLanguage: 'tr-TR', publisher: { '@id': `${SITE}/#org` } },
    { '@type': 'WebApplication', name: 'Auren Study', url: `${SITE}/`, description: DEFAULT_DESC, applicationCategory: 'EducationalApplication', operatingSystem: 'Web', inLanguage: 'tr-TR',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'TRY' }, publisher: { '@id': `${SITE}/#org` } },
    { '@type': 'FAQPage', mainEntity: FAQ.map(([, q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
  ],
};

const PARTS = [['DGS', EST.DGS.parts.DGS], ['TYT', EST.YKS.parts.TYT], ['AYT', EST.YKS.parts.AYT], ['LGS', EST.LGS.parts.LGS]];

/* ---- Kart yüzeyi: panelin .card sınıfı ---- */
const Card = ({ className = '', children, ...p }) => <div className={`card ${className}`} {...p}>{children}</div>;
const Label = ({ children }) => <div className="stat-label">{children}</div>;

/* ---- Hero'daki panel parçası (örnek veri) ---- */
const TREND = [62.5, 68, 71.25, 74.5, 78.5];
const pts = (vals, w, h, lo = 55, hi = 90) => vals.map((v, i) => [(i * w) / (vals.length - 1), h - ((v - lo) / (hi - lo)) * h]);

function MiniTrend() {
  const p = pts(TREND, 320, 110); const d = p.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${(y + 6).toFixed(1)}`).join(' ');
  return (
    <svg viewBox="0 0 320 128" className="h-[128px] w-full" role="img" aria-label="Net trendi: son beş denemede 62,5’ten 78,5’e yükseliş">
      <defs><linearGradient id="ln-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="rgb(var(--accent))" stopOpacity=".28" /><stop offset="1" stopColor="rgb(var(--accent))" stopOpacity="0" /></linearGradient></defs>
      {[0, 1, 2, 3].map(i => <line key={i} x1="0" x2="320" y1={10 + i * 36} y2={10 + i * 36} stroke="rgb(var(--fg) / .07)" />)}
      <path d={`${d} L320 128 L0 128 Z`} fill="url(#ln-area)" data-area />
      <path d={d} fill="none" stroke="rgb(var(--accent))" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" data-draw />
      {p.map(([x, y], i) => <circle key={i} cx={x} cy={y + 6} r={i === p.length - 1 ? 4.5 : 3} fill={i === p.length - 1 ? 'rgb(var(--cyan2))' : 'rgb(var(--bg))'} stroke="rgb(var(--accent))" strokeWidth="2" data-dot />)}
    </svg>
  );
}

function Mock() {
  const stats = [
    [Flame, 'text-accent', 'Bu hafta', 14.5, 1, ' sa', '63 soru'],
    [Target, 'text-cyan2', 'Ortalama net', 74.4, 1, '', 'Son 5 deneme'],
    [Trophy, 'text-amber-300', 'En iyi net', 78.5, 1, '', 'TYT'],
    [GraduationCap, 'text-accent', 'Müfredat', 62, 0, '', 'Tamamlanan konular'],
  ];
  const subj = [['Matematik', 72], ['Türkçe', 58], ['Fen Bilimleri', 41]];
  return (
    <div className="relative" style={{ perspective: 1400 }} data-tilt>
      <Card className="!p-4 sm:!p-5" data-mock style={{ transformStyle: 'preserve-3d' }}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5"><Logo size={22} /><span className="text-sm font-semibold text-slate-100">Panel</span></div>
          <div className="inline-flex rounded-full border border-white/10 bg-white/[0.04] p-0.5 text-[11px] font-bold">
            <span className="rounded-full bg-accent px-3 py-1 text-onaccent">TYT</span><span className="px-3 py-1 text-slate-400">AYT</span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {stats.map(([Icon, tone, label, val, dec, unit, sub]) => (
            <div key={label} className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3">
              <div className="flex items-center justify-between"><span className="stat-label !text-[10px]">{label}</span><Icon size={14} className={tone} /></div>
              <div className="mt-1.5 text-xl font-semibold tracking-tight text-slate-50 num"><span data-count={val} data-dec={dec}>{fmtTr(val, dec)}</span>{unit}</div>
              <div className="mt-0.5 text-[10.5px] text-slate-400">{sub}</div>
            </div>))}
        </div>
        <div className="mt-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3.5">
          <div className="mb-1 flex items-baseline justify-between"><Label>Net trendi · son 5 deneme</Label><span className="num text-xs text-accent">+16,0 net</span></div>
          <MiniTrend />
        </div>
        <div className="mt-3 grid gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3.5">
          <Label>Konu ilerlemesi</Label>
          {subj.map(([n, v], i) => (
            <div key={n}>
              <div className="mb-1 flex justify-between text-xs"><span className="text-slate-200">{n}</span><span className="num text-slate-400">%{v}</span></div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div data-bar className={`h-full rounded-full ${i === 1 ? 'bg-cyan2' : 'bg-accent'}`} style={{ width: `${v}%` }} /></div>
            </div>))}
        </div>
      </Card>
      <p className="mt-3 text-center text-[11px] text-slate-500">Örnek veriyle panelden bir görünüm</p>
    </div>
  );
}

/* ---- Canlı net hesabı ---- */
function Calc() {
  const [k, setK] = useState(0);
  const [ans, setAns] = useState({});
  const [label, def] = PARTS[k];
  const div = def.div ?? 4;
  const set = (name, max, key, raw) => {
    const v = Math.max(0, Math.min(max, parseInt(raw, 10) || 0));
    setAns(p => {
      const id = `${label}.${name}`, cur = { c: 0, w: 0, ...p[id], [key]: v };
      if (cur.c + cur.w > max) { if (key === 'c') cur.w = max - cur.c; else cur.c = max - cur.w; }
      return { ...p, [id]: cur };
    });
  };
  const mine = Object.fromEntries(def.sections.map(([n]) => [n, ans[`${label}.${n}`] ?? { c: 0, w: 0 }]));
  const total = partNet(def.sections, mine, div), max = partMax(def.sections);
  return (
    <section className="py-20 md:py-28" id="hesapla" aria-labelledby="calc-h">
      <div className={`${wrap} grid items-start gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14`}>
        <div data-reveal>
          <p className="stat-label mb-4 !text-accent">Net hesabı</p>
          <h2 id="calc-h" className="text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-slate-50 md:text-5xl">Kendi netini şimdi hesapla.</h2>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-slate-400">Doğru ve yanlış sayını yaz. {div === 3 ? 'Her üç yanlış bir doğruyu götürür' : 'Her dört yanlış bir doğruyu götürür'}; Auren Study bunu senin yerine hesaplar, yaklaşık puanı da gösterir.</p>
          <div className="mt-7 inline-flex rounded-full border border-white/10 bg-white/[0.04] p-1" role="tablist" aria-label="Sınav bölümü">
            {PARTS.map(([l], i) => (
              <button key={l} role="tab" type="button" aria-selected={k === i} onClick={() => setK(i)}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${k === i ? 'bg-accent text-onaccent' : 'text-slate-400 hover:text-slate-200'}`}>{l}</button>))}
          </div>
        </div>
        <Card className="!p-0 overflow-hidden" data-reveal>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-white/[0.07] text-left">
              <th scope="col" className="th !pb-3 pl-5 pt-4">Bölüm</th><th scope="col" className="th w-24 !pb-3 pt-4">Doğru</th><th scope="col" className="th w-24 !pb-3 pt-4">Yanlış</th><th scope="col" className="th !pb-3 pr-5 pt-4 text-right">Net</th>
            </tr></thead>
            <tbody>{def.sections.map(([name, m]) => {
              const a = mine[name];
              return (
                <tr key={name} className="border-t border-white/[0.06]">
                  <td className="py-2.5 pl-5 pr-2 text-slate-100">{name}<span className="block text-[11px] text-slate-500">{m} soru</span></td>
                  <td className="py-2 pr-2"><input type="number" inputMode="numeric" min={0} max={m} value={a.c || ''} placeholder="0" aria-label={`${name} doğru`} onChange={e => set(name, m, 'c', e.target.value)} className="!rounded-xl !px-3 !py-2 num" /></td>
                  <td className="py-2 pr-2"><input type="number" inputMode="numeric" min={0} max={m - a.c} value={a.w || ''} placeholder="0" aria-label={`${name} yanlış`} onChange={e => set(name, m, 'w', e.target.value)} className="!rounded-xl !px-3 !py-2 num" /></td>
                  <td className="num py-2.5 pr-5 text-right font-semibold text-slate-50">{fmt(net(a.c, a.w, div))}</td>
                </tr>);
            })}</tbody>
          </table>
          <div className="flex items-center justify-between gap-4 border-t border-white/[0.08] bg-white/[0.03] px-5 py-4" aria-live="polite">
            <div><div className="stat-label">Toplam net / {max}</div><div className="mt-0.5 text-xs text-slate-400">Yaklaşık puan {total > 0 ? fmt(Math.round(approxScore(total, max) * 10) / 10) : '—'}</div></div>
            <div className="stat-value !text-4xl text-accent">{fmt(total)}</div>
          </div>
        </Card>
      </div>
    </section>
  );
}

/* ---- Özellikler: panelin gerçek bileşenlerinden örnekler ---- */
function Ring() {
  const r = 38, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 100 100" className="h-28 w-28 -rotate-90" aria-hidden="true">
      <circle cx="50" cy="50" r={r} fill="none" stroke="rgb(var(--fg) / .1)" strokeWidth="7" />
      <circle cx="50" cy="50" r={r} fill="none" stroke="rgb(var(--accent))" strokeWidth="7" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * 0.28} data-ring={c} />
    </svg>
  );
}

function Sheet() {
  const rows = 6, cols = 5, filled = { 0: 1, 1: 3, 2: 0, 3: 3, 4: 2, 5: 4 };
  return (
    <svg viewBox="0 0 180 112" className="w-full max-w-[260px]" aria-hidden="true">
      {Array.from({ length: rows }).map((_, r) => Array.from({ length: cols }).map((__, c) => (
        <circle key={`${r}${c}`} cx={14 + c * 22} cy={12 + r * 18} r="6" fill={filled[r] === c ? 'rgb(var(--cyan2))' : 'none'} stroke="rgb(var(--fg) / .28)" strokeWidth="1.4" data-bubble={filled[r] === c ? 'on' : undefined} />
      )))}
      {Array.from({ length: rows }).map((_, r) => <text key={r} x="140" y={16 + r * 18} fontSize="9" fill="rgb(var(--fg) / .35)" fontFamily="Inter, sans-serif">{r + 1}</text>)}
    </svg>
  );
}

function Features() {
  const reasons = [['Dikkat', 12], ['İşlem', 9], ['Formül', 6], ['Konu', 4], ['Süre', 3]];
  const topics = [['Üslü ifadeler', 82, 'bg-accent'], ['Problemler', 64, 'bg-cyan2'], ['Paragraf', 48, 'bg-amber-300'], ['Geometri', 31, 'bg-red-400']];
  const friends = [['ayse.k', 412, true], ['sen', 388, false], ['mert_41', 355, true]];
  return (
    <section className="py-20 md:py-28" id="ozellikler" aria-labelledby="feat-h">
      <div className={wrap}>
        <div className="mb-12 max-w-2xl" data-reveal>
          <p className="stat-label mb-4 !text-accent">Özellikler</p>
          <h2 id="feat-h" className="text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-slate-50 md:text-5xl">Denemeni gir, gerisini panel yapsın.</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-6" data-stagger>
          <Card className="md:col-span-3 md:row-span-2" data-item>
            <Label>Hata nedeni</Label>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-50">Her yanlışın bir nedeni var.</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">Yanlışına nedenini işaretle: dikkat, işlem, formül, konu ya da süre. Hangisinde puan kaybettiğini sayılarla görürsün.</p>
            <div className="mt-6 grid gap-3">
              {reasons.map(([n, v]) => (
                <div key={n}><div className="mb-1 flex justify-between text-xs"><span className="text-slate-200">{n}</span><span className="num text-slate-400">{v} yanlış</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/10"><div data-bar className="h-full rounded-full bg-accent" style={{ width: `${(v / 12) * 100}%`, opacity: 0.45 + (v / 12) * 0.55 }} /></div></div>))}
            </div>
          </Card>
          <Card className="md:col-span-3" data-item>
            <Label>Konu gücü</Label>
            <div className="mt-4 grid gap-3">
              {topics.map(([n, v, c], i) => (
                <div key={n} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-sm text-slate-200">{n}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10"><div data-bar className={`h-full rounded-full ${c}`} style={{ width: `${v}%` }} /></div>
                  <span className="num w-9 text-right text-xs text-slate-400">%{v}</span>
                  {i === topics.length - 1 && <span className="badge bg-red-500/15 text-red-300">Önce bu</span>}
                </div>))}
            </div>
            <p className="mt-4 text-sm text-slate-400">Hangi konuya ne zaman dönmen gerektiği, zayıftan güçlüye sıralanır.</p>
          </Card>
          <Card className="md:col-span-3" data-item>
            <div className="flex items-center justify-between gap-4">
              <div><Label>Zamanlayıcı</Label><p className="mt-2 text-sm leading-relaxed text-slate-400">Pomodoro ile çalış; her oturum kaydedilir, haftalık süren panelde görünür.</p></div>
              <div className="relative shrink-0"><Ring /><div className="num absolute inset-0 grid place-items-center text-lg font-semibold text-slate-50">25:00</div></div>
            </div>
          </Card>
          <Card className="md:col-span-2" data-item>
            <Label>Geri sayım</Label>
            <div className="mt-3 flex items-baseline gap-2"><span className="stat-value !text-5xl text-accent" data-count="47">47</span><span className="text-sm text-slate-400">gün kaldı</span></div>
            <p className="mt-2 text-sm text-slate-400">Sınava kalan süre tek ekranda.</p>
          </Card>
          <Card className="md:col-span-2" data-item>
            <Label>Arkadaşlar</Label>
            <ul className="mt-3 divide-y divide-white/[0.06] text-sm">
              {friends.map(([u, p], i) => (
                <li key={u} className="flex items-center justify-between py-2"><span className={u === 'sen' ? 'font-semibold text-accent' : 'text-slate-100'}><span className="num mr-2 text-slate-500">{i + 1}</span>@{u}</span><span className="num text-slate-300">{p}</span></li>))}
            </ul>
          </Card>
          <Card className="md:col-span-2" data-item>
            <Label>Kurumlar</Label>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">Sınıflar, öğretmenler, haftalık ödev ve Excel çıktısı. Aşağıda dershaneler için bölüm var.</p>
            <a href="#dershane" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-accent">Kurum paneli <ArrowRight size={14} /></a>
          </Card>
        </div>
        <Card className="mt-4 grid items-center gap-6 md:grid-cols-[minmax(0,1fr)_auto]" data-reveal>
          <div>
            <span className="badge bg-cyan2/15 text-cyan2">Yakında</span>
            <h3 className="mt-3 text-xl font-semibold tracking-tight text-slate-50">Optik okuyucu desteği</h3>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-400">Dershanenin optik okuyucu çıktısını yükle; doğru ve yanlış sayıların tek tek girmeden deneme olarak işlensin.</p>
          </div>
          <Sheet />
        </Card>
      </div>
    </section>
  );
}

/* ---- Nasıl çalışır: kaydırdıkça dolan çizgi ---- */
const STEPS = [
  ['Sınavını seç', 'DGS, YKS ya da LGS; istersen DGS ile YKS birlikte. Panel, müfredat ve istatistikler buna göre açılır.'],
  ['Denemeni kaydet', 'Doğru ve yanlışını gir, hata nedenini işaretle. Analiz kendiliğinden oluşur.'],
  ['Süreni say', 'Zamanlayıcıyla çalışma oturumların kaydedilir; haftalık ilerlemen görünür.'],
  ['Gelişimini izle', 'Trendini takip et, zayıf konunu bul, arkadaşlarınla haftalık sırada yarış.'],
];

function How() {
  return (
    <section className="py-20 md:py-28" id="nasil" aria-labelledby="how-h">
      <div className={`${wrap} grid gap-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16`}>
        <div className="lg:sticky lg:top-28 lg:self-start" data-reveal>
          <p className="stat-label mb-4 !text-accent">Nasıl çalışır</p>
          <h2 id="how-h" className="text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-slate-50 md:text-5xl">Dört adımda hazırlık.</h2>
          <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-slate-400">Kayıt birkaç saniye sürer. Kredi kartı istemez, süre sınırı yoktur.</p>
        </div>
        <ol className="relative grid gap-12 pl-10" data-steps>
          <span className="absolute bottom-2 left-[11px] top-2 w-px bg-white/10" aria-hidden="true" />
          <span className="absolute bottom-2 left-[11px] top-2 w-px origin-top bg-accent" data-line-fill aria-hidden="true" />
          {STEPS.map(([t, d], i) => (
            <li key={t} className="ln-step relative" data-step>
              <span className="dot absolute -left-10 top-0.5 grid h-6 w-6 place-items-center rounded-full border-2 bg-obsidian text-[10px] font-bold text-slate-300 num">{i + 1}</span>
              <h3 className="text-2xl font-semibold tracking-tight text-slate-50">{t}</h3>
              <p className="mt-2 max-w-lg text-[15px] leading-relaxed text-slate-400">{d}</p>
            </li>))}
        </ol>
      </div>
    </section>
  );
}

/* ---- Dershane: satış bölümü ---- */
function Kurum() {
  const [f, setF] = useState({ kurum: '', ad: '', sayi: '100-300' });
  const send = (e) => {
    e.preventDefault();
    const body = `Kurum: ${f.kurum}\nYetkili: ${f.ad}\nÖğrenci sayısı: ${f.sayi}\n\nAuren Study kurum paneli hakkında bilgi almak istiyoruz.`;
    window.location.href = MAIL ? `mailto:${MAIL}?subject=${encodeURIComponent('Kurum paneli: ' + f.kurum)}&body=${encodeURIComponent(body)}` : 'https://instagram.com/eminuyksz';
  };
  const set = (k) => (e) => setF(s => ({ ...s, [k]: e.target.value }));
  const list = [
    ['Logonuzla markalı giriş', 'Kurumunuzun adresi, logosu ve rengiyle öğrenci giriş sayfası.'],
    ['Excel ile toplu öğrenci', 'Listeyi yapıştırın; hesaplar ve giriş bilgileri tek seferde oluşur, tek tıkla yazdırılır.'],
    ['Sınıflar ve öğretmenler', 'Öğretmen yalnızca kendi sınıflarını görür. Sınıf değiştirme önerisi alırsınız.'],
    ['Haftalık ödev', 'Sınıfa konu ve hedef verin, öğrenciler işaretlesin. Takip ve sonuç Excel olarak iner.'],
  ];
  return (
    <section className="py-20 md:py-28" id="dershane" aria-labelledby="ct-h">
      <div className={wrap}>
        <Card className="!p-6 md:!p-10" data-reveal>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14">
            <div>
              <p className="stat-label mb-4 !text-accent">Dershaneler için</p>
              <h2 id="ct-h" className="text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-slate-50 md:text-5xl">Kurum paneli.</h2>
              <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-slate-400">Öğrenci hesaplarını siz açarsınız; öğrenciler yalnızca kendi kurumlarındakilerle görünür.</p>
              <ul className="mt-8 grid gap-5 sm:grid-cols-2" data-stagger>
                {list.map(([t, d]) => (
                  <li key={t} data-item className="border-t border-white/10 pt-4"><b className="text-[15px] font-semibold text-slate-100">{t}</b><p className="mt-1 text-sm leading-relaxed text-slate-400">{d}</p></li>))}
              </ul>
            </div>
            <form onSubmit={send} className="grid content-start gap-3 rounded-3xl border border-white/[0.08] bg-white/[0.03] p-5 md:p-6">
              <h3 className="text-lg font-semibold tracking-tight text-slate-50">Bilgi isteyin</h3>
              <input required placeholder="Kurum adı" aria-label="Kurum adı" value={f.kurum} onChange={set('kurum')} autoComplete="organization" />
              <input required placeholder="Yetkili adı soyadı" aria-label="Yetkili adı soyadı" value={f.ad} onChange={set('ad')} autoComplete="name" />
              <select aria-label="Öğrenci sayısı" value={f.sayi} onChange={set('sayi')}><option>100’den az</option><option>100-300</option><option>300-1000</option><option>1000’den fazla</option></select>
              <button className="btn btn-shine mt-1 !py-3" type="submit">Bilgi iste</button>
              <p className="text-xs text-slate-500">{MAIL ? 'E-posta uygulaman hazır bir mesajla açılır.' : 'Instagram üzerinden bize ulaşırsın.'}</p>
            </form>
          </div>
        </Card>
      </div>
    </section>
  );
}

function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <section className="py-20 md:py-28" id="sss" aria-labelledby="faq-h">
      <div className={`${wrap} grid gap-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16`}>
        <div data-reveal>
          <p className="stat-label mb-4 !text-accent">SSS</p>
          <h2 id="faq-h" className="text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-slate-50 md:text-5xl">Sık sorulan sorular.</h2>
        </div>
        <div className="divide-y divide-white/[0.08] border-y border-white/[0.08]" data-reveal>
          {FAQ.map(([, q, a], i) => (
            <div key={q}>
              <h3><button type="button" aria-expanded={open === i} aria-controls={`fq-${i}`} onClick={() => setOpen(open === i ? -1 : i)}
                className="flex w-full items-center justify-between gap-6 py-5 text-left text-[17px] font-medium text-slate-100 transition hover:text-accent">
                <span>{q}</span><span className={`ln-pm text-xl text-slate-400 ${open === i ? 'is-open' : ''}`} aria-hidden="true">+</span></button></h3>
              <div className="ln-faq-a" id={`fq-${i}`} role="region" data-open={open === i}><div><p className="max-w-2xl pb-5 text-[15px] leading-relaxed text-slate-400">{a}</p></div></div>
            </div>))}
        </div>
      </div>
    </section>
  );
}

export default function Landing() {
  const root = useRef(null);

  useLayoutEffect(() => {
    const el = root.current; if (!el) return;
    const mm = gsap.matchMedia();
    const ctx = gsap.context(() => {
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        // Hero: satırlar maskeden yükselir, ardından panel gelir
        const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
        tl.from('[data-line]', { yPercent: 115, duration: 1.05, stagger: 0.12 })
          .from('[data-hero-fade]', { y: 20, opacity: 0, duration: 0.8, stagger: 0.09 }, '-=0.65')
          .from('[data-mock]', { y: 56, opacity: 0, duration: 1.1 }, '-=1');

        // Panel parçası: çizgi çizilir, sayılar sayılır, çubuklar dolar
        el.querySelectorAll('[data-mock] [data-draw]').forEach(p => {
          const L = p.getTotalLength(); gsap.set(p, { strokeDasharray: L, strokeDashoffset: L });
          tl.to(p, { strokeDashoffset: 0, duration: 1.5, ease: 'power2.inOut' }, 0.9);
        });
        tl.from('[data-mock] [data-area]', { opacity: 0, duration: 1.2 }, 1.6).from('[data-mock] [data-dot]', { scale: 0, transformOrigin: '50% 50%', duration: 0.4, stagger: 0.18 }, 1.1);
        tl.from('[data-mock] [data-bar]', { width: '0%', duration: 1.1, stagger: 0.12, ease: 'power2.out' }, 1.2);
        el.querySelectorAll('[data-count]').forEach(n => {
          const to = parseFloat(n.dataset.count), dec = +(n.dataset.dec || 0), o = { v: 0 }; n.textContent = fmtTr(0, dec);
          const inMock = !!n.closest('[data-mock]');
          gsap.to(o, { v: to, duration: 1.7, ease: 'power2.out', delay: inMock ? 1 : 0, scrollTrigger: inMock ? undefined : { trigger: n, start: 'top 90%', once: true }, onUpdate: () => { n.textContent = fmtTr(o.v, dec); } });
        });

        // Kaydırma: panel hafif geride kalır
        gsap.to('[data-mock]', { yPercent: -5, ease: 'none', scrollTrigger: { trigger: '[data-hero]', start: 'top top', end: 'bottom top', scrub: true } });

        // Bölümler
        gsap.utils.toArray('[data-reveal]').forEach(n => gsap.from(n, { y: 34, opacity: 0, duration: 0.95, ease: 'power3.out', scrollTrigger: { trigger: n, start: 'top 88%', once: true } }));
        gsap.utils.toArray('[data-stagger]').forEach(box => gsap.from(box.querySelectorAll('[data-item]'), { y: 40, opacity: 0, duration: 0.85, stagger: 0.09, ease: 'power3.out', scrollTrigger: { trigger: box, start: 'top 84%', once: true } }));
        gsap.utils.toArray('[data-stagger] [data-bar]').forEach(b => gsap.from(b, { width: '0%', duration: 1.1, ease: 'power2.out', scrollTrigger: { trigger: b, start: 'top 92%', once: true } }));
        gsap.from('[data-ring]', { strokeDashoffset: (i, t) => +t.dataset.ring, duration: 1.6, ease: 'power2.out', scrollTrigger: { trigger: '[data-ring]', start: 'top 90%', once: true } });
        gsap.from('[data-bubble="on"]', { scale: 0, transformOrigin: '50% 50%', duration: 0.5, stagger: 0.14, ease: 'back.out(2.2)', scrollTrigger: { trigger: '[data-bubble="on"]', start: 'top 92%', once: true } });

        // Adımlar: çizgi kaydırdıkça dolar, aktif adım yanar
        gsap.fromTo('[data-line-fill]', { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: '[data-steps]', start: 'top 62%', end: 'bottom 72%', scrub: true } });
        gsap.utils.toArray('[data-step]').forEach(s => ScrollTrigger.create({ trigger: s, start: 'top 66%', onEnter: () => s.classList.add('is-on'), onLeaveBack: () => s.classList.remove('is-on') }));

        // Panel imleci hafifçe izler (yalnızca fare olan cihazlarda)
        const tilt = el.querySelector('[data-tilt]');
        if (tilt && window.matchMedia('(pointer: fine)').matches) {
          const rx = gsap.quickTo('[data-mock]', 'rotationX', { duration: 0.8, ease: 'power3' }), ry = gsap.quickTo('[data-mock]', 'rotationY', { duration: 0.8, ease: 'power3' });
          const mv = (e) => { const b = tilt.getBoundingClientRect(); ry(((e.clientX - b.left) / b.width - 0.5) * 6); rx(-((e.clientY - b.top) / b.height - 0.5) * 5); };
          const lv = () => { rx(0); ry(0); };
          tilt.addEventListener('pointermove', mv); tilt.addEventListener('pointerleave', lv);
          return () => { tilt.removeEventListener('pointermove', mv); tilt.removeEventListener('pointerleave', lv); };
        }
      });
      mm.add('(prefers-reduced-motion: reduce)', () => { el.querySelectorAll('[data-step]').forEach(s => s.classList.add('is-on')); gsap.set('[data-line-fill]', { scaleY: 1 }); });
    }, el);
    const t = setTimeout(() => ScrollTrigger.refresh(), 400);
    return () => { clearTimeout(t); mm.revert(); ctx.revert(); };
  }, []);

  return (
    <div className="ln relative min-h-screen overflow-x-clip" ref={root}>
      <JsonLd data={LD} />
      <div aria-hidden="true" className="ambient-layer pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="ambient-glow absolute inset-0 bg-gradient-to-tr from-emerald-500/[0.06] via-transparent to-cyan-500/[0.06]" />
        <div className="ambient-glow absolute left-[-12%] top-[-14%] h-[720px] w-[720px]" style={{ background: glow('a') }} />
        <div className="ambient-glow absolute bottom-[-18%] right-[-10%] h-[800px] w-[800px]" style={{ background: glow('b') }} />
        <div className="ambient-glow absolute left-[30%] top-[35%] h-[560px] w-[560px]" style={{ background: glow('c') }} />
      </div>
      <a href="#ana" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-onaccent">İçeriğe geç</a>

      <header className="fixed inset-x-0 top-3 z-40 px-3 md:top-4">
        <div className="glass-pill mx-auto flex max-w-[1100px] items-center justify-between gap-4 py-2 pl-4 pr-2 md:pl-5">
          <Link to="/" className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-slate-50" aria-label="Auren Study ana sayfa"><Logo size={26} />Auren Study</Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Ana menü">
            {[['#hesapla', 'Net hesabı'], ['#ozellikler', 'Özellikler'], ['#dershane', 'Dershaneler'], ['#sss', 'SSS']].map(([h, l]) => <a key={h} href={h} className="rounded-full px-3.5 py-1.5 text-sm text-slate-300 transition hover:bg-white/[0.07] hover:text-slate-50">{l}</a>)}
          </nav>
          <div className="flex items-center gap-1.5"><Link to="/giris" className="btn-ghost !py-1.5">Giriş</Link><Link to="/kayit" className="btn !py-1.5">Kayıt ol</Link></div>
        </div>
      </header>

      <main id="ana">
        <section className="relative pb-16 pt-32 md:pb-24 md:pt-40" aria-labelledby="hero-h" data-hero>
          <div className={`${wrap} grid items-center gap-14 lg:grid-cols-[minmax(0,6fr)_minmax(0,6fr)] lg:gap-10`}>
            <div>
              <p className="badge mb-6 border border-white/10 bg-white/[0.05] text-slate-300" data-hero-fade>DGS · YKS · LGS</p>
              <h1 id="hero-h" className="text-[clamp(2.9rem,7.4vw,5.9rem)] font-semibold leading-[0.96] tracking-[-0.04em] text-slate-50">
                <span className="block overflow-hidden pb-[0.08em]"><span className="block" data-line>Denemelerin</span></span>
                <span className="block overflow-hidden pb-[0.08em]"><span className="block text-accent" data-line>konuşuyor.</span></span>
              </h1>
              <p className="mt-6 max-w-[34rem] text-[17px] leading-relaxed text-slate-400" data-hero-fade>Denemelerini kaydet; Auren Study her yanlışın nedenini, her konunun gücünü ve haftalık ilerlemeni gösterir. Ücretsiz.</p>
              <div className="mt-8 flex flex-wrap items-center gap-3" data-hero-fade>
                <Link to="/kayit" className="btn btn-shine !px-6 !py-3 !text-[15px]">Ücretsiz başla <ArrowRight size={16} /></Link>
                <a href="#hesapla" className="btn-ghost !px-5 !py-3 !text-[15px]">Netini hesapla</a>
              </div>
            </div>
            <Mock />
          </div>
        </section>

        <Calc />
        <Features />
        <How />
        <Kurum />
        <Faq />

        <section className="pb-24 pt-10 md:pb-32" aria-labelledby="cta-h">
          <div className={wrap}>
            <Card className="!px-6 !py-14 text-center md:!py-20" data-reveal>
              <h2 id="cta-h" className="mx-auto max-w-2xl text-4xl font-semibold leading-[1.04] tracking-[-0.03em] text-slate-50 md:text-6xl">Hesabını aç, sınavını seç.</h2>
              <p className="mx-auto mt-5 max-w-md text-[15px] text-slate-400">Panelin birkaç saniyede hazır. Kredi kartı yok, süre sınırı yok.</p>
              <Link to="/kayit" className="btn btn-shine mt-8 !px-7 !py-3.5 !text-base">Ücretsiz hesap aç <ArrowRight size={17} /></Link>
            </Card>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.07] py-10">
        <div className={`${wrap} grid gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-start`}>
          <div>
            <div className="flex items-center gap-2.5 text-[15px] font-semibold text-slate-50"><Logo size={24} />Auren Study</div>
            <p className="mt-2 max-w-sm text-sm text-slate-400">DGS, YKS ve LGS hazırlığı için çalışma ve deneme takip sistemi.</p>
          </div>
          <ul className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-300">
            <li><Link to="/giris" className="hover:text-accent">Giriş yap</Link></li><li><Link to="/kayit" className="hover:text-accent">Kayıt ol</Link></li><li><a href="#dershane" className="hover:text-accent">Dershaneler için</a></li>
            <li><LegalLinks /></li>
          </ul>
        </div>
        <p className={`${wrap} mt-8 text-xs text-slate-500`}>
          Geliştirici &amp; tasarımcı: <a href="https://github.com/EminUykusuz" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300">Emin Uykusuz</a> · <a href="https://instagram.com/eminuyksz" target="_blank" rel="noopener noreferrer" className="hover:text-slate-300">@eminuyksz</a>
        </p>
      </footer>
    </div>
  );
}
