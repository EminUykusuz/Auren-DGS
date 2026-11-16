# Otomatik dağıtım

`main` dalına her push otomatik dağıtım başlatır.

Her şey tek sunucuda (VDS): API ve arayüz aynı portta, aynı Express süreciyle servis edilir.

1. `check` işi (bulut): arayüzü derler (`client/dist` artifact olur), sunucu dosyalarının sözdizimini denetler. Geçmezse VDS'e dokunulmaz.
2. `deploy-api` işi (VDS'teki self-hosted runner): artifact'ı indirir, `deploy/deploy.ps1`'i çalıştırır. VDS'te arayüz derleme araçlarına gerek yoktur.

(`client/vercel.json` artık kullanılmıyor; Vercel kullanmıyorsan silebilirsin.)

## VDS'te bir kez yapılacaklar (Windows)

1. Workflow, deploy işi başlamadan önce self-hosted runner'a **Node 22** kurar; VDS'e ayrıca sistem geneline kurman gerekmez.
2. **Uygulama klasörü**: varsayılan `C:\auren`. İçinde `server\.env` dosyasını elle oluştur (`server/.env.example`'dan). Önemlisi: `NODE_ENV=production`, `JWT_SECRET`, DB bilgileri, `PORT`, `CORS_ORIGINS=https://aurenstudy.com.tr`, `APP_URL=https://aurenstudy.com.tr`. Site HTTPS değilse `COOKIE_SECURE=false` gerekir (HTTPS önerilir: önüne IIS/Caddy/nginx ile SSL koy). Deploy `.env`'e dokunmaz, git'e de girmez.
3. **Runner kur**: GitHub'da repo → *Settings → Actions → Runners → New self-hosted runner → Windows*. Verilen komutları VDS'te PowerShell (yönetici) ile çalıştır. Etiketler varsayılan (`self-hosted`, `windows`) kalsın. Sonunda **hizmet olarak** kur: `.\config.cmd ... --runasservice` (VDS yeniden başlayınca runner da açılır). Runner hesabı Hizmet/Zamanlanmış Görev oluşturabilmeli (yönetici veya SYSTEM).
4. **API süreci**: `AurenAPI` adlı bir Windows hizmeti (örn. NSSM ile) varsa deploy onu yeniden başlatır. Yoksa ilk deploy `AurenAPI` adlı, açılışta başlayan bir zamanlanmış görev oluşturur. Eskiden `BASLAT.bat` ile açtığın pencereyi kapat ki 5050 portu çakışmasın (betik, portu tutan eski node sürecini de kapatır).
5. **Repo ayarları** (isteğe bağlı): *Settings → Secrets and variables → Actions → Variables* altında `AUREN_APP_DIR` (varsayılan `C:\auren`) ve `AUREN_PORT` (varsayılan `5050`).
6. *Settings → Environments → New environment* → `production` oluştur (istersen "Required reviewers" ekleyip onaylı deploy yap).

## Deploy ne yapar

yedek al → API'yi durdur → `server/` kodunu ve `client\dist`'i kopyala (`.env` ve `node_modules` korunur) → `npm ci --omit=dev` → `npm run migrate` → başlat → `/api/health` kontrolü.
Sağlık kontrolü geçmezse **önceki sürüme otomatik döner** ve iş kırmızı biter. Migration dosyaları idempotent olduğu için geri dönüşte veritabanı şeması geri alınmaz (yalnızca ekleme yapar, eski kod bunlarla çalışır).

Elle tetikleme: *Actions → Deploy → Run workflow*.

## Güvenlik notu

Self-hosted runner repo kodunu VDS'te çalıştırır. Bu yüzden workflow yalnızca `push` ile tetiklenir, `pull_request` yoktur; repo'ya yazma yetkisini yalnızca güvendiğin kişilere ver.

## İletişim e-postası (yasal sayfalar)

Gizlilik ve KVKK sayfalarında başvuru adresi görünmesi için arayüz derlenirken `VITE_CONTACT_EMAIL` tanımlı olmalı: GitHub → *Settings → Secrets and variables → Actions → Variables* altına `VITE_CONTACT_EMAIL` ekle (workflow bunu derlemeye geçirir). Boşsa sayfalar uygulama içi geri bildirim formuna yönlendirir.
