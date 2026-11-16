import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useExam } from '../store.js';
import { net, fmt } from '../lib/api.js';
import './landing.css';

/* Fikir: Auren'in kendi nesnesi olan DGS | YKS anahtarı sayfanın motifidir.
   Aynı hap şekli hero'da, devasa bir kontrol olarak, cümledeki boşlukta ve her düğmede geri döner;
   anahtar çevrilince sayfanın alanı (yeşil ⇄ mavi) ve örnek içerik değişir. */

const MODE_INFO = {
  DGS: { name: 'Dikey Geçiş Sınavı', facts: 'Matematik ve Türkçe · 50 + 50 soru', sections: [['Matematik', 38, 6], ['Türkçe', 41, 5]], cap: 50 },
  YKS: { name: 'TYT ve AYT', facts: 'TYT: Türkçe, Sosyal, Matematik, Fen · AYT: 7 ders', sections: [['Türkçe', 31, 6], ['Sosyal', 15, 3], ['Matematik', 28, 8], ['Fen', 12, 4]], cap: 40 },
};
const total = (rows) => rows.reduce((s, [, c, w]) => s + net(c, w), 0);

// DGS | YKS anahtarı. Boyutu font-size ile ölçeklenir (em).
function ModePill({ className = '', label = 'Sınav modu' }) {
  const mode = useExam(s => s.mode), setMode = useExam(s => s.setMode);
  const idx = mode === 'YKS' ? 1 : 0;
  const key = e => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); setMode(idx ? 'DGS' : 'YKS', { remote: false }); } };
  return (
    <div role="radiogroup" aria-label={label} onKeyDown={key} className={`pill ${className}`} data-ui>
      <span aria-hidden="true" className="pill-thumb" style={{ transform: `translateX(${idx * 100}%)` }} />
      {['DGS', 'YKS'].map(m => (
        <button key={m} type="button" role="radio" aria-checked={mode === m} tabIndex={mode === m ? 0 : -1} onClick={() => setMode(m, { remote: false })}>{m}</button>))}
    </div>
  );
}

// Gerçek ürünün sonuç kartının örneği (net sunucuyla aynı formülle: 4 yanlış 1 doğruyu götürür)
function ResultCard({ mode }) {
  const info = MODE_INFO[mode];
  return (
    <div className="frag result" data-ui>
      <div className="frag-head"><b>{mode === 'DGS' ? 'DGS' : 'TYT'} denemesi</b><span>Örnek</span></div>
      <ul>{info.sections.map(([n, c, w]) => (
        <li key={n}><span>{n}</span><span className="num muted">{c} D · {w} Y</span><b className="num">{fmt(net(c, w))}</b></li>))}</ul>
      <div className="frag-total"><span>Toplam net</span><b className="num">{fmt(total(info.sections))}</b></div>
      <p className="frag-note">Net = doğru − yanlış ÷ 4</p>
    </div>
  );
}

/* ---------- Özellik bantları: cümle + çalışan anahtar ---------- */
const FEATURES = [
  ['DGS ile YKS arasında tek dokunuşta geç', 'Verilerin, müfredatın, geri sayımın ve sıralaman seçtiğin moda göre ayrılır; karışmaz.'],
  ['Netin 4 yanlış 1 doğruya göre hesaplanır', 'DGS, TYT ve AYT için aynı kural: net = doğru − yanlış ÷ 4. Hesabı sunucu doğrular, sen yalnızca doğru ve yanlışı girersin.'],
  ['Arkadaşlarınla haftalık puan yarışı yap', 'Sıralama seçili sınavın netlerinden ve çalışma süresinden çıkar; yüz yüze karşılaştırmada her dersi tek tek görürsün.'],
  ['Çalışma süreni ve zayıf konularını izle', 'Zamanlayıcı ve pomodoro oturumları kaydedilir; konu güç analizi hangi konuya ne zaman dönmen gerektiğini söyler.'],
  ['İstersen IBAN ile Auren’e destek ol', 'Tamamen isteğe bağlı. Havale açıklamasına yazacağın kişisel kodunla desteğin sana ait olarak eşleşir.'],
];
const BAND = ['band-m', 'band-k', 'band-s', 'band-m', 'band-k'];

