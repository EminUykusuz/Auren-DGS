import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../components/Logo.jsx';
import JsonLd from '../components/JsonLd.jsx';
import LegalLinks from '../components/LegalLinks.jsx';
import { SITE, DEFAULT_DESC } from '../hooks/useSEO.js';
import { net, fmt } from '../lib/api.js';
import { EST, partMax, partNet, approxScore } from '../lib/estimate.js';
import '../landing-fonts.css';
import '../landing.css';

/* Landing: "sayfa nesnenin kendisidir". Optik cevap kâğıdı: hero bir davetiye kartı, net hesabı kâğıdın kendisi.
   Uygulama temasından bağımsızdır (.ln kapsamı). Görseller /landing altında, kendi sunucumuzdan (CSP). */

const MAIL = import.meta.env.VITE_CONTACT_EMAIL || '';
const IMG = (f) => `/landing/${f}`;

const FAQ = [
  ['Fiyat', 'Auren Study ücretsiz mi?', 'Evet. Hesap açmak ve bireysel özelliklerin tümünü kullanmak ücretsizdir.'],
  ['Hibrit', 'İkisine birden hazırlanabilir miyim?', 'Kayıtta hibrit hesabı seç. İki sınavın modüllerini birlikte açar; üst çubuktan tek dokunuşla geçersin. Verilerin her sınav için ayrı tutulur.'],
  ['Geçiş', 'Sınav türümü sonra değiştirebilir miyim?', 'Evet. Ayarlar sayfasından DGS, YKS ya da hibrit arasında geçiş yapabilirsin. Mevcut verilerin silinmez.'],
  ['Netler', 'TYT ve AYT netlerim karışır mı?', 'Karışmaz. Karşılaştırma ve trend grafikleri TYT ile AYT için ayrı çalışır.'],
  ['Arkadaş', 'Arkadaşlarımla nasıl yarışırım?', 'Kullanıcı adıyla arkadaş ekle. Haftalık puan; seçili sınavdaki çalışma süren, çözdüğün soru sayısı ve deneme netlerinden oluşur.'],
  ['Puan', 'Puan tahmini kesin mi?', 'Hayır; yaklaşık bir göstergedir. Gerçek puan, sınavın zorluğuna ve adayların genel başarısına göre ÖSYM tarafından hesaplanır.'],
  ['Dershane', 'Dershane olarak kullanabilir miyiz?', 'Evet. Kurum paneliyle logonuzla markalı bir giriş sayfası, sınıflar, Excel’den toplu öğrenci ekleme ve sınıf değiştirme önerisi alırsınız. Öğrenci hesaplarını siz açarsınız.'],
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

const PARTS = [['DGS', EST.DGS.parts.DGS], ['TYT', EST.YKS.parts.TYT], ['AYT', EST.YKS.parts.AYT]];

/* Canlı net hesabı: doğru − yanlış/4. Yazdıkça toplam ve yaklaşık puan değişir. */
function Calc() {
  const [k, setK] = useState(0);
  const [ans, setAns] = useState({});
  const [label, def] = PARTS[k];
  const set = (name, max, key, raw) => {
    const v = Math.max(0, Math.min(max, parseInt(raw, 10) || 0));
    setAns(p => {
      const id = `${label}.${name}`, cur = { c: 0, w: 0, ...p[id], [key]: v };
      if (cur.c + cur.w > max) { if (key === 'c') cur.w = max - cur.c; else cur.c = max - cur.w; }
      return { ...p, [id]: cur };
    });
  };
  const mine = Object.fromEntries(def.sections.map(([n]) => [n, ans[`${label}.${n}`] ?? { c: 0, w: 0 }]));
  const total = partNet(def.sections, mine), max = partMax(def.sections);
  return (
    <div className="ln-calc">
      <div>
        <div className="ln-tabs" role="tablist" aria-label="Sınav bölümü">
          {PARTS.map(([l], i) => <button key={l} role="tab" type="button" aria-selected={k === i} onClick={() => setK(i)}>{l}</button>)}
        </div>
        <h2 style={{ marginTop: 28 }}>Kendi netini şimdi hesapla.</h2>
        <p className="d">Doğru ve yanlış sayını yaz. Her dört yanlış bir doğruyu götürür; Auren Study bunu senin yerine hesaplar.</p>
      </div>
      <table className="ln-sheet">
        <thead><tr><th scope="col">Bölüm</th><th scope="col">Doğru</th><th scope="col">Yanlış</th><th scope="col" style={{ textAlign: 'right' }}>Net</th></tr></thead>
        <tbody>{def.sections.map(([name, m]) => {
          const a = mine[name];
          return (
            <tr key={name}>
              <td>{name}<br /><small style={{ color: 'var(--paper-muted)' }}>{m} soru</small></td>
              <td><input type="number" inputMode="numeric" min={0} max={m} value={a.c || ''} placeholder="0" aria-label={`${name} doğru`} onChange={e => set(name, m, 'c', e.target.value)} /></td>
              <td><input type="number" inputMode="numeric" min={0} max={m - a.c} value={a.w || ''} placeholder="0" aria-label={`${name} yanlış`} onChange={e => set(name, m, 'w', e.target.value)} /></td>
              <td className="n">{fmt(net(a.c, a.w))}</td>
            </tr>);
        })}</tbody>
      </table>
      <div className="ln-total" aria-live="polite">
        <span>Toplam net<small>/ {max} · yaklaşık puan {total > 0 ? fmt(Math.round(approxScore(total, max) * 10) / 10) : '—'}</small></span>
        <b>{fmt(total)}</b>
      </div>
      <div className="ln-cells">
        <Link className="a" to="/kayit">Ücretsiz başla</Link>
        <Link className="b" to="/giris">Giriş yap</Link>
      </div>
    </div>
  );
}

const MENU = [
  ['Denemeler', [['Bölüm bazlı analiz', 'DGS, TYT ve AYT ayrı ayrı', 'Net'], ['Hata nedeni', 'Dikkat, işlem, formül, konu, süre', 'Neden']]],
  ['Çalışma', [['Konu gücü', 'Hangi konuya ne zaman dönmeli', 'Konu'], ['Zamanlayıcı', 'Pomodoro ve oturum kaydı', 'Süre'], ['Geri sayım', 'Sınava kalan süre tek ekranda', 'Gün']]],
  ['Birlikte', [['Arkadaşlar', 'Haftalık puan sıralaması', 'Düello'], ['Kurum paneli', 'Sınıflar, öğretmenler, Excel ile ekleme', 'Dershane']]],
];

const MOMENTS = [
  ['Sınavını seç', 'DGS, YKS ya da ikisi. Panel, müfredat ve istatistikler buna göre açılır.', 'penpencil.jpg', 'Optik okuyucu kalemi ve kurşun kalem', 'center'],
  ['Denemeni kaydet', 'Doğru ve yanlışını gir, hata nedenini işaretle. Analiz kendiliğinden oluşur.', 'marksheet-1-jpg.jpg', 'Cevap kâğıtları', '30% 40%'],
  ['Süreni say', 'Zamanlayıcıyla çalışma oturumların kaydedilir; haftalık ilerlemen görünür.', 'stopwatch.jpg', 'Kronometre', 'center'],
  ['Gelişimini izle', 'Trendini takip et, zayıf konunu bul, arkadaşlarınla haftalık sırada yarış.', 'scanner.jpg', 'Optik okuyucu makinesi', '20% 30%'],
];

function How() {
  const row = useRef(null); const [p, setP] = useState(0.2);
  const upd = () => { const e = row.current; if (!e) return; const m = e.scrollWidth - e.clientWidth; setP(m > 0 ? 0.2 + 0.8 * (e.scrollLeft / m) : 1); };
  const go = (d) => row.current?.scrollBy({ left: d * 312, behavior: 'smooth' });
  return (
    <section className="ln-sec ln-how" id="nasil" aria-labelledby="how-h">
      <div className="ln-wrap">
        <div className="head"><h2 id="how-h">Dört adımda hazırlık</h2>
          <div className="ln-arrows"><button type="button" onClick={() => go(-1)} aria-label="Geri">←</button><button type="button" onClick={() => go(1)} aria-label="İleri">→</button></div></div>
        <div className="ln-bar" aria-hidden="true"><i style={{ width: `${p * 100}%` }} /></div>
      </div>
      <ul className="ln-row" ref={row} onScroll={upd} tabIndex={0} aria-label="Adımlar">
        {MOMENTS.map(([t, d, img, alt, pos], i) => (
          <li className="ln-col" key={t} style={{ minHeight: 440 }}>
            <h3>{i + 1}. {t}</h3><p>{d}</p>
            <figure style={{ marginTop: 'auto', paddingTop: 24 }}><img src={IMG(img)} alt={alt} loading="lazy" style={{ aspectRatio: i % 2 ? '4/5' : '1', objectFit: 'cover', objectPosition: pos }} /></figure>
          </li>))}
      </ul>
    </section>
  );
}

function Coupon() {
  const [f, setF] = useState({ kurum: '', ad: '', sayi: '100-300' });
  const send = (e) => {
    e.preventDefault();
    const body = `Kurum: ${f.kurum}\nYetkili: ${f.ad}\nÖğrenci sayısı: ${f.sayi}\n\nAuren Study kurum paneli hakkında bilgi almak istiyoruz.`;
    window.location.href = MAIL ? `mailto:${MAIL}?subject=${encodeURIComponent('Kurum paneli: ' + f.kurum)}&body=${encodeURIComponent(body)}` : 'https://instagram.com/eminuyksz';
  };
  const set = (k) => (e) => setF(s => ({ ...s, [k]: e.target.value }));
  return (
    <section className="ln-sec ln-contact" id="dershane" aria-labelledby="ct-h">
      <div className="ln-wrap">
        <div className="ln-coupon">
          <i className="perf" aria-hidden="true" />
          <div className="l">
            <div><h2 id="ct-h">Dershaneniz için kurum paneli.</h2>
              <ul><li>Logonuzla markalı giriş sayfası</li><li>Excel’den yapıştırarak toplu öğrenci ekleme</li><li>Sınıflar, öğretmenler, sınıf değiştirme önerisi</li><li>Giriş bilgileri tek tıkla yazdırılır</li></ul></div>
            <p>Öğrenci hesaplarını siz açarsınız; öğrenciler yalnızca kendi kurumlarındakilerle görünür.</p>
          </div>
          <form onSubmit={send}>
            <input required placeholder="Kurum adı" aria-label="Kurum adı" value={f.kurum} onChange={set('kurum')} autoComplete="organization" />
            <input required placeholder="Yetkili adı soyadı" aria-label="Yetkili adı soyadı" value={f.ad} onChange={set('ad')} autoComplete="name" />
            <select aria-label="Öğrenci sayısı" value={f.sayi} onChange={set('sayi')}><option>100’den az</option><option>100-300</option><option>300-1000</option><option>1000’den fazla</option></select>
            <button className="go" type="submit">Bilgi iste</button>
            <p className="note">{MAIL ? 'E-posta uygulaman hazır bir mesajla açılır.' : 'Instagram üzerinden bize ulaşırsın.'}</p>
          </form>
        </div>
      </div>
    </section>
  );
}

function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <div className="stack">{FAQ.map(([tab, q, a], i) => {
      const colors = ['#f2f0e8', '#e6dccf', '#dfe5dc', '#f2f0e8', '#e3e1d6', '#dfe5dc', '#e6dccf'];
      return (
        <div key={q} className="ln-fq" data-open={open === i} style={{ '--tx': `${(i % 4) * 18}%`, '--c': colors[i] }} data-r>
          <span className="tab" aria-hidden="true">{tab}</span>
          <h3 style={{ all: 'unset' }}><button type="button" aria-expanded={open === i} aria-controls={`fq-${i}`} onClick={() => setOpen(open === i ? -1 : i)}><span>{q}</span><span className="pm" aria-hidden="true">+</span></button></h3>
          <div className="ans" id={`fq-${i}`} role="region"><div><p>{a}</p></div></div>
        </div>);
    })}</div>
  );
}

