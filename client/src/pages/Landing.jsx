import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, BarChart3, CalendarCheck, Layers, Moon, Plus, ShieldCheck, Sun, Target, Users } from 'lucide-react';
import { useExam } from '../store.js';
import { useTheme } from '../theme.js';
import ModeSwitch from '../components/ModeSwitch.jsx';
import { net, fmt } from '../lib/api.js';
import { REASONS } from '../lib/reasons.js';
import JsonLd from '../components/JsonLd.jsx';
import { SITE, DEFAULT_DESC } from '../hooks/useSEO.js';
import LegalLinks from '../components/LegalLinks.jsx';
import { EST, partMax, partNet, approxScore, blendYks } from '../lib/estimate.js';

/* Landing: uygulamanın panel diliyle aynı — cam kartlar, tema değişkenleri, seçili sınava göre vurgu rengi. */

const SAMPLE = {
  DGS: { title: 'DGS denemesi', rows: [['Matematik', 38, 6], ['Türkçe', 41, 5]] },
  YKS: { title: 'TYT denemesi', rows: [['Türkçe', 31, 6], ['Sosyal Bilimler', 15, 3], ['Temel Matematik', 28, 8], ['Fen Bilimleri', 12, 4]] },
};

function SampleCard() {
  const mode = useExam(s => s.mode); const { title, rows } = SAMPLE[mode];
  const total = rows.reduce((s, [, c, w]) => s + net(c, w), 0);
  return (
    <div className="card !p-6">
      <div className="mb-4 flex items-center justify-between"><span className="text-sm font-semibold text-slate-100">{title}</span><span className="badge bg-white/[0.06] text-slate-400">Örnek</span></div>
      <ul>{rows.map(([n, c, w]) => (
        <li key={n} className="row grid grid-cols-[1fr_auto_4.5rem] items-baseline gap-3 py-3 text-sm">
          <span className="text-slate-300">{n}</span><span className="num text-xs text-slate-500">{c} D · {w} Y</span><b className="num text-right text-base text-slate-50">{fmt(net(c, w))}</b>
        </li>))}</ul>
      <div className="mt-3 flex items-baseline justify-between rounded-2xl bg-accent/15 px-4 py-3.5">
        <span className="text-sm font-medium text-slate-200">Toplam net</span><b className="num text-3xl font-semibold tracking-tight text-accent">{fmt(total)}</b>
      </div>
    </div>
  );
}

const Reveal = ({ children, delay = 0, className }) => (
  <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '0px 0px -8% 0px' }} transition={{ duration: 0.6, delay, ease: [0.2, 0.7, 0.2, 1] }} className={className}>{children}</motion.div>
);

const Section = ({ id, title, lead, children, className }) => (
  <section id={id} className={clsx('mx-auto w-full max-w-6xl px-4 py-16 md:py-24', className)}>
    <Reveal className="mb-10 max-w-2xl">
      <h2 className="text-3xl font-semibold tracking-tight text-slate-50 md:text-4xl">{title}</h2>
      {lead && <p className="mt-3 text-base text-slate-400">{lead}</p>}
    </Reveal>
    <Reveal delay={0.08}>{children}</Reveal>
  </section>
);