function Features() {
  const [on, setOn] = useState(() => new Set([0]));
  const flip = (i) => setOn(p => { const n = new Set(p); n.has(i) ? n.delete(i) : n.add(i); return n; });
  return (
    <section id="ozellikler" aria-labelledby="f-h" className="features">
      <div className="wrap head-row"><h2 id="f-h" data-r>Her şey iki sınav için de hazır</h2></div>
      {FEATURES.map(([t, d], i) => (
        <div key={t} className={`band ${on.has(i) ? BAND[i] + ' on' : ''}`}>
          <div className="wrap band-in">
            <div className="band-text"><p className="band-s" data-r style={{ '--d': `${i * 60}ms` }}>{t}</p><p className="band-d">{d}</p></div>
            <button type="button" role="switch" aria-checked={on.has(i)} aria-label={t} className="sw" onClick={() => flip(i)} data-ui><span /></button>
          </div>
        </div>))}
    </section>
  );
}

/* ---------- Tek kontrol, dev boyutta ---------- */
function Showcase() {
  const mode = useExam(s => s.mode);
  return (
    <section aria-labelledby="s-h" className="showcase">
      <div className="wrap show-copy">
        <h2 id="s-h" data-r>Tek anahtar, iki sınav.</h2>
        <p data-r style={{ '--d': '80ms' }}>Anahtarı çevir: sayfa, müfredat ve netler seçtiğin sınava döner. Aynı hesap, iki ayrı çalışma alanı.</p>
        <p className="show-facts" aria-live="polite" data-r style={{ '--d': '160ms' }}><b>{mode}</b> · {MODE_INFO[mode].facts}</p>
        <div className="show-frag" data-r style={{ '--d': '240ms' }}><StageFragment stage={3} mode={mode} /></div>
      </div>
      <div className="show-ctl"><ModePill className="giant" label="Sınav modu (büyük)" /></div>
    </section>
  );
}

/* ---------- Aşamalar arasında sürükle ---------- */
const STAGES = [
  ['Önce modunu seç.', 'Modunu seç'],
  ['Sonra denemeni gir.', 'Denemeni gir'],
  ['Zayıf konuyu bul.', 'Zayıf konu'],
  ['Arkadaşlarınla yarış.', 'Yarış'],
];
const TOPICS = { DGS: [['Üslü Sayılar', 34, 'k'], ['Paragraf', 62, 'g'], ['EBOB – EKOK', 81, 's']], YKS: [['Trigonometri', 28, 'k'], ['Paragraf', 57, 'g'], ['Türev', 83, 's']] };
const LV = { k: 'Kritik', g: 'Gelişiyor', s: 'Ustalaşıldı' };

function StageFragment({ stage, mode }) {
  const setMode = useExam(s => s.setMode);
  if (stage === 0) return (
    <div className="frag" data-ui><div className="frag-head"><b>Sınav modu</b><span>Örnek</span></div>
      {['DGS', 'YKS'].map(m => <button key={m} type="button" className={`opt ${mode === m ? 'sel' : ''}`} onClick={() => setMode(m, { remote: false })} aria-pressed={mode === m}><b>{m}</b><span>{MODE_INFO[m].name}</span></button>)}
      <p className="frag-note">Tercihin hesabında saklanır.</p></div>);
  if (stage === 1) return <ResultCard mode={mode} />;
  if (stage === 2) return (
    <div className="frag" data-ui><div className="frag-head"><b>Konu güç analizi</b><span>Örnek</span></div>
      <ul>{TOPICS[mode].map(([n, p, l]) => <li key={n} className="topic"><span>{n}</span><i className={`lv-${l}`}>{LV[l]}</i><span className="meter"><span className={`lv-${l}`} style={{ width: `${p}%` }} /></span></li>)}</ul></div>);
  return (
    <div className="frag" data-ui><div className="frag-head"><b>Haftalık sıralama · {mode}</b><span>Örnek</span></div>
      <ol className="rank">{[['@ada', 412], ['@sen', 388], ['@kerem', 301]].map(([u, p], i) => <li key={u} className={u === '@sen' ? 'me' : ''}><b>{i + 1}</b><span>{u}</span><b className="num">{p} puan</b></li>)}</ol></div>);
}

