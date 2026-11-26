# Otomatik dağıtım

Normal yayın için VDS'te `YAYINLA.bat` dosyasını yönetici olarak çalıştır. Betik GitHub `main` dalının geçici bir kopyasını indirir, arayüzü derler, sunucuya dağıtır, migration'ları çalıştırır ve API sağlık kontrolünü yapar. Push ile otomatik dağıtım kapalıdır; Actions workflow'u yalnızca elle tetiklenebilir.

Her şey tek sunucuda (VDS): API ve arayüz aynı portta, aynı Express süreciyle servis edilir.

1. `check` işi (bulut): arayüzü derler (`client/dist` artifact olur), sunucu dosyalarının sözdizimini denetler. Geçmezse VDS'e dokunulmaz.
2. `deploy-api` işi (VDS'teki self-hosted runner): artifact'ı indirir, `deploy/deploy.ps1`'i çalıştırır. VDS'te arayüz derleme araçlarına gerek yoktur.

`YAYINLA.bat`, `origin/main`'i ayrı ve geçici bir worktree'de hazırlar; `server` klasöründe yerel değişiklik görürse dosyaları ezmemek için durur. `server\.env`, veritabanı ve mevcut Caddy/DNS ayarlarına dokunmaz.

## VDS'te bir kez yapılacaklar (Windows)

1. `YAYINLA.bat`, **Node 22**'yi PATH'te veya Actions runner önbelleğinde arar. İkisi de yoksa VDS'e Node 22 kur.
2. **Uygulama klasörü**: workflow hedefi `C:\Auren-DGS`; `server\.env` burada bulunmalı. Dosyayı elle oluştur (`server/.env.example`'dan). Önemlisi: `NODE_ENV=production`, `JWT_SECRET`, DB bilgileri, `PORT`, `CORS_ORIGINS=https://aurenstudy.com.tr`, `APP_URL=https://aurenstudy.com.tr`. Site HTTPS değilse `COOKIE_SECURE=false` gerekir (HTTPS önerilir: önüne IIS/Caddy/nginx ile SSL koy). Deploy `.env`'e dokunmaz, git'e de girmez.
3. GitHub Actions'tan manuel deploy kullanacaksan **self-hosted runner** kur: GitHub'da repo → *Settings → Actions → Runners → New self-hosted runner → Windows*. Normal yayın için `YAYINLA.bat` runner gerektirmez.
4. **API süreci**: `AurenAPI` adlı bir Windows hizmeti (örn. NSSM ile) varsa deploy onu yeniden başlatır. Yoksa ilk deploy `AurenAPI` adlı, açılışta başlayan bir zamanlanmış görev oluşturur. Eskiden `BASLAT.bat` ile açtığın pencereyi kapat ki 5050 portu çakışmasın (betik, portu tutan eski node sürecini de kapatır).
5. GitHub Actions'tan manuel deploy kullanacaksan isteğe bağlı olarak `AUREN_PORT` değişkenini ayarla (varsayılan `5050`). `YAYINLA.bat` `C:\Auren-DGS` klasörünü ve `5050` portunu kullanır.
6. *Settings → Environments → New environment* → `production` oluştur (istersen "Required reviewers" ekleyip onaylı deploy yap).

## Deploy ne yapar

yedek al → API'yi durdur → `server/` kodunu ve `client\dist`'i kopyala (`.env` ve `node_modules` korunur) → `npm ci --omit=dev` → `npm run migrate` → başlat → `/api/health` kontrolü.
Sağlık kontrolü geçmezse **önceki sürüme otomatik döner** ve iş kırmızı biter. Migration dosyaları idempotent olduğu için geri dönüşte veritabanı şeması geri alınmaz (yalnızca ekleme yapar, eski kod bunlarla çalışır).

Elle tetikleme: *Actions → Deploy → Run workflow*.

## Güvenlik notu

Self-hosted runner repo kodunu VDS'te çalıştırır. Repo herkese açık olduğundan workflow yalnızca `main`'e **push** (yazma yetkisi gerekir) ve elle tetiklemeyle çalışır; `pull_request` tetikleyicisi EKLEME. Runner kurulu olduğu `C:\Users\Administrator\actions-runner` yolunun üst klasörlerini `NETWORK SERVICE` hesabı listeleyebilmelidir; "Access to the path C:\Users\Administrator is denied" hatasıyla servis hemen kapanıyorsa şunu çalıştır (alt klasörlere yayılmaz): `icacls C:\Users\Administrator /grant "NT AUTHORITY\NETWORK SERVICE:(RX)"` ve servisi başlat. Servis durumu: `Get-Service actions.runner.*`.

## İletişim e-postası (yasal sayfalar)

Gizlilik ve KVKK sayfalarında başvuru adresi görünmesi için `VITE_CONTACT_EMAIL` tanımla. `YAYINLA.bat` kullanıyorsan bunu `client/.env.production` içine ekle; Actions'tan manuel deploy ediyorsan GitHub Actions Variables olarak ayarla. Boşsa sayfalar uygulama içi geri bildirim formuna yönlendirir.