/* ---------- Net ve puan tahmini ---------- */
function Estimator() {
  const mode = useExam(s => s.mode);
  const [part, setPart] = useState({ DGS: 'DGS', YKS: 'TYT' });
  const [ans, setAns] = useState({});
  const partKey = part[mode], def = EST[mode].parts[partKey];
  const set = (name, max, key, raw) => {
    const v = Math.max(0, Math.min(max, parseInt(raw, 10) || 0));
    setAns(p => {
      const cur = { c: 0, w: 0, ...(p[`${partKey}.${name}`]) }; cur[key] = v;
      if (cur.c + cur.w > max) { if (key === 'c') cur.w = max - cur.c; else cur.c = max - cur.w; }
      return { ...p, [`${partKey}.${name}`]: cur };
    });
  };
  const answersOf = (k) => Object.fromEntries(Object.entries(ans).filter(([x]) => x.startsWith(k + '.')).map(([x, v]) => [x.slice(k.length + 1), v]));
  const calc = (k, sections) => { const n = partNet(sections, answersOf(k)), m = partMax(sections); return { n, m, score: approxScore(n, m) }; };
  const cur = useMemo(() => calc(partKey, def.sections), [ans, partKey, mode]);
  const tyt = calc('TYT', EST.YKS.parts.TYT.sections), ayt = calc('AYT', EST.YKS.parts.AYT.sections);
  const blend = mode === 'YKS' && tyt.n > 0 && ayt.n > 0 ? blendYks(tyt.score, ayt.score) : null;
  const reset = () => setAns(p => Object.fromEntries(Object.entries(p).filter(([x]) => !x.startsWith(partKey + '.'))));

  return (
    <div className="card !p-0 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] p-5">
        <div className="flex flex-wrap items-center gap-3">
          <ModeSwitch local compact />
          {mode === 'YKS' && (
            <div role="tablist" aria-label="Bölüm" className="flex gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1">
              {Object.entries(EST.YKS.parts).map(([id, p]) => (
                <button key={id} role="tab" aria-selected={partKey === id} onClick={() => setPart(s => ({ ...s, YKS: id }))}
                  className={clsx('rounded-full px-4 py-1.5 text-xs font-bold transition', partKey === id ? 'bg-white/10 text-slate-50' : 'text-slate-400 hover:text-slate-200')}>{p.label}</button>))}
            </div>)}
        </div>
        <button type="button" onClick={reset} className="text-xs text-slate-400 underline-offset-4 transition hover:text-slate-100 hover:underline">Sıfırla</button>
      </div>
      <div className="grid md:grid-cols-[1.4fr_1fr]">
        <div className="p-5">
          <div className="mb-2 grid grid-cols-[1fr_5rem_5rem_4rem] items-end gap-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <span>Bölüm</span><span>Doğru</span><span>Yanlış</span><span className="text-right">Net</span>
          </div>
          {def.sections.map(([name, max]) => {
            const a = ans[`${partKey}.${name}`] ?? { c: 0, w: 0 };
            return (
              <div key={name} className="row grid grid-cols-[1fr_5rem_5rem_4rem] items-center gap-3 py-2.5">
                <div><div className="text-sm text-slate-200">{name}</div><div className="text-[11px] text-slate-500">{max} soru</div></div>
                <input type="number" inputMode="numeric" min={0} max={max} value={a.c || ''} placeholder="0" aria-label={`${name} doğru`} onChange={e => set(name, max, 'c', e.target.value)} className="num !px-3 !py-2 text-center" />
                <input type="number" inputMode="numeric" min={0} max={max - a.c} value={a.w || ''} placeholder="0" aria-label={`${name} yanlış`} onChange={e => set(name, max, 'w', e.target.value)} className="num !px-3 !py-2 text-center" />
                <b className="num text-right text-sm text-slate-100">{fmt(net(a.c, a.w))}</b>
              </div>);
          })}
        </div>
        <div className="flex flex-col justify-between gap-6 border-t border-white/[0.06] bg-accent/[0.06] p-6 md:border-l md:border-t-0">
          <div aria-live="polite">
            <div className="stat-label">Toplam net · {def.label}</div>
            <div className="num mt-1 text-5xl font-semibold tracking-tight text-slate-50">{fmt(cur.n)}<span className="ml-2 text-base font-medium text-slate-500">/ {cur.m}</span></div>
            <div className="stat-label mt-6">Tahmini puan</div>
            <div className="num mt-1 text-4xl font-semibold tracking-tight text-accent">{cur.n > 0 ? fmt(Math.round(cur.score * 10) / 10) : '—'}</div>
            {blend !== null && <p className="mt-4 text-sm text-slate-300">TYT ve AYT birlikte yaklaşık <b className="num text-slate-50">{fmt(Math.round(blend * 10) / 10)}</b> yerleştirme puanı.</p>}
          </div>
          <p className="text-xs leading-relaxed text-slate-500">Tahmin 100–500 ölçeğinde yaklaşık bir göstergedir. Gerçek puan, sınavın zorluğuna ve adayların genel başarısına göre hesaplanır.</p>
        </div>
      </div>
    </div>
  );
}

