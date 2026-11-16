import { Link, Navigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import clsx from 'clsx';
import LegalLinks from '../components/LegalLinks.jsx';

// Yasal metinler (KVKK, gizlilik, koşullar, çerez). Tek yerden yönetilir; Landing, kayıt ve panel altlığı buraya bağlanır.
// İletişim e-postası ortam değişkeniyle verilir (VITE_CONTACT_EMAIL); boşsa uygulama içi geri bildirim formu gösterilir.
const MAIL = import.meta.env.VITE_CONTACT_EMAIL || '';
const UPDATED = '16 Kasım 2026';
const SITE = 'aurenstudy.com.tr';

const Contact = () => MAIL
  ? <>Bize <a className="text-accent underline-offset-4 hover:underline" href={`mailto:${MAIL}`}>{MAIL}</a> adresinden veya uygulamadaki Ayarlar › Geri bildirim formundan ulaşabilirsin.</>
  : <>Bize uygulamadaki Ayarlar › Geri bildirim formundan ulaşabilirsin.</>;

export const LEGAL = {
  gizlilik: {
    title: 'Gizlilik Politikası',
    lead: `Auren Study (${SITE}) olarak verini en az düzeyde topluyor, yalnızca hizmeti sunmak için kullanıyor ve satmıyoruz.`,
    sections: [
      ['Topladığımız veriler', <ul key="a"><li><b>Hesap bilgileri:</b> kullanıcı adı, e-posta adresi, şifren (yalnızca geri döndürülemez bir özet/hash olarak), seçtiğin sınav türü ve avatar.</li><li><b>Çalışma verileri:</b> çalışma oturumları (ders, konu, süre, soru sayısı), konu ilerlemen, deneme sonuçların ve yanlış nedenlerin.</li><li><b>Sosyal veriler:</b> arkadaşlık istekleri ve onayladığın arkadaşlıklar.</li><li><b>Geri bildirimler:</b> bize yazdığın konu ve mesaj.</li><li><b>Teknik veriler:</b> güvenlik ve kötüye kullanımı önlemek için IP adresi ve istek kayıtları.</li></ul>],
      ['Verileri neden kullanıyoruz', <ul key="b"><li>Hesabını açmak, giriş yapmanı sağlamak ve oturumunu güvende tutmak.</li><li>Net, ilerleme, istatistik ve sıralama gibi özellikleri sana göstermek.</li><li>Şifre sıfırlama gibi hizmet e-postalarını göndermek.</li><li>Hataları ve kötüye kullanımı tespit etmek, hizmeti geliştirmek.</li></ul>],
      ['Başkalarına görünen bilgiler', <p key="c">Kullanıcı adın, avatarın ve arkadaşlık kurduğun kişilerle paylaşmayı seçtiğin çalışma özetleri (ör. toplam süre, net) arkadaşların tarafından görülebilir. E-posta adresin ve şifren hiçbir kullanıcıya gösterilmez.</p>],
      ['Üçüncü taraflar', <ul key="d"><li><b>Barındırma:</b> arayüz ve sunucu hizmetleri altyapı sağlayıcılarımız üzerinden verilir; bu sağlayıcılar verini yalnızca hizmeti çalıştırmak için işler.</li><li><b>Avatarlar:</b> avatar görselleri DiceBear (api.dicebear.com) servisinden yüklenir. Görsel istenirken tarayıcının IP adresi bu servise ulaşır; kullanıcı adın veya e-postan paylaşılmaz.</li><li><b>E-posta:</b> şifre sıfırlama ve geri bildirim e-postaları yapılandırılmış bir SMTP sağlayıcısı üzerinden gönderilir.</li></ul>, <p key="d2">Verini reklam amacıyla satmaz veya paylaşmayız. Yasal bir zorunluluk olduğunda yetkili makamlarla paylaşım yapılabilir.</p>],
      ['Saklama süresi', <p key="e">Verilerini hesabın açık olduğu sürece saklarız. Hesabının silinmesini istediğinde, yasal saklama yükümlülüğümüz olmayan tüm kişisel verilerini makul bir süre içinde sileriz. Şifre sıfırlama bağlantıları 15 dakika geçerlidir.</p>],
      ['Güvenlik', <p key="f">Şifrelerin güçlü bir algoritmayla özetlenerek saklanır; oturum çerezi tarayıcı kodunun erişemeyeceği (HttpOnly) biçimde tutulur. Giriş denemeleri sınırlandırılır. Yine de hiçbir sistemin %100 güvenli olmadığını hatırlatırız; hesabın için benzersiz bir şifre kullanmanı öneririz.</p>],
      ['Çocukların gizliliği', <p key="g">Hizmet sınava hazırlanan öğrencilere yöneliktir. 18 yaşından küçükler, hesap açmadan önce velisinin bilgisi ve onayıyla hareket etmelidir.</p>],
      ['Haklarını nasıl kullanırsın', <p key="h">Verine erişme, düzeltme, silme ve itiraz hakların için KVKK Aydınlatma Metni&apos;ndeki başlığa bak. <Contact /></p>],
    ],
  },
  kvkk: {
    title: 'KVKK Aydınlatma Metni',
    lead: '6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) madde 10 kapsamında, kişisel verilerinin nasıl işlendiği hakkında seni bilgilendiriyoruz.',
    sections: [
      ['Veri sorumlusu', <p key="a">Veri sorumlusu, {SITE} alan adı altında hizmet veren Auren Study&apos;dir (geliştirici ve işletici: Emin Uykusuz). <Contact /></p>],
      ['İşlenen kişisel veriler', <ul key="b"><li><b>Kimlik/iletişim:</b> kullanıcı adı, e-posta adresi.</li><li><b>İşlem güvenliği:</b> şifre özeti, IP adresi, oturum çerezi.</li><li><b>Kullanıcı işlemi:</b> çalışma oturumları, konu ilerlemesi, deneme sonuçları, yanlış nedenleri, arkadaşlık bilgileri, geri bildirim mesajları.</li></ul>],
      ['İşleme amaçları', <p key="c">Üyelik oluşturulması ve yönetilmesi, hizmetin sunulması, kişiselleştirilmiş çalışma ve deneme takibi, bilgi güvenliğinin sağlanması, şifre sıfırlama ve hizmet iletişimi, hataların giderilmesi ve hizmetin geliştirilmesi.</p>],
      ['Hukuki sebepler', <p key="d">KVKK m.5/2 uyarınca; (c) sözleşmenin kurulması ve ifası için gerekli olması (üyelik ve hizmet), (f) veri sorumlusunun meşru menfaati (güvenlik, kötüye kullanımın önlenmesi) ve (ç) hukuki yükümlülüklerin yerine getirilmesi.</p>],
      ['Aktarım', <p key="e">Kişisel verilerin; hizmetin sunulması için barındırma ve e-posta altyapı sağlayıcılarına, avatar görselleri için DiceBear servisine (yalnızca teknik bağlantı verisi) ve yasal yükümlülük hâlinde yetkili kamu kurumlarına aktarılabilir. Bazı sağlayıcıların sunucuları yurt dışında olabilir; bu aktarım hizmetin teknik gereğidir ve KVKK m.9 çerçevesinde yürütülür.</p>],
      ['Toplama yöntemi', <p key="f">Verilerin; kayıt formu, uygulamayı kullanman ve geri bildirim formu aracılığıyla, elektronik ortamda otomatik yöntemlerle toplanır.</p>],
      ['KVKK m.11 kapsamındaki hakların', <><p key="g">Veri sahibi olarak şu haklara sahipsin:</p><ul key="g2"><li>Kişisel verilerinin işlenip işlenmediğini öğrenme ve bilgi talep etme,</li><li>İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme,</li><li>Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme,</li><li>Eksik veya yanlış işlenmişse düzeltilmesini isteme,</li><li>Kanun&apos;da öngörülen şartlarda silinmesini veya yok edilmesini isteme,</li><li>Düzeltme ve silme işlemlerinin aktarılan üçüncü kişilere bildirilmesini isteme,</li><li>İşlenen verilerin otomatik sistemlerle analiz edilmesi sonucu aleyhine bir sonuç çıkmasına itiraz etme,</li><li>Kanuna aykırı işleme nedeniyle zarara uğrarsan zararın giderilmesini talep etme.</li></ul></>],
      ['Başvuru yöntemi', <p key="h">Taleplerini <Contact /> Başvurun en geç otuz gün içinde ücretsiz olarak sonuçlandırılır. Kişisel Verileri Koruma Kurulu&apos;na şikâyet hakkın saklıdır.</p>],
    ],
  },
  kosullar: {
    title: 'Kullanım Koşulları',
    lead: 'Auren Study\'yi kullanarak aşağıdaki koşulları kabul etmiş olursun.',
    sections: [
      ['Hizmetin tanımı', <p key="a">Auren Study; DGS ve YKS (TYT/AYT) adayları için çalışma kaydı, kronometre, deneme analizi, müfredat takibi ve arkadaşlarla karşılaştırma sunan bir çalışma takip platformudur. Resmî bir sınav kurumu değildir; ÖSYM veya MEB ile bağlantısı yoktur.</p>],
      ['Hesap', <ul key="b"><li>Kayıt sırasında doğru bilgi vermelisin; hesabının güvenliğinden ve şifrenden sen sorumlusun.</li><li>Bir kişi için tek hesap açılmasını bekleriz. Hesabını başkasına devretmemelisin.</li><li>Hesabından yapılan işlemlerden, yetkisiz erişimi bize bildirmediğin sürece sen sorumlu olursun.</li></ul>],
      ['Kabul edilebilir kullanım', <ul key="c"><li>Hizmeti hukuka ve genel ahlaka aykırı amaçlarla kullanamazsın.</li><li>Sisteme zarar verecek, yetkisiz erişim deneyecek, otomatik araçlarla aşırı istek göndererek hizmeti aksatacak davranışlarda bulunamazsın.</li><li>Başka kullanıcıları rahatsız eden, hakaret içeren veya yanıltıcı kullanıcı adı ve içerik paylaşamazsın.</li></ul>],
      ['Hesabın askıya alınması', <p key="d">Bu koşulların ihlali hâlinde hesabını önceden bildirimde bulunmaksızın kısıtlayabilir veya kapatabiliriz.</p>],
      ['Hesaplamalar ve içerik', <p key="e">Net, puan tahmini ve sıralama gibi hesaplamalar, girdiğin verilere dayanan bilgilendirme amaçlı araçlardır; gerçek sınav sonucunu garanti etmez. Müfredat bilgileri özenle hazırlanır ancak resmî kılavuzlarla birlikte kontrol etmeni öneririz.</p>],
      ['Fikrî mülkiyet', <p key="f">Platformun tasarımı, yazılımı ve markası Auren Study&apos;ye aittir. Senin girdiğin çalışma ve deneme verileri sana aittir; bunları yalnızca hizmeti sunmak için işleriz.</p>],
      ['Sorumluluğun sınırı', <p key="g">Hizmeti &quot;olduğu gibi&quot; sunarız; kesintisiz veya hatasız çalışacağını garanti etmeyiz. Yasaların izin verdiği ölçüde, hizmetin kullanımından doğan dolaylı zararlardan sorumlu değiliz. Verilerini zaman zaman kendin de not almanı öneririz.</p>],
      ['Değişiklikler ve uygulanacak hukuk', <p key="h">Koşulları güncelleyebiliriz; önemli değişiklikleri uygulama üzerinden duyururuz. Bu koşullara Türkiye Cumhuriyeti hukuku uygulanır ve uyuşmazlıklarda Türkiye mahkemeleri ve icra daireleri yetkilidir.</p>],
    ],
  },
  cerez: {
    title: 'Çerez ve Yerel Depolama Politikası',
    lead: 'Auren Study yalnızca hizmetin çalışması için gerekli çerez ve tarayıcı depolamasını kullanır. Reklam veya izleme çerezi kullanmıyoruz.',
    sections: [
      ['Kullandıklarımız', <div key="a" className="overflow-x-auto"><table className="w-full min-w-[34rem] text-left text-sm"><thead className="text-slate-300"><tr><th className="py-2 pr-4">Ad</th><th className="py-2 pr-4">Tür</th><th className="py-2 pr-4">Amaç</th><th className="py-2">Süre</th></tr></thead><tbody className="text-slate-400">
        {[['dgs_token', 'Çerez (HttpOnly)', 'Oturumunu açık tutar ve seni doğrular.', '7 gün'],
          ['auren_mode, auren_part', 'Yerel depolama', 'Seçtiğin sınav (DGS/YKS) ve TYT/AYT bölümünü hatırlar.', 'Sen silene dek'],
          ['dgs_nav, dgs_theme', 'Yerel depolama', 'Menü durumu, tema ve arka plan tercihini hatırlar.', 'Sen silene dek'],
          ['Zamanlayıcı ve Pomodoro durumu', 'Yerel depolama', 'Sayfayı yenilesen de çalışan sayacını korur.', 'Sen silene dek']].map(r => (
          <tr key={r[0]} className="border-t border-white/[0.06]">{r.map((c, i) => <td key={i} className={clsx('py-2 pr-4 align-top', i === 0 && 'font-medium text-slate-200')}>{c}</td>)}</tr>))}
      </tbody></table></div>],
      ['Hukuki dayanak', <p key="b">Bunlar hizmetin açıkça talep ettiğin işlevini sağlamak için kesinlikle gerekli olduğundan ayrıca onay gerektirmez. Analitik veya reklam amaçlı çerez eklenirse bu politika güncellenir ve onayın istenir.</p>],
      ['Üçüncü taraf istekleri', <p key="c">Avatar görselleri api.dicebear.com adresinden yüklenir; bu sırada tarayıcın o servise doğrudan istek yapar. Bu servis tarafından çerez bırakıldığını bilmiyoruz; ayrıntı için DiceBear&apos;ın kendi politikasına bakabilirsin.</p>],
      ['Nasıl kontrol edersin', <p key="d">Tarayıcı ayarlarından çerezleri ve site verilerini silebilirsin. Oturum çerezini silersen çıkış yapmış olursun; yerel depolamayı silersen tercihlerin sıfırlanır.</p>],
    ],
  },
};

export default function Legal() {
  const doc = LEGAL[useLocation().pathname.replace(/^\/|\/$/g, '')];
  if (!doc) return <Navigate to="/" replace />;
  return (
    <div className="mx-auto min-h-screen max-w-3xl px-4 py-8">
      <Link to="/" className="group mb-6 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-slate-100"><ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />Ana sayfa</Link>
      <article className="card !p-7 sm:!p-9">
        <p className="text-xs font-medium uppercase tracking-wide text-accent">Auren Study</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-50">{doc.title}</h1>
        <p className="mt-3 text-slate-300">{doc.lead}</p>
        <p className="mt-1 text-xs text-slate-500">Son güncelleme: {UPDATED}</p>
        <div className="mt-8 space-y-7 text-sm leading-relaxed text-slate-400 [&_b]:font-semibold [&_b]:text-slate-200 [&_li]:mt-1.5 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
          {doc.sections.map(([h, ...body], i) => (
            <section key={h}><h2 className="mb-2 text-base font-semibold text-slate-100">{i + 1}. {h}</h2>{body}</section>))}
        </div>
      </article>
      <LegalLinks className="mt-6 justify-center text-xs text-slate-500" />
    </div>
  );
}
