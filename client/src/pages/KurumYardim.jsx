import { Rocket, ClipboardList, Users, ArrowRightLeft, Palette, ShieldCheck, FileSpreadsheet, Megaphone, TriangleAlert } from 'lucide-react';
import { useAuth } from '../store.js';
import { Block, Steps, Note } from '../components/Guide.jsx';

/* Kurum panelinin kullanım kılavuzu: yönetici ve öğretmen için, ekrandaki sekme adlarıyla birebir. */
export default function KurumYardim() {
  const { user } = useAuth(); const owner = user.role === 'owner';
  const slug = user.institution?.slug;
  return (<>
    <Block icon={Rocket} title="İlk kurulum: 3 adımda hazır" intro="Öğrencilerin giriş yapabilmesi için bu üç adımı sırayla yap. Hepsi birkaç dakika sürer.">
      <Steps items={[
        ...(owner ? [['Sınıfları oluştur', 'Sınıflar sekmesinde "Yeni sınıf" alanına sınıf adını yaz (ör. 8-A, 12-Sayısal) ve Ekle\'ye bas. Adı sonradan değiştirebilir, yıl sonunda arşive alabilirsin.', '/kurum/siniflar', 'Sınıflar sekmesi']] : []),
        ['Öğrencileri ekle', 'Öğrenciler sekmesinde "Excel / CSV\'den toplu ekle" bölümüne Excel\'deki sütunları (Ad, Soyad, No, Sınıf) kopyalayıp yapıştır. Yazmadan önce önizleme gelir; hatalı satırlar sebebiyle işaretlenir. Tek öğrenci için "Tek öğrenci" formunu kullan. Şablonu indirip doldurabilirsin.', '/kurum/ogrenciler', 'Öğrenciler sekmesi'],
        ['Giriş bilgilerini dağıt', 'Eklenen her öğrenci için sistem kullanıcı adı ve geçici şifre üretir. Bilgileri CSV olarak indir veya çıktı al, öğrencilere ver. Öğrenci ilk girişte kendi şifresini belirler.'],
      ]} />
      {slug && <Note>Öğrencilerin giriş adresi: <b className="select-all text-slate-100">{location.origin}/k/{slug}</b>. Bu sayfada kurumunun adı ve logosu görünür. Adresi öğrencilerle paylaş.</Note>}
    </Block>

    <Block icon={ClipboardList} title="Haftalık ödev ver" intro="Sınıfa konu ve hedef soru sayısı ver; öğrenciler kendi panelinde işaretler, sen kimin ne yaptığını görürsün.">
      <Steps items={[
        ['Ödevi oluştur', 'Ödev sekmesinde sınıfı, başlığı ve teslim tarihini seç. "Maddeler" alanına her satıra bir madde yaz: konu; hedef soru (ör. Üslü ifadeler; 40).'],
        ['İstersen dosya ekle', 'Hazır ödev kâğıdın varsa Excel veya PDF olarak (en çok 2 MB) ekle; öğrenciler site üzerinden indirir. Dosya eklemezsen sistem maddelerden bir Excel kâğıdı üretir.'],
        ['Takip et ve indir', 'Ödev listesinde öğrenci öğrenci kimin hangi maddeyi tamamladığı görünür. "Sonuçlar" düğmesiyle tüm sınıfın durumunu Excel olarak indirebilirsin.', '/kurum/odev', 'Ödev sekmesi'],
      ]} />
    </Block>

    <Block icon={ClipboardList} title="Kişiye özel ödev ve Excel ile toplu ödev" intro="Her öğrenciye farklı konu verebilirsin; Excel listesini sisteme okutursun, ödevler öğrencilerin paneline tek tek düşer.">
      <Steps items={[
        ['Şablonu indir', 'Ödev sekmesinde "Kişiye özel ödev" düğmesine bas, "Şablonu indir" de. Excel\'de kapsamındaki öğrencilerin numarası ve adı hazır gelir.'],
        ['Konuları yaz', 'Her satır bir öğrencinin bir konusudur: Konu, Hedef soru, Teslim tarihi. Aynı öğrenciye birden fazla konu vermek için satırı kopyala. Konusu boş satır ödev almaz.'],
        ['Yükle ve kontrol et', '"Excel / CSV yükle" ile dosyayı seç (ya da Excel\'den kopyalayıp yapıştır). Sistem öğrencileri numaraya, numara yoksa ada göre eşler; eşleşmeyen satırları nedeniyle birlikte gösterir. Tarihleri burada öğrenci başına düzeltebilirsin.'],
        ['Öğrenciye e-posta gider', 'Öğrencinin e-posta adresi varsa (Öğrenciler sekmesinde kalem simgesiyle eklenir) ödev verilince "Yeni ödevin var" e-postası otomatik gider. Adresi olmayan öğrenci ödevi yine panelden görür.'],
        ['Gönder', '"Öğrenciye gönder" dediğinde her öğrenci yalnızca kendi ödevini görür. Öğrenci listesinden öğrenci seçip "Ödev ver" ile de aynı ekrana geçebilirsin.'],
      ]} />
      <Note>Öğrenci sınıf değiştirse bile kişisel ödevi kendisinde kalır; öğretmen ise ödevi öğrencinin şu anki sınıfına göre görür.</Note>
    </Block>

    <Block icon={ClipboardList} title="Ödevi bitirme onayı ve teslim tarihi görüşmesi" intro="Öğrenci ödevi bitirdiğini onaylar; teslim gününü seninle konuşarak değiştirebilir.">
      <Steps items={[
        ['Bitirdi onayı', 'Öğrenci "Ödevi bitirdim" deyince tüm maddeler tamamlandı sayılır. Ödev listesinde "Bitirdi" etiketi ve tamamlama oranı görünür.'],
        ['Tarih talebi', 'Öğrenci yeni bir teslim tarihi isterse Ödev sekmesinde ve ödevin yanında turuncu "tarih talebi" rozeti çıkar. Satırdaki mesaj simgesine bas.'],
        ['Yanıtla', '"Kabul et" ya da "Reddet" de; ya da kendin yeni bir tarih belirle ve mesaj yaz. Tarih yalnızca o öğrenci için değişir, sınıfın geri kalanı etkilenmez.'],
      ]} />
    </Block>

    <Block icon={Megaphone} title="Duyuru panosu" intro="Sınav günü, ders değişikliği gibi haberleri öğrencilerin ana sayfasına yaz.">
      <Steps items={[
        ['Duyuru yaz', 'Duyuru sekmesinde kime yazacağını seç: tüm kurum (yalnızca yönetici) ya da bir sınıf. İstersen son gösterim tarihi koy; tarih geçince duyuru öğrencilerden kalkar.'],
        ['Kim okudu?', 'Her duyurunun yanında "12/20 öğrenci okudu" görünür. Öğrenci duyuruda "Okudum" düğmesine basar.'],
      ]} />
    </Block>

    <Block icon={TriangleAlert} title="Dikkat gerektiren öğrenciler" intro="Genel sayfada üç liste otomatik oluşur; kimle ilgilenmen gerektiğini sistem gösterir.">
      <Steps items={[
        ['Uyarı listeleri', '7 günden uzun süredir girmeyenler, son denemesi önceki ortalamasından belirgin düşenler ve 2 ya da daha çok ödevi geciken öğrenciler listelenir. Öğretmen yalnızca kendi sınıflarını görür.'],
      ]} />
    </Block>

    <Block icon={Users} title="Öğrencileri yönet" intro="Öğrenciler sekmesinden her şeyi tek yerden yaparsın.">
      <Steps items={[
        ['Ad veya numara düzelt', 'Öğrencinin satırındaki kalem simgesiyle adını ve öğrenci numarasını değiştir. Aynı numara kurumda iki kez kullanılamaz; aynı isimli öğrencileri numara ve sınıf ayırır.'],
        ['Şifre sıfırla', 'Şifresini unutan öğrenciyi seçip "Şifre sıfırla ve çıktı al" de. Yeni geçici şifre çıkar; öğrenci ilk girişte tekrar değiştirir.'],
        ['Sınıfa taşı', 'Öğrencileri seçip hedef sınıfı belirle ve "Taşı"ya bas. Her taşıma Geçmiş sekmesine kaydedilir.'],
        ['Verileri Excel\'e aktar', 'Genel sekmesindeki "Öğrenci listesi" ve "Deneme sonuçları" düğmeleri .xlsx dosyası indirir.', '/kurum', 'Genel sekmesi'],
      ]} />
    </Block>

    <Block icon={ArrowRightLeft} title="Sınıf değiştirme sınavı sonrası yerleştirme" intro="Sınav sonuçlarına göre öğrencileri sınıflara net sırasıyla dağıtmanı önerir; sen onaylamadan kimse taşınmaz.">
      <Steps items={[
        ['Kimleri değerlendireceğini seç', 'Sınıf değiştirme sekmesinde "Kimler değerlendirilecek?" ve "Son kaç denemenin ortalaması?" bölümlerini doldur.'],
        ['Kademeleri belirle', 'En yüksek netten başlayarak her kademe için farklı bir sınıf seç ("Kademe ekle"). Kalan herkes için de bir sınıf belirleyebilirsin.'],
        ['Öneriyi incele ve uygula', 'Kimin hangi sınıfa gideceği net ortalamalarıyla listelenir. "Uygula" demeden hiçbir öğrenci taşınmaz. İstersen geçmişe yazılacak bir not ekle.', '/kurum/yerlestirme', 'Sınıf değiştirme sekmesi'],
      ]} />
    </Block>

    {owner && <Block icon={ShieldCheck} title="Öğretmenler ve yetkiler" intro="Yalnızca kurum yöneticisi öğretmen ekleyebilir ve sınıf atayabilir.">
      <Steps items={[
        ['Öğretmen ekle', 'Öğretmenler sekmesinde ad, soyad ve sorumlu olduğu sınıfları seçip "Öğretmen ekle" de. Kullanıcı adı ve geçici şifre üretilir.', '/kurum/ogretmenler', 'Öğretmenler sekmesi'],
        ['Yetki farkı', 'Öğretmen yalnızca kendine atanan sınıfların öğrencilerini, ödevlerini ve sonuçlarını görür. Sınıf oluşturma, öğretmen yönetimi ve marka ayarları yalnızca yöneticidedir.'],
        ['Şifre sıfırla', 'Şifresini unutan öğretmen için satırdaki "Şifre sıfırla" düğmesini kullan.'],
      ]} />
    </Block>}

    {owner && <Block icon={Palette} title="Kurumunun markası" intro="Öğrenci giriş sayfası ve paneli kurumunun görünümüyle açılır.">
      <Steps items={[
        ['Logo yükle', 'Marka sekmesinden PNG, JPEG veya WebP logo yükle. Büyük görseller otomatik küçültülür; şeffaf arka planlı PNG en iyi sonucu verir.', '/kurum/marka', 'Marka sekmesi'],
        ['Rengi seç', 'Kurum renginin kodunu seçip Kaydet\'e bas. Düğme ve vurgular bu renkle görünür.'],
      ]} />
    </Block>}

    <Block icon={FileSpreadsheet} title="Kısa ipuçları">
      <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-400">
        <li>Genel sekmesinde öğrenci sayısını, bu hafta aktif olanları ve ilk girişini henüz yapmamış öğrencileri görürsün. İlk girişi bekleyenlere bilgilerini tekrar ulaştır.</li>
        <li>Excel&apos;den yapıştırırken sınıf adı daha önce yoksa sistem o sınıfı kendisi oluşturur (yönetici hesabında). Öğretmenler yalnızca kendi sınıflarına öğrenci ekleyebilir.</li>
        <li>Öğrenciler yalnızca kendi kurumlarındaki arkadaşlarıyla görünür; başka kurumların verisi hiçbir zaman görünmez.</li>
        <li>Bir sorun yaşarsan ya da yeni bir şey istersen bize yaz; kurum paneli senin geri bildirimlerinle gelişiyor.</li>
      </ul>
    </Block>
  </>);
}