function Stages() {
  const mode = useExam(s => s.mode); const [s, setS] = useState(0);
  return (
    <section id="nasil" aria-labelledby="h-h" className="stages">
      <div className="st-left">
        <h2 id="h-h" className="clause">{STAGES[s][0]}</h2>
        <ul className="st-names" aria-label="Aşamalar">{STAGES.map(([, n], i) => <li key={n}><button type="button" className={i === s ? 'cur' : ''} onClick={() => setS(i)} aria-current={i === s}>{n}</button></li>)}</ul>
      </div>
      <div className="st-right"><div key={s} className="st-frag"><StageFragment stage={s} mode={mode} /></div></div>
      <input className="st-range" type="range" min={0} max={STAGES.length - 1} step={1} value={s} onChange={e => setS(+e.target.value)} aria-label="Aşama" aria-valuetext={STAGES[s][1]} style={{ '--p': `${(s / (STAGES.length - 1)) * 100}%` }} />
    </section>
  );
}

/* ---------- Rakamı ziyaretçi belirler ---------- */
function Calculator() {
  const mode = useExam(s => s.mode); const cap = MODE_INFO[mode].cap;
  const [c, setC] = useState(30), [w, setW] = useState(8);
  const cc = Math.min(c, cap), ww = Math.min(w, cap - cc);
  const val = net(cc, ww);
  return (
    <section aria-labelledby="c-h" className="calc">
      <div className="wrap calc-top">
        <h2 id="c-h" data-r>Netin kaç olur?</h2>
        <div className="calc-ctl" data-ui>
          <div className="calc-row"><span>Matematik · doğru</span><b className="num">{cc}</b></div>
          <input type="range" min={0} max={cap} value={cc} onChange={e => setC(+e.target.value)} aria-label="Doğru sayısı" style={{ '--p': `${(cc / cap) * 100}%` }} />
          <div className="calc-row"><span>Yanlış</span><b className="num">{ww}</b></div>
          <input type="range" min={0} max={cap - cc} value={ww} onChange={e => setW(+e.target.value)} aria-label="Yanlış sayısı" style={{ '--p': `${cap - cc ? (ww / (cap - cc)) * 100 : 0}%` }} />
          <p className="calc-cap">{mode === 'DGS' ? 'DGS' : 'TYT'} matematik: {cap} soru</p>
        </div>
      </div>
      <div className="wrap calc-out">
        <output className="calc-fig num" aria-live="polite">{fmt(val)}<small>net</small></output>
        <p className="calc-work">{cc} doğru − {ww} yanlış ÷ 4 = {fmt(val)}. Dört yanlış bir doğruyu götürür.</p>
      </div>
    </section>
  );
}

/* ---------- SSS ---------- */
const FAQ = [
  ['Auren ücretsiz mi?', 'Evet. Hesap açmak ve tüm özellikleri kullanmak ücretsizdir. Destek olmak tamamen isteğe bağlıdır; hiçbir özellik buna bağlı değildir.'],
  ['DGS ve YKS verilerim birbirine karışır mı?', 'Hayır. Denemelerin, çalışma kayıtların, konu ilerlemen ve sıralaman sınav türüne göre ayrı tutulur. Anahtarı çevirdiğinde diğer sınavın verisi olduğu gibi kalır.'],
  ['Net nasıl hesaplanıyor?', 'DGS, TYT ve AYT için dört yanlış bir doğruyu götürür: net = doğru − yanlış ÷ 4. İstemci net göndermez; sunucu kendisi hesaplar ve veritabanı da kuralı ikinci kez denetler.'],
  ['Arkadaşlarımla nasıl yarışırım?', 'Kullanıcı adıyla arkadaş ekle. Haftalık puan; seçili sınavdaki çalışma süren, çözdüğün soru ve deneme netlerinden hesaplanır. Yüz yüze karşılaştırmada ders ders farkı görürsün.'],
  ['TYT ve AYT netlerim karışır mı?', 'Karışmaz. Karşılaştırma ve trend grafikleri TYT ile AYT için ayrı çalışır; yalnızca aynı bölümün netleri birbiriyle kıyaslanır.'],
];
function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <section id="sss" aria-labelledby="q-h" className="faq wrap">
      <h2 id="q-h" data-r>Sık sorulanlar</h2>
      <div className="faq-list">{FAQ.map(([q, a], i) => (
        <div key={q} className={`tile ${open === i ? 'open' : ''}`} data-r style={{ '--d': `${i * 50}ms` }}>
          <button type="button" aria-expanded={open === i} aria-controls={`fa-${i}`} onClick={() => setOpen(open === i ? -1 : i)}><span>{q}</span><i aria-hidden="true" /></button>
          <div id={`fa-${i}`} role="region" hidden={open !== i}><p>{a}</p></div>
        </div>))}</div>
    </section>
  );
}

