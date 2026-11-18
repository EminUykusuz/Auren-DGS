# Auren Study — brag planı

**Ne:** DGS ve YKS adayları için çalışma süresi, deneme neti ve konu güç analizi takibi + arkadaşlarla haftalık sıralama (ücretsiz, aurenstudy.com.tr).
**Kim için:** 19–25 yaş, DGS'ye hazırlanan öğrenciler.
**Ton:** `polished` + `cinematic` dokunuşu — Apple tarzı, sakin, uzun tutuşlar, yumuşak geçişler. Şaka yok.
**Format:** vertical 1080×1920, 30 fps, **28 sn** (kullanıcı 25–30 sn istedi). Müzik 120 BPM → 1 vuruş = 0,5 sn, 1 ölçü = 2 sn; her kesim vuruşta.
**Görsel kimlik:** projenin kendi CSS'i (tailwind derlemesi) — `#090A0F` zemin, `#10B981` vurgu, `#06B6D4` ikincil, Inter. Logo: `favicon.svg` işareti (D + nokta).

## Açı
"Çalıştığını biliyorsun; ilerlediğini görüyor musun?" — gece lambası altında çalışan öğrenciden, ilerlemeyi gösteren sakin bir panele geçiş. Lamba söner, ekran yanar.

## Storyboard (yazı güvenli bölgesi y 250–1536, alt yarıda sağ 140 px boş)

| Süre | Sahne | Ekranda |
|---|---|---|
| 0–5 | **Gece masası.** Lamba ışığı, arkadan öğrenci silüeti, defter, ince saat 02:47, uçuşan toz. Saat tıkırtısı. | "Her gün çalışıyorsun." (0,5) → "Peki gerçekten **ilerliyor** musun?" (2,5) |
| 5–12 | **Lamba söner (5,0 vuruş).** Karanlıktan logo çizilir (gerçek işaret), "Auren Study" yazısı. 8,0'da logo yukarı küçülür. | "Çalışmanı takip et." (8,0) · "Eksiklerini keşfet." (9,0) · "Gelişimini gör." (10,0) |
| 12–22 | **Gerçek arayüz bileşenleri, 4 × 2,5 sn.** | 1) Günlük çalışma kaydı (Stat + Geçmiş tablosu) 2) Deneme net analizi (Stat + Net trendi) 3) Konu güç analizi (rozet + güç çubuğu) 4) Hedef & istatistik (geri sayım + haftalık sıralama) |
| 22–28 | **Final.** Logo, "Auren Study", tagline, adres. Son 3 sn sabit. | "Hedefine giden **yolu gör.**" · aurenstudy.com.tr · DGS ve YKS için ücretsiz |

## Dürüstlük notları
- Arayüz sahneleri projenin kendi bileşenlerinin (Stat, Bar, SortTable, Countdown, Curriculum rozetleri) işaretlemesi + CSS'iyle kurulur; ekran görüntüsü uydurulmaz.
- Rakamlar ve kullanıcı adları açıkça örnek veridir (`@deniz`, `@ece`…); sahnelerde "Örnek verilerle gösterim" notu var. Başarı vaadi yok.
- Gerçek çekim olmadığından öğrenci sahnesi **stilize hareketli grafik** (silüet). İstersen kendi çekiminle değiştirilebilir.
- Seslendirme yok.

## Ses
Tümü Python ile sentezlenir, tek vuruş ızgarasında (0'dan sayılır): La minör (Am–F–C–G), her ölçü 2 sn.
- 0–5: pad + saat tık-tak (her 1 sn) + ince tel çalgısı yok; 3,5–5 yükselen riser.
- 5,0: lamba "klik" + sessizlik, 5,5'te logo çanı; kick 5,5'ten itibaren.
- 8–12 hi-hat, 12–22 tam groove (kick, klap, arp, bas), geçişlerde hafif whoosh, arayüz girişlerinde yumuşak blip.
- 22,0: final vuruş; kuyruk 28'e doğru yumuşakça söner.
Efektler müziğin altında, aynı anahtarda ve aynı reverb odasında.
