// YKS müfredatı (TYT + AYT ortak ders anahtarları; ders başına konu grupları)
const g = (group, ...topics) => ({ group, topics: topics.map(([label, value]) => ({ label, value })) });

export const YKS_TOPIC_GROUPS = {
  turkce: [
    g('Anlam Bilgisi', ['Sözcükte Anlam', 'sozcukte-anlam'], ['Cümlede Anlam', 'cumlede-anlam'], ['Paragraf', 'paragraf'], ['Anlatım Biçimleri ve Teknikleri', 'anlatim-bicimleri']),
    g('Dil Bilgisi', ['Ses Bilgisi', 'ses-bilgisi'], ['Yapı Bilgisi (Ekler, Kök)', 'yapi-bilgisi'], ['Sözcük Türleri', 'sozcuk-turleri'], ['Cümlenin Ögeleri', 'cumlenin-ogeleri'], ['Cümle Türleri', 'cumle-turleri'], ['Fiilimsi ve Fiilde Çatı', 'fiilimsi-cati']),
    g('Yazım ve Anlatım', ['Yazım Kuralları', 'yazim-kurallari'], ['Noktalama İşaretleri', 'noktalama'], ['Anlatım Bozukluğu', 'anlatim-bozuklugu']),
  ],
  matematik: [
    g('Temel Matematik', ['Temel Kavramlar', 'temel-kavramlar'], ['Sayı Basamakları', 'sayi-basamaklari'], ['Bölme ve Bölünebilme', 'bolme-bolunebilme'], ['EBOB – EKOK', 'ebob-ekok'], ['Rasyonel Sayılar', 'rasyonel-sayilar'], ['Üslü ve Köklü Sayılar', 'uslu-koklu'], ['Mutlak Değer', 'mutlak-deger'], ['Çarpanlara Ayırma', 'carpanlara-ayirma'], ['Oran – Orantı', 'oran-oranti']),
    g('Denklem ve Problemler', ['Denklemler ve Eşitsizlikler', 'denklemler'], ['Sayı ve Kesir Problemleri', 'sayi-kesir-problemleri'], ['Yaş Problemleri', 'yas-problemleri'], ['Yüzde, Kâr – Zarar', 'yuzde-kar-zarar'], ['Karışım Problemleri', 'karisim-problemleri'], ['Hareket Problemleri', 'hareket-problemleri'], ['İşçi – Havuz Problemleri', 'isci-havuz']),
    g('Kümeler ve Fonksiyonlar', ['Kümeler', 'kumeler'], ['Fonksiyonlar', 'fonksiyonlar'], ['Polinomlar', 'polinomlar'], ['İkinci Dereceden Denklemler', 'ikinci-derece'], ['Permütasyon – Kombinasyon – Olasılık', 'pko'], ['Mantık', 'mantik']),
    g('AYT Matematik', ['Trigonometri', 'trigonometri'], ['Logaritma', 'logaritma'], ['Diziler', 'diziler'], ['Limit ve Süreklilik', 'limit'], ['Türev', 'turev'], ['İntegral', 'integral']),
  ],
  geometri: [
    g('Geometri', ['Açılar', 'acilar'], ['Üçgenler', 'ucgenler'], ['Çokgenler ve Dörtgenler', 'cokgen-dortgen'], ['Çember ve Daire', 'cember-daire'], ['Katı Cisimler', 'kati-cisimler'], ['Analitik Geometri', 'analitik'], ['Dönüşümler ve Çemberin Analitiği', 'donusumler']),
  ],
  fizik: [
    g('Fizik', ['Fizik Bilimine Giriş ve Vektörler', 'fizik-giris'], ['Kuvvet ve Hareket', 'kuvvet-hareket'], ['Enerji, İş, Güç', 'enerji'], ['Isı ve Sıcaklık', 'isi-sicaklik'], ['Elektrik ve Manyetizma', 'elektrik-manyetizma'], ['Dalgalar ve Optik', 'dalgalar-optik'], ['Modern Fizik', 'modern-fizik']),
  ],
  kimya: [
    g('Kimya', ['Kimya Bilimi, Atom ve Periyodik Sistem', 'atom-periyodik'], ['Kimyasal Türler Arası Etkileşimler', 'etkilesimler'], ['Maddenin Halleri ve Karışımlar', 'madde-halleri'], ['Kimyasal Hesaplamalar', 'kimyasal-hesaplama'], ['Asit, Baz ve Tuz', 'asit-baz'], ['Enerji ve Tepkime Hızı', 'enerji-hiz'], ['Denge ve Elektrokimya', 'denge-elektro'], ['Organik Kimya', 'organik']),
  ],
  biyoloji: [
    g('Biyoloji', ['Hücre ve Canlıların Yapısı', 'hucre'], ['Canlıların Sınıflandırılması', 'siniflandirma'], ['Hücre Bölünmeleri ve Kalıtım', 'bolunme-kalitim'], ['Ekosistem', 'ekosistem'], ['İnsan Fizyolojisi', 'insan-fizyolojisi'], ['Genden Proteine, Biyoteknoloji', 'gen-protein'], ['Bitki Biyolojisi ve Komünite', 'bitki-komunite']),
  ],
  edebiyat: [
    g('Edebiyat', ['Şiir Bilgisi ve Edebi Sanatlar', 'siir-sanatlar'], ['İslamiyet Öncesi ve Divan Edebiyatı', 'divan'], ['Halk Edebiyatı', 'halk'], ['Tanzimat ve Servet-i Fünun', 'tanzimat-sf'], ['Milli Edebiyat ve Cumhuriyet Dönemi', 'milli-cumhuriyet'], ['Batı Edebiyatı Akımları', 'bati-akimlar']),
  ],
  tarih: [
    g('Tarih', ['İlk Türk Devletleri ve İslam Tarihi', 'ilk-turk-islam'], ['Osmanlı Devleti (Kuruluş – Yükselme)', 'osmanli-yukselme'], ['Osmanlı (Duraklama – Dağılma)', 'osmanli-gerileme'], ['Kurtuluş Savaşı', 'kurtulus-savasi'], ['Atatürk İlke ve İnkılapları', 'ataturk-ilkeleri'], ['Çağdaş Türk ve Dünya Tarihi', 'cagdas-tarih']),
  ],
  cografya: [
    g('Coğrafya', ['Doğa ve İnsan, Harita Bilgisi', 'harita-bilgisi'], ['İklim ve Yerşekilleri', 'iklim-yersekilleri'], ['Nüfus ve Yerleşme', 'nufus-yerlesme'], ['Ekonomik Faaliyetler', 'ekonomik'], ['Türkiye ve Dünya Coğrafyası', 'turkiye-dunya'], ['Çevre ve Doğal Afetler', 'cevre-afet']),
  ],
  felsefe: [
    g('Felsefe ve Mantık', ['Felsefeye Giriş ve Bilgi Felsefesi', 'bilgi-felsefesi'], ['Varlık, Ahlak ve Siyaset Felsefesi', 'varlik-ahlak-siyaset'], ['Bilim, Din ve Sanat Felsefesi', 'bilim-din-sanat'], ['Mantık', 'mantik']),
  ],
  din: [
    g('Din Kültürü', ['İnanç ve İbadet', 'inanc-ibadet'], ['Ahlak ve Değerler', 'ahlak-degerler'], ["Hz. Muhammed ve Kur'an", 'hz-muhammed-kuran'], ['İslam Düşüncesinde Yorumlar', 'islam-dusunce']),
  ],
};