const FEATURES = [
  [Layers, 'Gerçek hibrit mimari', 'DGS ve YKS aynı çatı altında ama ayrı çalışma alanlarında yaşar. Denemeler, müfredat, geri sayım ve sıralama her sınava özgüdür; birbirine karışmaz.'],
  [BarChart3, 'Bölüm bazlı deneme analizi', 'DGS, TYT ve AYT denemelerini bölüm bölüm kaydet. Trend grafikleri ve karşılaştırmalar yalnızca aynı bölümün sonuçları arasında yapılır.'],
  [Target, 'Hata nedeni analizi', 'Yanlışlarını dikkat, işlem, formül, konu ve süre gibi nedenlere ayır. Hangi hatayı en çok, hangi derste yaptığını net biçimde gör.'],
  [ShieldCheck, 'Konu güç analizi', 'Çözdüğün sorular ve sonuçların konu bazında değerlendirilir; hangi konuya, ne zaman dönmen gerektiği sana söylenir.'],
  [Users, 'Arkadaşlarınla rekabet', 'Seçili sınavda haftalık puan sıralaması ve yüz yüze karşılaştırma. Seninle aynı sınava hazırlananlarla yarışırsın.'],
  [CalendarCheck, 'Çalışma planlayıcı', 'Zamanlayıcı ve pomodoro oturumların kaydedilir; haftalık ilerlemeni ve sınava kalan süreyi tek ekrandan izlersin.'],
];

const TIPS = {
  dikkat: 'Soruyu yanlış okumak ya da seçeneği karıştırmak. Çözüm: soru kökünü işaretleyerek oku.',
  islem: 'Yöntem doğru, hesap yanlış. Çözüm: işlemleri kâğıda düzenli dök, hızdan önce doğruluğu oturt.',
  konu: 'Konu henüz oturmamış. Müfredattan çalışılacak yer belli.',
  sure: 'Bilgi var ama zaman yetmedi. Hız çalışmasının zamanı.',
  formul: 'Formül hafızada değil. Kişisel bir formül kartı hazırlamanın tam zamanı.',
  diger: 'Sınıflandırılamayan hatalar.',
};
const SAMPLE_ERR = { dikkat: 5, islem: 4, formul: 3, konu: 3, sure: 2, diger: 1 };

// Uygulamadaki "Neden yanlış yaptım?" ekranının canlı örneği
function WhyDemo() {
  const [sel, setSel] = useState('dikkat');
  const total = Object.values(SAMPLE_ERR).reduce((a, b) => a + b, 0);
  const cur = REASONS.find(r => r.key === sel);
  return (
    <div className="card !p-6">
      <div className="mb-5 flex flex-wrap gap-2" role="tablist" aria-label="Yanlış nedenleri">
        {REASONS.map(r => (
          <motion.button key={r.key} type="button" role="tab" aria-selected={sel === r.key} whileTap={{ scale: 0.94 }} onClick={() => setSel(r.key)}
            className={clsx('rounded-full border px-4 py-2 text-sm transition', sel === r.key ? 'border-white/30 bg-white/15 text-slate-50' : 'border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10')}>
            <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: r.color }} />{r.label}
          </motion.button>))}
      </div>
      <div className="flex h-14 gap-1 overflow-hidden rounded-2xl" aria-hidden="true">
        {REASONS.map(r => (
          <motion.div key={r.key} layout animate={{ flexGrow: sel === r.key ? SAMPLE_ERR[r.key] * 2 : SAMPLE_ERR[r.key], opacity: sel === r.key ? 1 : 0.4 }} transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            style={{ background: r.color, flexBasis: 0 }} className="flex items-center justify-center text-sm font-bold text-onaccent">{SAMPLE_ERR[r.key]}</motion.div>))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p key={sel} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="mt-5 min-h-[3.5rem] text-base text-slate-200">
          <strong className="text-slate-50">{cur.label}:</strong> {TIPS[sel]} <span className="text-slate-500">(Örnek veri: {total} yanlış)</span>
        </motion.p>
      </AnimatePresence>
    </div>
  );
}

