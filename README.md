# Auren DGS

Çok kullanıcılı DGS çalışma ve deneme takip platformu (React + Express + MSSQL).

## Kurulum
    cd server && npm i && cp .env.example .env && npm run migrate && npm run dev
    cd client && npm i && npm run dev      # http://localhost:5173

- Şema: `server/schema.sql` (idempotent, `npm run migrate`)
- Test: `cd server && npm test` (gerçek DB'ye karşı, test kullanıcılarını temizler)
- Şifre sıfırlama bağlantısı SMTP olmadığı için geliştirmede sunucu konsoluna yazılır.
