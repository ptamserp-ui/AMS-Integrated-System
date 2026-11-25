# AMS Integrated System — PT Anugrahmitra Selaras

Sistem informasi manajemen terintegrasi untuk operasional perusahaan alat kesehatan, dengan acuan **CDAKB** (Cara Distribusi Alat Kesehatan yang Baik), **CPAKB** (Cara Pembuatan Alat Kesehatan yang Baik), **SDAK**, dan **ISO 13485:2016**.

---

## 🌟 Tentang Aplikasi

**AMS Integrated System** adalah platform Enterprise Resource Planning (ERP) dan alat bantu manajemen mutu untuk **PT Anugrahmitra Selaras (AMS)**. Aplikasi menyediakan ruang kerja untuk fungsi komersial, regulasi, gudang, produksi, keuangan, sumber daya manusia, dan pendukung, serta situs publik dan Customer Portal.

Fitur dan data contoh dalam aplikasi tidak otomatis membuktikan kepatuhan regulasi, integrasi eksternal, atau kesiapan produksi. Status pengujian dan pekerjaan yang masih terbuka dicatat di [evaluasi staging](docs/evaluasi-staging.md).

---

## 🏛️ Divisi & Modul Utama Terintegrasi

Menu ERP mencakup modul dan ruang kerja berikut:

1. **Dashboard Dewan Direksi (Executive Overview)**
   - Cockpit untuk ringkasan kinerja perusahaan dan akses ke divisi utama.
   - Grafik tren pendapatan, suhu *cold chain*, dan skor kepatuhan mutu; nilai yang tampil dapat berasal dari data contoh.
2. **Regulatory Affairs (RA) & Penanggung Jawab Teknis (PJT)**
   - Pengelolaan daftar Nomor Izin Edar (NIE), masa berlaku, dan informasi PJT.
   - Status izin harus diverifikasi terhadap dokumen resmi; koneksi ke database regulator belum terbukti.
3. **Quality Assurance (QA) & ISO 13485:2016**
   - Pencatatan tindakan perbaikan dan pencegahan (CAPA), dokumen mutu, serta audit internal.
   - Pencatatan di aplikasi bukan bukti sertifikasi atau kelulusan audit.
4. **Quality Control (QC)**
   - Formulir inspeksi penerimaan dan pencatatan hasil pemeriksaan mutu batch alat kesehatan.
5. **Warehouse & Logistics (WMS / CDAKB)**
   - **13 tab** meliputi struktur gudang, stok dan FEFO sadar-kunci, rantai dingin, penerimaan, pengiriman, opname, karantina/recall, dan master data ERP.
   - Gerbang pemerintah dan perangkat seperti RFID atau sensor tidak boleh dianggap terhubung live hanya karena antrean atau pratinjau tersedia.
6. **Technical & After-Sales Service**
   - Layar layanan teknis, pemeliharaan, garansi, dan jadwal kalibrasi alat.
7. **Manufacturing (CPAKB)**
   - Layar *Batch Manufacturing Record* (BMR), parameter *cleanroom*, dan perhitungan *yield* produksi.
8. **Purchasing & Procurement**
   - Pencatatan pengadaan dan Purchase Order (PO) serta kalkulasi *landed cost*.
9. **Sales & Marketing**
   - CRM dan prospek, tender dan kontrak, Sales Force Automation (SFA), order penjualan, kampanye, analitik, e-Brochure, dan layar newsletter.
   - **Customer Database** menampilkan dan mengubah detail pelanggan existing. Penambahan pelanggan, draf server, dan impor Excel di menu ini belum tersedia.
   - Tab **Portal Customer** menyediakan inbox permintaan serta pengelolaan penautan dan penangguhan akun oleh staf berizin. Koneksi live LPSE/e-Katalog dan pengiriman newsletter belum dibuktikan.
10. **Product Catalog**
    - Pengelolaan katalog produk yang digunakan bersama fitur komersial dan situs publik.
11. **Post-Market Surveillance (PMS) / Vigilance**
    - Formulir dan pencatatan Kejadian Tidak Diinginkan (KTD), dengan ringkasan penarikan produk.
    - Pengiriman laporan ke e-Watch belum terbukti; eksekusi recall dikelola di modul gudang.
12. **Human Resources & General Affairs (HRD / HRIS)**
    - Data personil, jadwal dan absensi, penggajian, rekrutmen, kompetensi, kinerja, dan HSE/K3.
    - Kalkulasi payroll tersedia; verifikasi geofencing dan integrasi BPJS/DJP belum terbukti.
13. **Finance & Accounting**
    - Jurnal *double-entry*, Chart of Accounts, faktur, pajak, persediaan, dan laporan keuangan.
    - Tarif dan hasil perhitungan perlu ditinjau terhadap ketentuan serta data perusahaan; integrasi live e-Faktur/DJP belum dibuktikan.
14. **IT & Traceability Hub**
    - Informasi penyimpanan dan sinkronisasi, pengelolaan pengguna dan peran, ekspor audit, serta panduan deployment.
    - Rantai hash untuk sebagian data tersedia; penyimpanan audit menyeluruh yang immutable belum dibuktikan.
15. **Internal Document**
    - Ruang kerja dokumen internal dan formulir terkendali, termasuk penerbitan quotation.
16. **Website & CMS**
    - Pengaturan identitas, tampilan, konten dan katalog situs publik `/web`, dengan pratinjau dan penerbitan snapshot.
    - Formulir permintaan penawaran (RFQ) publik dikirim ke antrean server untuk diproses tim sales.

### Customer Portal & Mobile

