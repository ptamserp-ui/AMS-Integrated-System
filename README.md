# AMS Integrated System — PT Anugrahmitra Selaras

AMS adalah aplikasi ERP dan alat bantu manajemen mutu untuk operasional perusahaan alat kesehatan. Fitur aplikasi tidak dengan sendirinya membuktikan kepatuhan CDAKB, CPAKB, SDAK, ISO 13485, atau kesiapan produksi.

## Status saat ini

- **Aplikasi:** React 19, TypeScript, Vite, Tailwind CSS v4 dan Express; tersedia ERP, situs publik `/web`, Customer Portal `/akun`, dan tampilan `/mobile`.
- **Data dan sinkronisasi:** Express menyimpan state dan akun server pada `AMS_DATA_DIR`; klien memiliki cache dan antrean offline. WebSocket `/api/sync/ws` dan Firebase Firestore mendukung sinkronisasi. Firebase bukan satu-satunya sumber data atau pengganti backup lengkap.
- **Database:** Firebase merupakan driver aktif pada staging yang terakhir diverifikasi. PostgreSQL di Linux baru skema shadow/prototipe yang diuji; aplikasi belum memakai PostgreSQL sebagai database utama. Migrasi data aktual, identitas, backup/restore lengkap dan cutover masih terbuka.
- **Autentikasi:** sesi ERP dan RBAC ditegakkan server; login Google masih memakai Firebase. Customer Portal menggunakan autentikasi dan sesi terpisah; pengajuan penawaran sudah tersedia pada kode, sedangkan penetapan harga, faktur dan pembayaran portal masih dalam pengembangan.
- **Deployment:** Linux staging terakhir yang diverifikasi menjalankan `32aee94`; bukti dan batasnya ada di [evaluasi staging](docs/evaluasi-staging.md). Push tidak otomatis berarti deployment.
- **Data dan integrasi:** data contoh masih tersedia. Antrean atau pratinjau integrasi pemerintah dan perangkat bukan bukti koneksi live. Jangan hapus data dummy atau migrasikan data aktual tanpa persetujuan, backup dan rekonsiliasi.

## Modul

ERP mencakup Executive Overview, Regulatory/PJT, QA, QC, Warehouse & Logistics, layanan teknis, manufaktur, purchasing, Sales & Marketing, PMS, HRIS, Finance, IT & Traceability, serta CMS situs publik. Sales mencakup **Customer Database** untuk melihat dan mengubah detail pelanggan existing, serta tab Portal Customer. Penambahan pelanggan, draf server dan impor Excel pada Customer Database belum tersedia.

Kemampuan tiap modul, data contoh, dan batas integrasi dijelaskan dalam [catatan pengembang](docs/developer-notes.md), [checklist produksi](docs/production-list.md), serta dokumen blueprint terkait. Blueprint berisi target desain dan tidak seluruhnya menggambarkan fitur yang sudah berjalan.

## Memulai lokal

Prasyarat: Node.js **22 atau lebih baru** dan npm. Gunakan konfigurasi lingkungan yang sesuai dari `.env.example` atau template staging; jangan commit rahasia.

```bash
npm ci
npm run dev
```

Buka `http://localhost:3000`. Setup akun awal dan Firebase memerlukan konfigurasi yang sesuai; lihat [panduan Linux](docs/panduan-deploy-vps.md). Jangan memakai project atau data produksi untuk pengujian tanpa persetujuan.

## Perintah utama

| Perintah | Kegunaan |
|---|---|
| `npm run dev` | Express dengan middleware Vite |
| `npm run lint` | Pemeriksaan TypeScript |
| `npm run lint:rules` | Pemeriksaan Firestore Rules |
| `npm test` | Tes Vitest |
| `npm run cek:semua` | Penjaga benih, FEFO, gudang dan e-Report |
| `npm run build:staging` / `npm run build:production` | Build frontend dan server untuk mode terkait |
| `npm start` | Menjalankan `server.js` hasil build |
| `npm run deploy:check` | Memeriksa artefak rilis; bukan pengganti uji login atau database |
| `npm run verifikasi` | Lint, rules, tes, penjaga domain dan build |

## Website dan keamanan

`GET /api/website/published` menyediakan snapshot terbit. `PUT /api/website/published` menerima sesi ERP dengan izin `website:publish` **atau** `AMS_ADMIN_TOKEN` yang valid; tanpa keduanya permintaan ditolak. Server menyimpan snapshot pada state sinkronisasi dan mencoba menulis salinan; kegagalan salinan atau siaran dapat menghasilkan peringatan. Form RFQ publik memakai `/api/website/rfq`; pemrosesan lanjutan tetap memerlukan tim sales.

## Dokumentasi

- [Evaluasi staging dan tindak lanjut](docs/evaluasi-staging.md) — bukti per lingkungan dan baseline historis.
- [Panduan deployment VPS Linux](docs/panduan-deploy-vps.md) dan [checklist deployment](docs/deployment.md).
- [Customer Portal](docs/customer-portal.md) — fitur, keputusan dan tahap yang masih terbuka.
- [Alur website dan ERP](docs/alur-integrasi.md), [SRS CMS](docs/srs-cms-website.md).
- [System blueprint](docs/system-blueprint.md), blueprint per modul, [glosarium](docs/glosarium.md), dan [catatan pengembang](docs/developer-notes.md).
- `docs/assets-aistudio/` menyimpan spesifikasi dan audit historis, bukan gambaran runtime terkini.

Hak cipta © 2026 PT Anugrahmitra Selaras.