const TRACK_CARDS = [
  ['DGS', 'DGS hesabı', ['Matematik ve Türkçe denemeleri', 'DGS müfredatı ve konu analizi', 'DGS geri sayımı ve sıralaması']],
  ['YKS', 'YKS hesabı', ['TYT ve AYT denemeleri ayrı ayrı', 'YKS müfredatı ve konu analizi', 'YKS geri sayımı ve sıralaması']],
  ['BOTH', 'Hibrit hesap', ['İki sınavın tüm modülleri bir arada', 'Tek dokunuşla DGS ⇄ YKS geçişi', 'Veriler ayrı kalır, hiçbir şey karışmaz']],
];

const STEPS = [
  ['1', 'Sınavını seç', 'Kayıt sırasında DGS, YKS ya da hibrit hesabı seç. Panel, müfredat ve istatistikler buna göre açılır.'],
  ['2', 'Denemeni ve çalışmanı kaydet', 'Doğru ve yanlışlarını gir, hata nedenlerini işaretle; analiz otomatik oluşur.'],
  ['3', 'Gelişimini izle', 'Trendini takip et, zayıf konularını bul ve arkadaşlarınla haftalık sıralamada yarış.'],
];

const FAQ = [
  ['Auren ücretsiz mi?', 'Evet. Hesap açmak ve tüm özellikleri kullanmak ücretsizdir.'],
  ['Hem DGS hem YKS için hazırlanıyorum, ne yapmalıyım?', 'Kayıtta hibrit hesabı seç. İki sınavın modüllerini birlikte açar; üst çubuktan tek dokunuşla geçersin. Verilerin her sınav için ayrı tutulur.'],
  ['Sonradan sınav türümü değiştirebilir miyim?', 'Evet. Ayarlar sayfasından DGS, YKS ya da hibrit arasında geçiş yapabilirsin. Mevcut verilerin silinmez.'],
  ['TYT ve AYT netlerim karışır mı?', 'Karışmaz. Karşılaştırma ve trend grafikleri TYT ile AYT için ayrı çalışır.'],
  ['Arkadaşlarımla nasıl yarışırım?', 'Kullanıcı adıyla arkadaş ekle. Haftalık puan; seçili sınavdaki çalışma süren, çözdüğün soru sayısı ve deneme netlerinden oluşur.'],
  ['Puan tahmini kesin mi?', 'Hayır; yaklaşık bir göstergedir. Gerçek puan, sınavın zorluğuna ve adayların genel başarısına göre ÖSYM tarafından hesaplanır.'],
];

function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <div className="grid gap-3">{FAQ.map(([q, a], i) => (
      <div key={q} className="card !rounded-3xl !p-0">
        <button type="button" aria-expanded={open === i} aria-controls={`fa-${i}`} onClick={() => setOpen(open === i ? -1 : i)}
          className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-base font-medium text-slate-100">
          <span>{q}</span><Plus size={18} className={clsx('flex-none text-slate-400 transition-transform', open === i && 'rotate-45')} />
        </button>
        <AnimatePresence initial={false}>
          {open === i && <motion.div id={`fa-${i}`} role="region" initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }} className="overflow-hidden"><p className="px-5 pb-5 text-sm leading-relaxed text-slate-400">{a}</p></motion.div>}
        </AnimatePresence>
      </div>))}</div>
  );
}