- **Customer Portal (`/akun`)** memiliki autentikasi dan sesi terpisah dari ERP. Akun customer dapat mengakses katalog, keranjang dan profil; akun yang ditautkan dapat mengajukan permintaan penawaran.
- Penetapan dan persetujuan harga, faktur, serta pembayaran portal masih dalam pengembangan. Aktivasi dan pengujian staging harus mengikuti [status Customer Portal](docs/customer-portal.md).
- **Mobile (`/mobile`)** menyediakan tampilan aplikasi untuk perangkat bergerak. Cakupan fungsi dan penggunaan operasional tetap perlu diuji di lingkungan target.

---

## 🛠️ Tech Stack & Arsitektur Data

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, dan Lucide React. Aplikasi memakai PWA/service worker serta pemuatan modul sesuai kebutuhan.
- **Backend:** Express.js (`server.ts`) dan WebSocket (`/api/sync/ws`), dengan autentikasi dan RBAC yang ditegakkan di server.
- **Penyimpanan & sinkronisasi:** state operasional dan akun server disimpan pada direktori `AMS_DATA_DIR`; browser memiliki cache dan antrean offline. Firebase Firestore mendukung sinkronisasi sesuai konfigurasi. Firebase bukan satu-satunya sumber data atau pengganti backup lengkap.
- **Identitas:** sesi ERP menggunakan autentikasi server; login Google masih memakai Firebase. Customer Portal memakai sesi tersendiri dan Firebase Authentication.
- **PostgreSQL:** skema *shadow* dan prototipe impor telah diuji dengan data sintetis, tetapi aplikasi **belum menggunakan PostgreSQL sebagai database utama**. Integrasi runtime, migrasi data aktual, login tanpa Firebase, restore lengkap, rekonsiliasi dan cutover masih terbuka.
- **Build & pengujian:** Vite, esbuild, TypeScript dan Vitest; Node.js **22 atau lebih baru** sesuai `package.json`.

Linux staging terakhir yang diverifikasi menjalankan rilis `32aee94` dengan Firebase terhubung saat pemeriksaan. Push kode atau perubahan dokumen tidak otomatis berarti deployment; lihat [evaluasi staging](docs/evaluasi-staging.md) untuk bukti dan batasnya.

---

## 🚀 Memulai (Getting Started)

### Prasyarat

- Node.js versi **22 atau lebih baru** dan npm.
- Konfigurasi environment yang sesuai dari `.env.example` atau template staging. Setup akun awal dan fitur Firebase memerlukan konfigurasi yang sesuai.
- Gunakan data dan project pengujian; jangan menggunakan data produksi tanpa persetujuan. Jangan menyimpan secret di Git atau membagikannya melalui chat.

### Instalasi & Menjalankan Development Server

1. Pasang dependensi dari lockfile:
   ```bash
   npm ci
   ```
2. Jalankan server pengembangan Express dengan Vite:
   ```bash
   npm run dev
   ```
3. Buka `http://localhost:3000`. Port dapat diubah melalui konfigurasi environment.

Panduan setup dan deployment VPS tersedia di [panduan Linux](docs/panduan-deploy-vps.md). Backup harus mencakup state server, akun, portal, media, snapshot, Firebase, dan data offline yang relevan; uji restore secara terpisah.

---

## 📜 Perintah Script Tersedia (`package.json`)

- `npm run dev` — menjalankan server pengembangan.
- `npm run build` — build frontend dan bundle server.
- `npm run build:staging` / `npm run build:production` — build untuk mode target.
- `npm start` — menjalankan bundle produksi `server.js`.
- `npm run lint` — pemeriksaan tipe TypeScript (`tsc --noEmit`).
- `npm run lint:rules` — pemeriksaan Firestore Rules.
- `npm test` — menjalankan tes Vitest.
- `npm run cek:semua` — menjalankan penjaga benih, FEFO, gudang, dan e-Report.
- `npm run deploy:check` — memeriksa artefak rilis; pemeriksaan HTTP opsional dapat ditambahkan dengan `-- --url=https://<domain>`. Ini bukan pengganti uji login atau database.
- `npm run verifikasi` — menjalankan lint, lint rules, tes, pemeriksaan domain, dan build.

---

## 🔒 Keamanan & Konfigurasi Publikasi Situs

- `GET /api/website/published` menyediakan snapshot situs. `PUT /api/website/published` memerlukan **sesi ERP dengan izin `website:publish` atau `AMS_ADMIN_TOKEN` yang valid**. Permintaan tanpa keduanya ditolak; pembatasan laju diterapkan pada endpoint penerbitan.
- Server menyimpan snapshot pada state sinkronisasi dan mencoba memperbarui salinan di disk. Kegagalan salinan atau siaran realtime dilaporkan sebagai peringatan dan perlu ditindaklanjuti.
- `POST /api/website/rfq` menerima permintaan dari situs publik; antrean dan proses lanjutan harus diperiksa oleh tim sales.
- Data contoh masih tersedia. Jangan melakukan purge, migrasi atau cutover tanpa persetujuan, backup teruji dan rekonsiliasi sumber.

## Developer Notes

Catatan pengembang menjelaskan fitur yang tersedia dan yang masih berupa data contoh, antrean, pratinjau, atau rancangan. Rujukan: [catatan pengembang](docs/developer-notes.md), [checklist produksi](docs/production-list.md), [alur website](docs/alur-integrasi.md), [Customer Portal](docs/customer-portal.md), dan [system blueprint](docs/system-blueprint.md).

---

## 📄 Lisensi & Kepatuhan

Hak cipta © 2026 PT Anugrahmitra Selaras (AMS). Kepatuhan formal dan kelayakan operasional memerlukan bukti, audit, serta persetujuan yang sesuai. Coded by Langgo Bramandityo.