export default function Landing() {
  const root = useRef(null), foot = useRef(null);
  useEffect(() => {
    const r = root.current; r.classList.add('ln-js');
    const els = [...r.querySelectorAll('[data-r]')];
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px' });
    els.forEach((e, i) => { e.style.setProperty('--i', String(i % 4)); io.observe(e); });
    // Perde: alt bilgi sabit durur, sayfa üstünden kalkar (yalnızca geniş ekran)
    const fit = () => r.style.setProperty('--foot-h', `${foot.current?.offsetHeight ?? 560}px`);
    fit(); const ro = new ResizeObserver(fit); ro.observe(foot.current);
    return () => { io.disconnect(); ro.disconnect(); r.classList.remove('ln-js'); };
  }, []);

  return (
    <div className="ln" ref={root}>
      <JsonLd data={LD} />
      <a href="#ana" className="ln-sr">İçeriğe geç</a>
      <header className="ln-top">
        <Link to="/" className="ln-mark" aria-label="Auren Study ana sayfa" style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><Logo size={30} leg="#2c3620" dot="#1c1c1c" />Auren Study</Link>
        <nav className="ln-links" aria-label="Ana menü"><a href="#hesapla">Net hesabı</a><a href="#ozellikler">Özellikler</a><a href="#dershane">Dershaneler</a><a href="#sss">SSS</a></nav>
        <div className="ln-top-act"><Link to="/giris" className="ln-btn plain">Giriş</Link></div>
      </header>

      <main className="ln-main" id="ana">
        <section className="ln-hero" aria-labelledby="hero-h">
          <article className="ln-card">
            <i className="ln-corner tl" aria-hidden="true" /><i className="ln-corner tr" aria-hidden="true" />
                        <h1 id="hero-h"><span>Denemelerin</span><span>konuşuyor.</span></h1>
            <p className="sub">DGS ve YKS denemelerini kaydet; Auren Study her yanlışın nedenini, her konunun gücünü ve haftalık ilerlemeni gösterir.</p>
            <p className="facts"><span>DGS</span><i aria-hidden="true" /><span>TYT</span><i aria-hidden="true" /><span>AYT</span><i aria-hidden="true" /><span>Ücretsiz</span></p>
            <div className="acts">
              <Link to="/kayit" className="ln-btn olive">Ücretsiz başla</Link>
              <a href="#hesapla" className="ln-btn plain">Netini hesapla ↓</a>
            </div>
            <div className="shotw"><img className="shot" src={IMG('marksheet-1-jpg.jpg')} alt="Optik cevap kâğıtları" /></div>
          </article>
        </section>

        <section className="ln-show" id="hesapla" aria-label="Net hesabı">
          <div className="ln-plate" data-r>
            <figure><img src={IMG('marksheet-2-jpg.jpg')} alt="Doldurulmaya hazır optik cevap kâğıdı" loading="lazy" /><figcaption>Optik cevap kâğıdı</figcaption></figure>
          </div>
          <Calc />
        </section>

        <section className="ln-sec ln-feat" id="ozellikler" aria-label="Özellikler">
          <div className="ln-wrap wrap">
            <div className="side" data-r><p>Tek uygulama, iki sınav. Her modül seçtiğin sınava göre şekillenir.</p></div>
            <article className="ln-menu" data-r>
              <h2>Neler var?</h2>
              {MENU.map(([grp, items]) => (
                <div key={grp}><h3>{grp}</h3>
                  <ul>{items.map(([n, d, v]) => (
                    <li key={n}><div className="mr"><b>{n}</b><span className="dots" aria-hidden="true" /><em>{v}</em></div><p className="d">{d}</p></li>))}</ul></div>))}
            </article>
            <div className="side r" data-r>
              <figure><img src={IMG('scanner.jpg')} alt="Optik okuyucu makinesi" loading="lazy" style={{ objectPosition: '15% 35%' }} /><figcaption>Yakında: optik okuyucu desteği</figcaption></figure>
            </div>
          </div>
        </section>

        <How />
        <Coupon />

        <section className="ln-sec ln-faq" id="sss" aria-labelledby="faq-h">
          <div className="ln-wrap"><h2 className="ln-h" id="faq-h" data-r>Sık sorulan sorular</h2><Faq /></div>
        </section>

        <section className="ln-cta" aria-labelledby="cta-h">
          <p className="txt" data-r>Hazırlığını bugün bir üst seviyeye taşı.</p>
          <div className="reply" data-r>
            <h2 id="cta-h">Hesabını aç, sınavını seç.</h2>
            <p>Panelin birkaç saniyede hazır. Kredi kartı yok, süre sınırı yok.</p>
            <Link to="/kayit" className="ln-btn olive">Ücretsiz hesap aç</Link>
          </div>
        </section>
      </main>

      <footer className="ln-foot" ref={foot}>
        <div className="ln-back on-paper">
          <div><h2>Auren Study</h2><p className="msg">DGS ve YKS hazırlığı için hibrit çalışma sistemi.</p></div>
          <ul>
            <li><Link to="/giris">Giriş yap</Link></li><li><Link to="/kayit">Kayıt ol</Link></li><li><a href="#dershane">Dershaneler için</a></li>
            <li><LegalLinks /></li>
          </ul>
          <div className="ln-stamp" aria-hidden="true"><img src={IMG('stopwatch.jpg')} alt="" loading="lazy" /></div>
          <p className="ln-imprint">
            Geliştirici &amp; tasarımcı: <a href="https://github.com/EminUykusuz" target="_blank" rel="noopener noreferrer">Emin Uykusuz</a> · <a href="https://instagram.com/eminuyksz" target="_blank" rel="noopener noreferrer">@eminuyksz</a><br />
            Görseller: “Mark sheets” ve “Mark-sheet” (Genppy, kamu malı, Wikimedia Commons); “Scantron 888P+ machine” (Packer1028, CC0); “Stoppuhr hanhart” (kamu malı); “A scantron pen and a mechanical pencil…” (고려, <a href="https://creativecommons.org/licenses/by/4.0" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>, Wikimedia Commons).
          </p>
        </div>
      </footer>
    </div>
  );
}
