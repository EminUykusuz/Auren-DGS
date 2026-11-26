# Kurum (Dershane) Paneli — Uygulama Akışı

Branch: `feature/kurum-paneli` (main'e dokunulmaz, push yok). Her faz ayrı commit.

## Roller
| Rol | Kim | Yapabilir |
|---|---|---|
| `admin` (mevcut `IsAdmin`) | Biz (platform) | Kurum oluşturur, kurum yöneticisi atar |
| `owner` | Dershane müdürü/yöneticisi | Logo, sınıflar, öğretmenler, öğrenciler, sınıf değiştirme, kurum denemeleri, ödev |
| `teacher` | Öğretmen | Yalnızca atandığı sınıflarda: öğrenci ekleme/şifre sıfırlama, taşıma (iki sınıf da kendisinin ise), deneme sonucu girme, ödev |
| `student` | Öğrenci | Mevcut uygulama + kurum logosu + ödevler |
| bireysel | Kuruma bağlı olmayan eski kullanıcılar | Hiçbir şey değişmez (`InstitutionId IS NULL`) |

## Güvenlik kuralları (pazarlığa kapalı)
1. Kuruma ait her sorgu `InstitutionId = req.institutionId` ile süzülür. ID parametresi tek başına asla yeterli değil (anti-IDOR; başka kurumun kaydı 404 döner).
2. Kurum öğrencileri arkadaş aramasında global görünmez; yalnızca aynı kurumdakilerle arkadaşlık kurulabilir (çocuk verisi).
3. Geçici şifre bir kez gösterilir, hash'lenir, ilk girişte değiştirmek zorunlu (`MustChangePassword`).
4. Kurum pasifse (`IsActive=0`) tüm kullanıcıları anında oturum dışı kalır.
5. Logo: yalnızca png/jpeg/webp (SVG yok → XSS yok), en çok 300 KB, DB'de saklanır.

## Fazlar
| # | Faz | İçerik | Durum |
|---|---|---|---|
| 0 | Plan + saf mantık modülleri | kullanıcı adı/şifre üretimi, CSV/Excel-yapıştır ayrıştırma, yetki yardımcıları + unit test | YAZILDI (DB'de denenmedi) |
| 1 | Altyapı | migration 009 (Institutions, Classes, TeacherClasses, ClassTransfers, Users rol/kurum/sınıf/StudentNo/MustChangePassword), requireAuth, requireStaff/Owner | YAZILDI (DB'de denenmedi) |
| 2 | Kurum + marka | admin: kurum oluştur; `/k/:slug` markalı giriş; logo yükle/servis; öğrenci uygulamasında logo | YAZILDI (DB'de denenmedi) |
| 3 | Sınıf + öğrenci | sınıf CRUD, tek tek ve **toplu (Excel yapıştır / CSV) öğrenci ekleme**, giriş bilgisi çıktısı (CSV), şifre sıfırlama, öğretmen hesapları | YAZILDI (DB'de denenmedi) |
| 4 | Sınıf değiştirme | tekli/toplu taşıma, geçmiş (ClassTransfers), sıralamaya göre öneri ("ilk N → A sınıfı") | YAZILDI (DB'de denenmedi) |
| 5 | Kurum denemeleri | öğretmen deneme tanımlar, sonuçları toplu yapıştırır → öğrencilerin Denemeler sayfasına düşer; sınıf sıralaması | YAPILMADI |
| 6 | Haftalık ödev | sınıfa ödev (konu, soru hedefi, bitiş), öğrenci işaretler, öğretmen takip eder | YAPILMADI |
| 7 | Yanlış defteri | fotoğraflı soru bazlı kayıt (istemcide sıkıştırma, DB'de saklama) | YAPILMADI |
| 8 | LGS | ayrı net kuralı (3 yanlış 1 doğru), ayrı müfredat/bölümler, `ExamTrack='LGS'` (diğerleriyle karışmaz) | YAPILMADI |

## Ek işler (gece 2)
- **Landing** yeniden tasarlandı (optik cevap kâğıdı konsepti; Literata kendi sunucumuzdan; görseller `client/public/landing`, krediler altbilgide). Denetçi: 0 hata. Tarayıcıda canlı elle bakılmadı (yalnızca ekran görüntüleri).
- **Platform sahibi her şeyi görür:** `GET /api/admin/institutions/:id/detail`, `GET /api/admin/users/:id/detail` (salt okunur, kurum süzgeci yok), Admin > Kurumlar satırında "Ayrıntı".
- **Excel (.xlsx) dışa aktarma** (bağımlılıksız yazıcı `server/src/xlsx.js`): `/api/kurum/export/students.xlsx`, `/api/kurum/export/exams.xlsx` (kapsama göre), `/api/admin/export/all.xlsx`. Gerçek Excel'de açılışı denenmedi (zip/XML geçerliliği ve birim testi var).
- Bekleyenler: SMTP (hesap bekleniyor), sunucu hatası + deploy (erişim bekleniyor), optik okuyucu (biçim bilgisi bekleniyor), haftalık ödev Excel + gönderim (Faz 6).

## Excel kolaylaştırma
- Excel'den hücreleri kopyala → kutuya yapıştır (sekmeyle ayrılmış) ya da `.csv` yükle.
- Önizleme tablosu: satır satır hata gösterir (eksik ad, tekrar eden numara…), düzeltmeden içeri almaz.
- Şablon indir (`ogrenci-sablonu.csv`). Türkçe Excel `;` ayracı ve UTF-8 BOM desteklenir.
- Sonuç: oluşturulan kullanıcı adı + geçici şifre listesi tek tıkla CSV indirilir (yazdırılıp dağıtılır).

## Durum notu
- Faz 0-4 kodlandı, commit'li. Faz 5-8 (kurum denemeleri, ödev, yanlış defteri, LGS) **başlanmadı**.
- SQL Server geliştirme makinesinde kapalıydı: migration 009, kurum.js SQL'leri ve test/kurum.test.js **hiç çalıştırılmadı**.
- Doğrulananlar: kurum-lib birim testleri (10/10), HTTP smoke (yetki kapıları 401, gövde limitleri, hesap bazlı giriş limiti), istemci `vite build`.
- Doğrulanamayanlar: tüm SQL, arayüzün tarayıcıda görünüşü (tarayıcı bağlantısı yoktu).
- Bilinen eksikler: kurum öğrencisinin Ayarlar sayfasında yer tutucu e-posta (@ogrenci.invalid) görünebilir; öğretmen/yönetici "ad düzenle" arayüzü yok (API var); öğrenci başına sınıf bilgisi öğrenci panelinde gösterilmiyor.

## Canlıya alma kontrol listesi (sabah sen)
1. Branch'i incele, `server/migrations/009_institutions.sql` dosyasını oku.
2. **DB yedeği al**, sonra `npm run migrate`.
3. `cd server && node --test test/kurum.test.js` sonra `npm test` (DB'ye karşı çalışır). İlk çalıştırmada SQL hataları çıkması olası; düzeltmeye hazırım.
4. Admin ile bir deneme kurumu oluştur, akışı elle dene.
5. Sonra main'e birleştir ve `YAYINLA.bat`.