/* ---------- Boşluklu cümle ---------- */
function Cta() {
  const mode = useExam(s => s.mode);
  return (
    <section aria-labelledby="k-h" className="cta">
      <div className="wrap cta-grid">
        <div>
          <h2 id="k-h" className="cta-s" data-r>Bu yıl <ModePill className="inline" label="Hazırlandığın sınav" /> için hazırlanıyorum.</h2>
          <div className="cta-act" data-r style={{ '--d': '100ms' }}>
            <Link to="/kayit" className="btn-l light">Ücretsiz hesap aç</Link>
            <Link to="/giris" className="link-l">Zaten hesabın var mı? Giriş yap</Link>
          </div>
        </div>
        <div className="cta-frag" data-r style={{ '--d': '160ms' }}><ResultCard mode={mode} /></div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="foot">
      <div className="wrap foot-in">
        <nav aria-label="Alt menü"><a href="#ozellikler">Özellikler</a><a href="#nasil">Nasıl çalışır</a><a href="#sss">SSS</a><Link to="/giris">Giriş</Link><Link to="/kayit">Kayıt ol</Link></nav>
        <p>Geliştirici &amp; tasarımcı: <a href="https://github.com/EminUykusuz" target="_blank" rel="noopener noreferrer">Emin Uykusuz</a> · <a href="https://instagram.com/eminuyksz" target="_blank" rel="noopener noreferrer">@eminuyksz</a></p>
      </div>
      <div className="foot-mark" aria-hidden="true">Auren</div>
    </footer>
  );
}

export default function Landing() {
  const mode = useExam(s => s.mode); const root = useRef(null);
  useEffect(() => { document.title = 'Auren · DGS ve YKS için deneme neti, çalışma ve arkadaş rekabeti'; }, []);
  // Bölümlerin parçaları görününce kademeli girer; script yoksa içerik zaten görünür kalır
  useEffect(() => {
    const el = root.current; el.classList.add('js');
    const items = el.querySelectorAll('[data-r]');
    if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) { items.forEach(i => i.classList.add('in')); return; }
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    items.forEach(i => io.observe(i));
    return () => io.disconnect();
  }, []);
  return (
    <div ref={root} className="lp" data-mode={mode}>
      <header className="nav"><div className="wrap nav-in">
        <Link to="/" className="mark" aria-label="Auren ana sayfa">Auren</Link>
        <nav aria-label="Ana menü" className="nav-links"><a href="#ozellikler">Özellikler</a><a href="#nasil">Nasıl çalışır</a><a href="#sss">SSS</a></nav>
        <div className="nav-act"><Link to="/giris" className="link-l">Giriş</Link><Link to="/kayit" className="btn-l">Ücretsiz başla</Link></div>
      </div></header>

      <main>
        <section className="hero" aria-labelledby="hero-h">
          <div className="hero-card">
            <h1 id="hero-h" className="hero-h"><span data-r>DGS ve YKS,</span> <span data-r style={{ '--d': '80ms' }}>tek yerde.</span></h1>
            <p className="hero-p" data-r style={{ '--d': '160ms' }}>Auren; deneme netini, çalışmanı ve arkadaş rekabetini iki sınav için de takip eder. Dört yanlış bir doğruyu götürür, hesabı biz yaparız.</p>
            <div className="hero-act" data-r style={{ '--d': '240ms' }}>
              <ModePill />
              <Link to="/kayit" className="btn-l">Ücretsiz başla</Link>
            </div>
          </div>
          <div className="hero-field" aria-hidden="false">
            <span className="hero-circle" aria-hidden="true" />
            <div className="hero-frag"><ResultCard mode={mode} /></div>
          </div>
        </section>
        <Features />
        <Showcase />
        <Stages />
        <Calculator />
        <Faq />
        <Cta />
      </main>
      <Footer />
    </div>
  );
}
