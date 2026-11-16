# Otomatik dağıtım

`main` dalına her push şunları yapar:

| Parça | Nasıl yayınlanır |
|---|---|
| **Arayüz** (`client/`) | Vercel, GitHub bağlantısıyla kendisi derleyip yayınlar (`client/vercel.json`). Vercel projesinde *Root Directory* = `client` olmalı. |
| **API** (`server/`) | `.github/workflows/deploy.yml` → VDS'teki self-hosted runner `deploy/deploy.ps1`'i çalıştırır. |

Önce bulut tarafında kontrol işi (`check`) arayüzü derler ve sunucu dosyalarının sözdizimini denetler; geçmezse VDS'e dokunulmaz.

## VDS'te bir kez yapılacaklar (Windows)

1. **Node 22** kurulu olsun (`node -v`).
2. **Uygulama klasörü**: varsayılan `C:\auren`. İçinde `server\.env` dosyasını elle oluştur (`server/.env.example`'dan; `NODE_ENV=production`, `JWT_SECRET`, DB bilgileri, `CORS_ORIGINS` …). Deploy `.env`'e dokunmaz, git'e de girmez.
3. **Runner kur**: GitHub'da repo → *Settings → Actions → Runners → New self-hosted runner → Windows*. Verilen komutları VDS'te PowerShell (yönetici) ile çalıştır. Etiketler varsayılan (`self-hosted`, `windows`) kalsın. Sonunda **hizmet olarak** kur: `.\config.cmd ... --runasservice` (VDS yeniden başlayınca runner da açılır). Runner hesabı Hizmet/Zamanlanmış Görev oluşturabilmeli (yönetici veya SYSTEM).
4. **API süreci**: `AurenAPI` adlı bir Windows hizmeti (örn. NSSM ile) varsa deploy onu yeniden başlatır. Yoksa ilk deploy `AurenAPI` adlı, açılışta başlayan bir zamanlanmış görev oluşturur. Eskiden `BASLAT.bat` ile açtığın pencereyi kapat ki 5050 portu çakışmasın (betik, portu tutan eski node sürecini de kapatır).
5. **Repo ayarları** (isteğe bağlı): *Settings → Secrets and variables → Actions → Variables* altında `AUREN_APP_DIR` (varsayılan `C:\auren`) ve `AUREN_PORT` (varsayılan `5050`).
6. *Settings → Environments → New environment* → `production` oluştur (istersen "Required reviewers" ekleyip onaylı deploy yap).

## Deploy ne yapar

yedek al → API'yi durdur → `server/` kodunu kopyala (`.env` ve `node_modules` korunur) → `npm ci --omit=dev` → `npm run migrate` → başlat → `/api/health` kontrolü.
Sağlık kontrolü geçmezse **önceki sürüme otomatik döner** ve iş kırmızı biter. Migration dosyaları idempotent olduğu için geri dönüşte veritabanı şeması geri alınmaz (yalnızca ekleme yapar, eski kod bunlarla çalışır).

Elle tetikleme: *Actions → Deploy → Run workflow*.

## Güvenlik notu

Self-hosted runner repo kodunu VDS'te çalıştırır. Bu yüzden workflow yalnızca `push` ile tetiklenir, `pull_request` yoktur; repo'ya yazma yetkisini yalnızca güvendiğin kişilere ver.

## İletişim e-postası (yasal sayfalar)

Gizlilik ve KVKK sayfalarında başvuru adresi görünmesi için Vercel ortam değişkeni ekle: `VITE_CONTACT_EMAIL=...` (boşsa sayfalar uygulama içi geri bildirim formuna yönlendirir).
