// LGS müfredatı (8. sınıf, MEB kazanımlarına göre ders ve ünite başlıkları). Ders anahtarı = deneme bölümü anahtarı.
const g = (group, ...topics) => ({ group, topics: topics.map(([label, value]) => ({ label, value })) });

export const LGS_TOPIC_GROUPS = {
  turkce: [
    g('Anlam', ['Sözcükte Anlam', 'sozcukte-anlam'], ['Cümlede Anlam', 'cumlede-anlam'], ['Paragraf', 'paragraf'], ['Söz Sanatları', 'soz-sanatlari']),
    g('Dil Bilgisi', ['Fiilimsiler', 'fiilimsiler'], ['Cümlenin Ögeleri', 'cumlenin-ogeleri'], ['Fiillerde Çatı', 'fiillerde-cati'], ['Cümle Türleri', 'cumle-turleri'], ['Anlatım Bozuklukları', 'anlatim-bozuklugu']),
    g('Yazım ve Metin', ['Yazım Kuralları', 'yazim-kurallari'], ['Noktalama İşaretleri', 'noktalama'], ['Metin Türleri', 'metin-turleri']),
  ],
  matematik: [
    g('Sayılar', ['Çarpanlar ve Katlar', 'carpanlar-katlar'], ['Üslü İfadeler', 'uslu-ifadeler'], ['Kareköklü İfadeler', 'karekoklu-ifadeler']),
    g('Cebir', ['Cebirsel İfadeler ve Özdeşlikler', 'cebirsel-ifadeler'], ['Doğrusal Denklemler', 'dogrusal-denklemler'], ['Eşitsizlikler', 'esitsizlikler']),
    g('Geometri', ['Üçgenler', 'ucgenler'], ['Eşlik ve Benzerlik', 'eslik-benzerlik'], ['Dönüşüm Geometrisi', 'donusum-geometrisi'], ['Geometrik Cisimler', 'geometrik-cisimler']),
    g('Veri ve Olasılık', ['Veri Analizi', 'veri-analizi'], ['Basit Olayların Olma Olasılığı', 'olasilik']),
  ],
  fen: [
    g('Fen Bilimleri', ['Mevsimler ve İklim', 'mevsimler-iklim'], ['DNA ve Genetik Kod', 'dna-genetik'], ['Basınç', 'basinc'], ['Madde ve Endüstri', 'madde-endustri'], ['Basit Makineler', 'basit-makineler'],
      ['Enerji Dönüşümleri ve Çevre Bilimi', 'enerji-cevre'], ['Elektrik Yükleri ve Elektrik Enerjisi', 'elektrik']),
  ],
  inkilap: [
    g('T.C. İnkılap Tarihi ve Atatürkçülük', ['Bir Kahraman Doğuyor', 'bir-kahraman'], ['Milli Uyanış', 'milli-uyanis'], ['Milli Bir Destan', 'milli-destan'], ['Atatürkçülük ve Çağdaşlaşan Türkiye', 'ataturkculuk'],
      ['Demokratikleşme Çabaları', 'demokratiklesme'], ['Atatürk Dönemi Türk Dış Politikası', 'dis-politika'], ['Atatürk Sonrası Dönem', 'ataturk-sonrasi']),
  ],
  din: [
    g('Din Kültürü ve Ahlak Bilgisi', ['Kader İnancı', 'kader'], ['Zekât ve Sadaka', 'zekat-sadaka'], ['Din ve Hayat', 'din-hayat'], ['Hz. Muhammed’in Örnekliği', 'hz-muhammed'], ['Kur’an-ı Kerim ve Özellikleri', 'kuran']),
  ],
  ingilizce: [
    g('İngilizce', ['Friendship', 'friendship'], ['Teen Life', 'teen-life'], ['In the Kitchen', 'in-the-kitchen'], ['On the Phone', 'on-the-phone'], ['The Internet', 'the-internet'],
      ['Adventures', 'adventures'], ['Tourism', 'tourism'], ['Chores', 'chores'], ['Science', 'science'], ['Natural Forces', 'natural-forces']),
  ],
};
