import { LogIn, ClipboardCheck, BookOpen, Timer, LayoutDashboard, Users, ClipboardList, Settings } from 'lucide-react';
import { useAuth } from '../store.js';
import { Page, Title } from '../components/ui.jsx';
import { Block, Steps, Note } from '../components/Guide.jsx';

/* Öğrenci paneli kılavuzu: menüdeki sayfa adlarıyla aynı sırada. Kurum öğrencisine ödev bölümü de gösterilir. */
export default function Yardim() {
  const { user } = useAuth(); const inKurum = !!user.institution;
  return (
    <Page>
      <Title>Nasıl kullanılır?</Title>
      <p className="-mt-2 text-sm text-slate-400">Auren Study&apos;yi ilk kez açtıysan sırayla bu kartlara bak. Her kart sol menüdeki bir sayfayı anlatır.</p>

      <Block icon={LogIn} title="Giriş ve ilk adımlar">
        <Steps items={inKurum ? [
          ['Bilgilerinle gir', 'Kurumunun verdiği kullanıcı adı ve geçici şifreyle kurumunun giriş adresinden gir.'],
          ['Şifreni değiştir', 'İlk girişte kendi şifreni belirlemen istenir. Sonra bu şifreyle girersin.'],
          ['Sınavını kontrol et', 'Panel, müfredat ve istatistikler hesabının sınav türüne (DGS, YKS veya LGS) göre açılır. Yanlış görünüyorsa kurum yöneticine söyle.'],
        ] : [
          ['Hesap aç', 'Kayıt ol sayfasında kullanıcı adı ve e-posta ile hesabını oluştur; sınavını (DGS, YKS, LGS veya DGS ile YKS birlikte) seç.'],
          ['Sınav tarihini gir', 'Ayarlar sayfasından sınav tarihini yazarsan panelde geri sayım görünür.', '/ayarlar', 'Ayarlar'],
        ]} />
      </Block>

      <Block icon={ClipboardCheck} title="Denemeni kaydet (Denemeler)" intro="Her deneme bittiğinde sonucunu gir; gelişimin buradan takip edilir.">
        <Steps items={[
          ['Deneme bilgilerini yaz', 'Denemeler sayfasında deneme adını, tarihini ve bölümünü (ör. TYT, AYT) seç.', '/denemeler', 'Denemeler'],
          ['Doğru ve yanlış sayını gir', 'Her ders için doğru ve yanlış sayını yaz. Net kendiliğinden hesaplanır: DGS, TYT ve AYT\'de 4 yanlış 1 doğruyu, LGS\'de 3 yanlış 1 doğruyu götürür.'],
          ['Hata nedenini işaretle', 'Yanlışlarının nedenini (dikkat, işlem, formül, konu, süre ya da diğer) belirt. Panel hangi nedenle puan kaybettiğini sayılarla gösterir.'],
        ]} />
      </Block>

      <Block icon={BookOpen} title="Çalışmanı kaydet (Çalışma kaydı)" intro="Konu çalıştıkça kısa bir kayıt aç; haftalık süren ve çözdüğün soru sayısı buradan oluşur.">
        <Steps items={[
          ['Ders ve konuyu seç', 'Çalışma kaydı sayfasında çalıştığın dersi ve konuyu seç.', '/calisma', 'Çalışma kaydı'],
          ['Süre ve soru sayısını yaz', 'Kaç dakika çalıştığını, kaç soru çözdüğünü ve kaçını doğru yaptığını gir.'],
        ]} />
      </Block>

      <Block icon={Timer} title="Zamanlayıcı ile çalış">
        <Steps items={[
          ['Süreleri ayarla ve başlat', 'Zamanlayıcı sayfasında odak, kısa mola ve uzun mola sürelerini ayarla; hangi ders ve konuyu çalıştığını seç ve başlat. İstersen "Odak modu" ile ekranı sadeleştir (çıkmak için Esc).', '/kronometre', 'Zamanlayıcı'],
          ['Oturumu kaydet', 'Biten çalışma süresi, seçtiğin konuya kayıt olarak eklenir ve haftalık toplamına yansır.'],
        ]} />
      </Block>

      <Block icon={LayoutDashboard} title="Panel ve müfredat">
        <Steps items={[
          ['Panelde gelişimini izle', 'Ana sayfada bu haftaki çalışma süren, ortalama ve en iyi netin, net trendin ve konu ilerlemen görünür.', '/', 'Panel'],
          ['Müfredatta konu gücünü gör', 'Müfredat sayfası derslerini ve konularını listeler. Denemelerin ve çalışma kayıtların üzerinden hangi konuda güçlü, hangisinde zayıf olduğunu ve neye dönmen gerektiğini gösterir.', '/mufredat', 'Müfredat'],
        ]} />
      </Block>

      <Block icon={Users} title="Arkadaşlarınla yarış">
        <Steps items={[
          ['Arkadaş ekle', 'Arkadaşlar sayfasında arkadaşının kullanıcı adını yazıp istek gönder. Kabul edince listende görünür.', '/arkadaslar', 'Arkadaşlar'],
          ['Haftalık sıralama', 'Haftalık puan; çalışma süren, çözdüğün soru sayısı ve deneme netlerinden oluşur. Bir arkadaşını seçip kendinle karşılaştırabilirsin.'],
        ]} />
        {inKurum && <Note>Kurum hesabında yalnızca kendi kurumundaki arkadaşlarını görürsün.</Note>}
      </Block>

      {inKurum && <Block icon={ClipboardList} title="Haftalık ödevlerin (Ödevler)" intro="Öğretmeninin sınıfına verdiği ödevler burada listelenir.">
        <Steps items={[
          ['Maddeleri işaretle', 'Ödevler sayfasında her madde için konuyu ve hedef soru sayısını görürsün. Bitirdiklerini işaretle; öğretmenin ilerlemeni görür.', '/odev', 'Ödevler'],
          ['Kâğıdı indir', 'Excel olarak ödev kâğıdını ya da öğretmenin eklediyse ödev dosyasını indirebilirsin.'],
          ['Sana özel ödevler', 'Öğretmenin sana özel ödev de verebilir; "Sana özel" etiketiyle görünür ve yalnızca sen görürsün. Menüdeki sayı, teslim etmediğin ödevlerinin sayısıdır.'],
          ['Bitirdim de', 'Ödevin bitince "Ödevi bitirdim" düğmesine bas; tüm maddeler tamamlandı sayılır ve öğretmenin görür. Yanlışlıkla bastıysan "Geri al" diyebilirsin.'],
          ['Teslim gününü konuş', 'Süre yetmiyorsa ödevin altındaki "Teslim tarihini öğretmenle konuş" bölümünden yeni bir tarih iste ve kısa bir not yaz. Öğretmenin kabul eder, reddeder ya da kendi tarihini yazar; yeni tarih ödevinde görünür.'],
        ]} />
      </Block>}

      <Block icon={Settings} title="Ayarlar">
        <Steps items={[
          ['Profilini düzenle', 'Ayarlar sayfasında adını, avatarını ve şifreni değiştirebilirsin.' + (inKurum ? '' : ' Sınav tarihini de buradan girersin.') + '', '/ayarlar', 'Ayarlar'],
          ['Görünümü seç', 'Tema ve arka plan seçeneklerini beğenine göre değiştirebilirsin. Cihazın yavaşlarsa "Performans modu (efektleri azalt)" seçeneğini aç.'],
        ]} />
      </Block>
    </Page>
  );
}
