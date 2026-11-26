# Optik okuyucu (Python)

Kağıda basılan optik formu telefon fotoğrafı ya da tarayıcı çıktısından okur, cevap anahtarıyla netini hesaplar, CSV/JSON verir.

## Kurulum (bir kez)
```
cd tools/optik
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
```

## 1) Formu üret ve yazdır
```
.venv\Scripts\python make_sheet.py --questions 90 --title "TYT Deneme 1" --out out/form
```
`out/form.pdf` dosyasını **%100 ölçekle** bas ("sayfaya sığdır" kapalı). A4, en çok 120 soru, A-E seçenek, 8 haneli öğrenci no.
Dört köşedeki siyah kareler kesilmemeli; fotoğraf çekerken dört köşe de görünmeli.

## 2) Okut
```
.venv\Scripts\python read.py taramalar/ --questions 90 --key-file cevap.txt --out out/sonuc --debug out/debug
```
- Girdi: JPG/PNG/PDF ya da klasör (PDF'te her sayfa bir form).
- `--key` / `--key-file`: soru sayısı kadar karakter. `A-E` doğru cevap, `-` anahtarda tanımsız, `*` iptal (herkese doğru).
- `--wrong-div 4` (DGS/YKS) ya da `3` (LGS). Boş ve çoklu işaret ne doğru ne yanlış sayılır.
- Çıktı: `out/sonuc.csv` (Excel'de açılır, `;` ayraçlı) ve `.json`. `--debug` klasörü her formun düzeltilmiş halini, okunan işaretlerin üstüne halka çizerek kaydeder.

Cevap kodları: harf = işaret, `-` boş, `*` birden fazla işaret. Öğrenci no: `_` boş basamak, `?` çoklu işaret.

## Hata azaltma
Köşe işaretiyle perspektif düzeltme, 4 yönde otomatik yön bulma (baş aşağı tarama), ışık/gölge dengeleme, çoklu eşikleme.
Emin olamadığı satırlar **uyarı** olarak yazılır (silik işaret, çoklu işaret); okunamayan formlar sessizce atlanmaz, `hata` sütununa nedeni yazılır. Uyarılı formları gözle kontrol et.

## Kendi kendini sınama
```
.venv\Scripts\python selftest.py --n 40 --questions 120 --hard
```
Rastgele doldurulmuş formları eğim, perspektif, gölge, gürültü, JPEG ve baş aşağı çevirmeyle bozup doğruluğu ölçer.
Bu makinedeki sonuç: sert modda 80 form / 9600 soru %100, öğrenci no hatası 0. **Gerçek kâğıt, gerçek kalem ve gerçek telefon fotoğrafıyla henüz denenmedi**; ilk gerçek denemede birkaç formu `--debug` ile kontrol et.