const LD = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Organization', '@id': `${SITE}/#org`, name: 'Auren Study', url: `${SITE}/`, logo: `${SITE}/favicon.svg` },
    { '@type': 'WebSite', '@id': `${SITE}/#site`, url: `${SITE}/`, name: 'Auren Study', inLanguage: 'tr-TR', publisher: { '@id': `${SITE}/#org` } },
    { '@type': 'WebApplication', name: 'Auren Study', url: `${SITE}/`, description: DEFAULT_DESC, applicationCategory: 'EducationalApplication', operatingSystem: 'Web', inLanguage: 'tr-TR',
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'TRY' }, publisher: { '@id': `${SITE}/#org` } },
    { '@type': 'FAQPage', mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
  ],
};

export default function Landing() {
  const { theme, toggleMode } = useTheme(); const light = theme === 'light';
  const link = 'text-sm text-slate-400 transition hover:text-slate-100';
  return (
    <div className="relative">
      <JsonLd data={LD} />
      <header className="sticky top-0 z-30 px-4 pt-3">
        <div className="glass-pill mx-auto flex max-w-6xl items-center justify-between gap-3 py-2 pl-5 pr-2">
          <Link to="/" className="text-lg font-bold text-slate-100" aria-label="Auren ana sayfa">Auren</Link>
          <nav aria-label="Ana menü" className="hidden gap-7 md:flex"><a href="#ozellikler" className={link}>Özellikler</a><a href="#hata" className={link}>Hata analizi</a><a href="#hesapla" className={link}>Net ve puan</a><a href="#sss" className={link}>SSS</a></nav>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={toggleMode} aria-label={light ? 'Koyu temaya geç' : 'Açık temaya geç'} className="btn-ghost !px-3 !py-2">{light ? <Moon size={16} /> : <Sun size={16} />}</button>
            <Link to="/giris" className="btn-ghost hidden sm:inline-flex">Giriş</Link>
            <Link to="/kayit" className="btn btn-shine !py-2">Başla</Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pb-10 pt-16 md:grid-cols-[1.1fr_1fr] md:pt-24" aria-labelledby="hero-h">
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }}>
            <ModeSwitch local />
            <h1 id="hero-h" className="mt-6 text-4xl font-semibold leading-[1.08] tracking-tight text-slate-50 sm:text-5xl lg:text-6xl">DGS ve YKS hazırlığı, tek akıllı çatı altında.</h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-400">Auren, iki sınavı aynı hassasiyetle yöneten hibrit bir hazırlık sistemi. Denemelerini analiz eder, hatalarının nedenini bulur, çalışmanı planlar ve seni arkadaşlarınla birlikte ileri taşır.</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/kayit" className="btn btn-shine !px-6 !py-3">Ücretsiz başla <ArrowRight size={16} /></Link>
              <a href="#ozellikler" className="btn-ghost !px-6 !py-3">Neler sunuyor?</a>
            </div>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 32, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.8, delay: 0.15, ease: [0.2, 0.7, 0.2, 1] }}><SampleCard /></motion.div>
        </section>

        <Section id="ozellikler" title="Hazırlığın her adımı için eksiksiz bir sistem" lead="Tek bir uygulamada, iki sınavın tüm ihtiyaçları. Her modül seçtiğin sınava göre şekillenir.">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{FEATURES.map(([Icon, t, d]) => (
            <motion.div key={t} whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 300, damping: 22 }} className="card !p-6">
              <span className="mb-4 grid h-10 w-10 place-items-center rounded-2xl bg-accent/15 text-accent"><Icon size={20} strokeWidth={1.8} /></span>
              <h3 className="text-lg font-semibold text-slate-50">{t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{d}</p>
            </motion.div>))}</div>
        </Section>

        <Section id="hata" title="Her yanlışın bir nedeni var" lead="Yalnızca kaç yanlış yaptığını değil, neden yaptığını da kaydet. Auren, hangi hatayı en çok yaptığını ve hangi derste yoğunlaştığını gösterir.">
          <WhyDemo />
        </Section>

        <Section id="hibrit" title="Tek hesap, iki sınav, sıfır karışıklık" lead="Sadece DGS’ye, sadece YKS’ye ya da ikisine birden hazırlanıyor olabilirsin. Panel, seçimine göre şekillenir ve istediğin an değiştirebilirsin.">
          <div className="grid gap-4 md:grid-cols-3">{TRACK_CARDS.map(([id, t, items]) => (
            <motion.div key={id} whileHover={{ y: -4 }} transition={{ type: 'spring', stiffness: 300, damping: 22 }} className={clsx('card !p-6', id === 'BOTH' && '!border-accent/40')}>
              <div className="flex items-center justify-between"><h3 className="text-lg font-semibold text-slate-50">{t}</h3>{id === 'BOTH' && <span className="badge bg-accent/15 text-accent">Esnek</span>}</div>
              <ul className="mt-4 space-y-2.5">{items.map(i => <li key={i} className="flex gap-2.5 text-sm text-slate-300"><span aria-hidden="true" className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-accent" />{i}</li>)}</ul>
            </motion.div>))}</div>
        </Section>

        <Section id="hesapla" title="Net ve puan tahmini" lead="Sınavını seç, doğru ve yanlış sayılarını gir; netin ve yaklaşık puanın anında hesaplansın.">
          <Estimator />
        </Section>

        <Section id="nasil" title="Nasıl çalışır?">
          <ol className="grid gap-4 md:grid-cols-3">{STEPS.map(([n, t, d]) => (
            <li key={n} className="card !p-6">
              <span className="num grid h-9 w-9 place-items-center rounded-full bg-accent text-sm font-bold text-onaccent">{n}</span>
              <h3 className="mt-4 text-lg font-semibold text-slate-50">{t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-400">{d}</p>
            </li>))}</ol>
        </Section>

        <Section id="sss" title="Sık sorulan sorular" className="max-w-3xl"><Faq /></Section>

        <section className="mx-auto w-full max-w-6xl px-4 pb-20" aria-labelledby="cta-h">
          <Reveal>
            <div className="card !p-8 text-center md:!p-14">
              <h2 id="cta-h" className="text-3xl font-semibold tracking-tight text-slate-50 md:text-4xl">Hazırlığını bugün bir üst seviyeye taşı.</h2>
              <p className="mx-auto mt-3 max-w-md text-slate-400">Hesabını oluştur, sınavını seç; akıllı panelin hazır.</p>
              <div className="mt-7 flex flex-wrap justify-center gap-3"><Link to="/kayit" className="btn btn-shine !px-7 !py-3">Ücretsiz hesap aç</Link><Link to="/giris" className="btn-ghost !px-7 !py-3">Giriş yap</Link></div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-white/[0.06] px-4 py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 text-sm text-slate-400">
          <span className="font-bold text-slate-200">Auren Study <span className="ml-1 text-xs font-normal text-slate-500">aurenstudy.com.tr</span></span>
          <nav aria-label="Alt menü" className="flex gap-6"><a href="#ozellikler" className={link}>Özellikler</a><a href="#sss" className={link}>SSS</a><Link to="/giris" className={link}>Giriş</Link><Link to="/kayit" className={link}>Kayıt ol</Link></nav>
          <LegalLinks className="w-full justify-center text-xs text-slate-500 md:order-last" />
          <p className="text-xs text-slate-500">Geliştirici &amp; tasarımcı: <a className="text-slate-300 hover:underline" href="https://github.com/EminUykusuz" target="_blank" rel="noopener noreferrer">Emin Uykusuz</a> · <a className="text-slate-300 hover:underline" href="https://instagram.com/eminuyksz" target="_blank" rel="noopener noreferrer">@eminuyksz</a></p>
        </div>
      </footer>
    </div>
  );
}
