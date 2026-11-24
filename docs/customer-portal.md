# Rencana Pengembangan Customer Portal Remedi-AMS

Dokumen ini adalah rencana kerja dan catatan progres pengembangan **Customer Portal** serta **autentikasi multi-role** pada ERP Remedi-AMS. Targetnya adalah dua ekosistem dalam satu platform: **ERP internal** untuk operasional perusahaan dan **Customer Portal** untuk pelanggan eksternal.

Produksi tetap **NO-GO** sampai temuan P0 di [evaluasi staging](./evaluasi-staging.md) ditutup. Portal tidak boleh diaktifkan di produksi hanya karena satu tahap di dokumen ini telah dicentang.

## Cara mencatat progres

- Tandai pekerjaan yang selesai dan terbukti dengan `- [x] ✅`, lalu tulis tanggal, lingkungan (lokal, staging Linux, atau produksi) dan buktinya.
- Tahap utama hanya dicentang setelah seluruh sub-tugasnya selesai. Pekerjaan parsial, tertunda, atau belum terbukti tetap `- [ ]`.
- Tanda hijau hanya berlaku untuk lingkup yang disebutkan. Hasil lokal tidak berarti sudah ter-deploy ke staging atau siap produksi.
- Setiap progres juga dicatat sebagai checklist hijau di [evaluasi-staging.md](./evaluasi-staging.md), dan setiap perubahan rencana ditambahkan ke [Riwayat](#8-riwayat).
- Jangan menyimpan kata sandi, token, isi environment, service-account JSON, atau data pribadi customer di dokumen ini.

## Status tahapan

- [x] ✅ **Tahap 1 — Audit sistem:** 24 November 2026, lokal, tanpa perubahan kode. Bukti: [ringkasan audit](#2-ringkasan-audit-tahap-1) dan riwayat audit di evaluasi staging.
- [x] ✅ **Tahap 2 — Rancangan arsitektur dan keputusan desain:** 24 November 2026, lokal. Keputusan pengguna dicatat di [bagian 1](#1-keputusan-desain), rancangan di [bagian 3](#3-arsitektur), dan hasil tinjauan rancangan di [riwayat](#8-riwayat). Rancangan ini menjadi baseline; setiap perubahan dicatat di riwayat.
- [x] ✅ **Tahap 3 — Implementasi autentikasi customer dan pemisahan akses (lokal):** 24 November 2026. API, penyimpanan, sesi, UI Firebase dan profil dasar telah diimplementasikan serta diuji lokal. Bukti dan batasan pada [riwayat implementasi](#24-november-2026--implementasi-autentikasi-lokal). Email Firebase nyata dan efektivitas rules yang terpasang tetap wajib diuji pada Tahap 6 sebelum aktivasi.
- [ ] **Tahap 4 — Customer Dashboard**
- [ ] **Tahap 5 — Integrasi ERP**
- [ ] **Tahap 6 — Pengujian dan validasi**
- [ ] **Rilis staging Linux** (fitur aktif dengan flag, diuji dengan akun uji)
- [ ] **Rilis produksi** (menunggu P0 ditutup dan persetujuan tertulis)

## 1. Keputusan desain

Keputusan diambil oleh pengguna pada 24 November 2026.

| Topik | Keputusan | Konsekuensi teknis |
| --- | --- | --- |
| Verifikasi email dan reset password | Firebase Authentication (Email/Password) | Email verifikasi dan reset dikirim oleh Firebase. Password tidak pernah disimpan di server AMS. Provider Email/Password harus diaktifkan di Firebase Console. |
| Metode pembayaran | Transfer bank manual + unggah bukti, diverifikasi tim finance | Perlu penyimpanan privat untuk bukti bayar dan tampilan verifikasi bagi finance. Data rekening tujuan dikonfigurasi oleh admin, bukan ditulis di kode. |
| Harga | Checkout sebagai permintaan pesanan; sales menetapkan harga, lalu customer menyetujui | Katalog tidak membutuhkan harga numerik. Total transaksi berasal dari penawaran sales yang disetujui customer. |
| Aktivasi customer | Customer bebas melihat katalog; checkout setelah admin menautkan akun ke data pelanggan B2B | Akun baru berstatus menunggu verifikasi. Tim sales menautkan akun ke `sales_pelanggan` sebelum customer dapat mengajukan pesanan. |
| URL portal | `/akun` | Rute `/`, `/web` dan `/mobile` tidak berubah. |

## 2. Ringkasan audit (Tahap 1)

### Baseline sebelum implementasi

- **Teknologi:** React 19 + Vite 8, Express 4, TypeScript, Vitest, Firebase/Firestore Admin dan WebSocket `ws`. Tidak ada database SQL; state server disimpan dalam berkas JSON di `AMS_DATA_DIR`.
- **Routing frontend:** [main.tsx](../src/main.tsx) memilih aplikasi berdasarkan pathname: `/mobile`, `/web`, dan selain itu `App` (halaman depan + ERP). Tombol Masuk di [HalamanDepan.tsx](../src/components/modules/website/site/HalamanDepan.tsx) membuka [KartuMasuk.tsx](../src/components/modules/website/site/KartuMasuk.tsx).
- **Login karyawan:** [rbacStore.ts](../server/rbacStore.ts) menyimpan user, role, sesi dan audit di `rbac-db.json`. Password memakai scrypt, token sesi bertanda tangan HMAC, sesi berlaku 12 jam, dan cookie bernama `ams_session`. Batas total sesi adalah 200 dan audit log dibatasi 500 entri. Login Google melalui `/api/auth/firebase-login` hanya menerima email terverifikasi yang cocok dengan akun RBAC.
- **Otorisasi:** [rbacMiddleware.ts](../server/rbacMiddleware.ts) menyediakan `attachAuth`, `requireAuth` dan `requirePermission(resource, action)`. Data ERP disinkronkan melalui `/api/sync/*` yang mewajibkan sesi karyawan dan difilter per peran di [dataSyncStore.ts](../server/dataSyncStore.ts).
- **Firestore Rules:** default deny. Akses admin dan pemilik mewajibkan email terverifikasi.

### Modul ERP yang dipakai ulang

| Kebutuhan portal | Sumber ERP existing | Catatan |
| --- | --- | --- |
| Katalog produk | Produk pada snapshot `website_published` dan `product_catalog` | Hanya produk yang sudah tayang di website yang ditampilkan ke customer. |
| Ketersediaan | `stok_gudang` (status `AVAILABLE`) dicocokkan melalui SKU atau nomor izin edar | Customer hanya melihat label, bukan jumlah stok internal. |
| Data pelanggan B2B | `sales_pelanggan` (`PelangganB2B`) | Akun customer ditautkan ke satu `pelangganId` oleh tim sales. |
| Sales Order | `penjualan` (`PenjualanAlkes`) | Dibuat oleh endpoint konversi server dengan validasi regulasi yang sama; pengiriman, FEFO, dan surat jalan tetap memakai workflow ERP. |
| Status faktur dan pembayaran | `transaksi` (`TransaksiKeuangan`) | Ditautkan melalui `penjualanId` baru, bukan `nomorFaktur`; status untuk customer dihitung server. |
| Pengiriman | Status kirim Sales Order dan surat jalan | Ditampilkan sebagai status pesanan. |
| Pola antrean publik | `sales_website_rfq` dan [websiteRfq.ts](../server/websiteRfq.ts) | Contoh antrean yang hanya ditulis server dan diproses tim sales dengan ID permintaan idempoten. |

### Celah pada baseline audit

- Satu Sales Order existing hanya berisi satu produk, sedangkan keranjang customer dapat berisi banyak produk. Validasi kredit existing hanya menilai satu pesanan.
- `transaksi` tidak menyimpan ID pelanggan atau ID Sales Order, sedangkan `nomorFaktur` dapat bentrok.
- Form Sales Order menetapkan PPN 11% secara tetap dan tidak memiliki ongkir; harga katalog berupa teks.
- Belum ada alur pelunasan pembayaran, retur/refund, layanan email, penyimpanan privat bukti bayar, notifikasi customer, maupun perlindungan CSRF.
- Sinkronisasi generik menulis ulang seluruh koleksi tanpa pemeriksaan versi dasar (P0-02).
- Login Google internal dan Firestore Rules admin belum memeriksa provider Firebase.

Baseline di atas dipertahankan sebagai riwayat. Pembatasan provider, store customer, CSRF API customer, autentikasi dan profil dasar kini tersedia **lokal**, bukan bukti sudah terpasang di VPS; lihat riwayat implementasi.

## 3. Arsitektur

### 3.1 Prinsip pemisahan

1. **Identitas terpisah.** Customer tidak pernah disimpan di `rbac-db.json` dan tidak memiliki role RBAC. Penyimpanan, sesi, cookie dan audit customer berdiri sendiri.
2. **API terpisah.** Customer hanya dapat memakai `/api/customer/*`. Sesi customer tidak dikenali oleh `attachAuth`, sehingga `/api/sync/*`, `/api/rbac/*`, `/api/media` dan seluruh API internal menolak customer dengan 401.
3. **Scoping di server.** Setiap query customer difilter memakai `customerId` dari sesi, bukan dari parameter request. Objek milik customer lain dijawab 404 agar keberadaannya tidak bocor.
4. **Tidak ada promosi otomatis.** Login karyawan tidak membuat akun customer, dan login customer tidak membuat sesi karyawan. Akun customer hanya dibuat melalui pendaftaran eksplisit.
5. **Field sensitif tidak dapat diubah sendiri.** Status akun, `pelangganId`, harga penawaran dan status pembayaran hanya dapat diubah melalui endpoint staf yang dilindungi `requirePermission`. Nilai yang sudah disetujui juga dilindungi dari perubahan melalui sinkronisasi generik.
6. **ERP tetap sumber kebenaran operasional.** Pesanan portal adalah antrean masuk. Konversi ke Sales Order dan pelunasan dilakukan oleh endpoint server yang otoritatif. Pengiriman, FEFO, surat jalan, dan jurnal tetap memakai workflow ERP existing.

### 3.2 Alur autentikasi customer

| Alur | Rancangan |
| --- | --- |
| Pilihan login | Tombol Masuk di halaman depan membuka pilihan **Masuk Karyawan** dan **Masuk / Daftar Customer**. Masuk Karyawan memakai `KartuMasuk` tanpa perubahan. `?masuk=1`, setup awal dan reset developer tetap langsung membuka form karyawan. |
| Registrasi | Klien membuat akun dengan `createUserWithEmailAndPassword`, lalu memanggil `POST /api/customer/auth/daftar` dengan ID token dan data profil sebelum mengirim email verifikasi. Server memverifikasi token, memvalidasi profil, memeriksa rate limit, mewajibkan persetujuan kebijakan privasi, lalu membuat profil berstatus `menunggu-email`. Jika sudah terverifikasi, status awal `menunggu-verifikasi`, bukan `aktif`. Password tidak melewati server AMS. |
| Verifikasi email | Customer membuka tautan dari Firebase. Sesi portal baru diterbitkan setelah `email_verified` bernilai `true`. |
| Login | Klien masuk ke Firebase lalu menukar ID token melalui `POST /api/customer/auth/sesi`. Server memverifikasi token dengan Firebase Admin (`checkRevoked`) dan menolak UID yang belum memiliki profil customer. Akun Firebase tanpa profil diarahkan ke langkah melengkapi pendaftaran. |
| Logout | `POST /api/customer/auth/keluar` mencabut sesi server, menghapus cookie, lalu klien keluar dari Firebase. |
| Lupa password | `sendPasswordResetEmail` dari Firebase dengan pesan yang sama untuk email terdaftar maupun tidak terdaftar. |
| Ganti password | Reautentikasi lalu `updatePassword` di klien. Server mencabut sesi lain dan refresh token Firebase. |
| Ganti email | `verifyBeforeUpdateEmail`; email profil diperbarui dari token setelah verifikasi. |
| Ganti nomor telepon | Disimpan sebagai **belum terverifikasi** dan ditandai di profil. Verifikasi OTP SMS memerlukan biaya dan keputusan terpisah. |

Klien portal memakai instance Firebase bernama `portal-customer` dengan `inMemoryPersistence`, sehingga status login Firebase customer tidak tercampur dengan login Google karyawan di origin yang sama. Kredensial yang bertahan hanya cookie sesi HttpOnly.

Instance karyawan dipilih dengan nama `[DEFAULT]`, bukan urutan pertama `getApps()`, agar penambahan instance portal tidak mengubah aplikasi Firebase yang dipakai ERP. Bundle portal tidak mengimpor layanan sinkronisasi ERP.

### 3.3 Sesi dan keamanan

- **Cookie:** `ams_customer_session` dengan atribut `HttpOnly`, `Secure` di HTTPS, `SameSite=Lax`, dan `Path=/api/customer`. Token 256-bit acak; server hanya menyimpan hash SHA-256.
- **Masa sesi:** absolut 7 hari dan idle 24 jam (dapat disesuaikan). Maksimal 10 sesi aktif per customer; sesi tertua dicabut. Batas ini terpisah dari 200 sesi karyawan.
- **Pencabutan:** seluruh sesi dicabut saat password atau email berubah, akun ditangguhkan, atau customer memilih keluar dari semua perangkat.
- **Sinkron dengan status Firebase:** reset password di halaman Firebase tidak melewati server AMS. Implementasi awal memeriksa `disabled`, `tokensValidAfterTime`, verifikasi dan email melalui Admin SDK pada **setiap** request terautentikasi, tanpa cache. Waktu autentikasi Firebase (`auth_time`), bukan waktu penukaran cookie, dibandingkan dengan waktu pencabutan. Error jaringan menolak akses dengan 503; logout lokal tetap tersedia. Sesi diperiksa lagi setelah I/O agar logout paralel tidak dibatalkan oleh request yang sedang berjalan. Cache baru boleh diperkenalkan setelah kebijakan pencabutan diuji.
- **CSRF:** endpoint yang mengubah data mewajibkan `Content-Type: application/json` (kecuali unggahan berkas), `Origin` atau `Sec-Fetch-Site` dari origin yang sama, dan cookie SameSite=Lax. Pemeriksaan Origin yang sama **wajib** untuk seluruh mutasi staf `/api/erp/portal/*`, karena cookie internal `ams_session` masih `SameSite=None` di HTTPS.
- **Rate limit (memori, dengan batas jumlah kunci):** daftar 5/jam/IP; tukar sesi 20/15 menit/IP; pesanan 10/jam/akun; unggah bukti 10/jam/akun.
- **Validasi input:** validator bersama untuk klien dan server, batas panjang setiap kolom, maksimal 30 baris keranjang, dan jumlah bilangan bulat 1–1.000.000 (memakai `jumlahRfqValid`).
- **XSS:** seluruh teks dirender sebagai teks React tanpa `dangerouslySetInnerHTML`. Nama berkas unggahan tidak pernah dipakai sebagai path.
- **Audit:** aktivitas penting customer dan mutasi staf portal ditulis ke `customer-portal-audit.jsonl` (append-only, tanpa token, password, email atau isi profil; mutasi staf mencatat username pelaku). Catatan `attempt` ditulis sebelum commit dan `committed` setelahnya, dengan ID event dan revisi yang sama. Jika penulisan audit gagal, API melaporkan kegagalan; `attempt` tanpa `committed` harus direkonsiliasi dengan revisi database, bukan dianggap sukses atau gagal secara otomatis. Log ini terpisah dari audit RBAC umum.
- **Pemisahan provider Firebase (wajib sebelum Email/Password diaktifkan):** `/api/auth/firebase-login` dan `/api/firebase/hydrate` hanya menerima token dengan `firebase.sign_in_provider == 'google.com'`, sesuai tombol yang tersedia saat ini. Fungsi admin di Firestore Rules juga mewajibkan provider Google. Alasannya, token Email/Password customer tidak boleh menjadi jalur masuk ERP atau Firestore, walaupun emailnya sama dengan email karyawan. Perubahan ini dilakukan bersama tes regresi login karyawan, hydrate dan rules.

### 3.4 Status akun customer

| Status | Arti | Hak akses |
| --- | --- | --- |
| `menunggu-email` | Profil dibuat, email belum diverifikasi | Belum dapat masuk portal; hanya kirim ulang verifikasi |
| `menunggu-verifikasi` | Email terverifikasi, menunggu tautan pelanggan B2B oleh sales | Katalog, keranjang, profil, alamat, notifikasi; belum dapat mengajukan pesanan |
| `aktif` | Tertaut ke `sales_pelanggan` | Akses ke fitur portal yang sudah tersedia; checkout, pesanan, faktur dan pembayaran belum dibangun |
| `ditangguhkan` | Dinonaktifkan oleh staf | Sesi dicabut; login ditolak dengan pesan umum |

Jenis akun: `bisnis` (dengan data perusahaan) dan `perorangan`. Cara mencatat pelanggan perorangan di ERP masih memerlukan keputusan (lihat [bagian 7](#7-tindakan-dan-keputusan-yang-masih-diperlukan)).

### 3.5 Alur pesanan dan penawaran

```text
Keranjang
  -> menunggu-penawaran      (customer mengajukan; requestId idempoten)
  -> penawaran-dikirim       (sales menetapkan harga per baris, PPN, ongkir, masa berlaku)
     -> penawaran-ditolak    (customer menolak dengan alasan; sales dapat mengirim revisi)
     -> kedaluwarsa          (lewat masa berlaku tanpa persetujuan)
  -> disetujui-customer      (customer menyetujui penawaran versi tertentu)
  -> diproses                (server mengonversi seluruh baris menjadi Sales Order)
  -> dikirim / diterima      (dihitung dari status kirim Sales Order tertaut)
  -> selesai                 (semua baris diterima dan faktur lunas)
dibatalkan: lihat aturan pembatalan di bawah.
```

**Penawaran dihitung secara kanonik di server.** Form Sales Order existing menurunkan harga dari kontrak/skema harga dan menetapkan PPN 11% secara tetap ([SalesOrderModule.tsx](../src/components/modules/commercial/sales/SalesOrderModule.tsx)), serta tidak memiliki ongkir. Karena itu, nilai penawaran tidak boleh dihitung ulang oleh form tersebut.

- Sales mengisi harga satuan dan diskon per baris dalam rupiah bulat, ongkir, dan masa berlaku. Tarif PPN diambil dari konfigurasi finance, bukan konstanta.
- Server menghitung DPP, PPN, dan total per baris. Ongkir dan pembulatan dialokasikan secara proporsional ke baris, dan selisih pembulatan ditempatkan di baris terakhir. Dengan begitu, jumlah seluruh Sales Order sama persis dengan total penawaran.
- `PenjualanAlkes` tidak memiliki field ongkir, sehingga alokasi ongkir disimpan di field opsional baru `ongkirAlokasi`. Perlakuan pajak ongkir masih menunggu keputusan di [bagian 7](#7-tindakan-dan-keputusan-yang-masih-diperlukan).
- Penawaran memiliki nomor versi. Persetujuan customer mengacu pada versi tertentu dan menyimpan snapshot nilai per baris. Akibatnya, harga tidak dapat berubah diam-diam setelah disetujui.

**Konversi ke Sales Order dilakukan di server dan bersifat idempoten.** Form klien hanya menyimpan ke localStorage dan antrean sinkronisasi, sehingga status "tersimpan" belum menjamin data sudah sampai di server. Karena itu, endpoint staf `POST /api/erp/portal/pesanan/:id/konversi` menjalankan langkah berikut:

1. Mengunci pesanan selama proses. Endpoint memeriksa bahwa status pesanan `disetujui-customer`, akun `aktif`, dan `pelangganId` masih tertaut ke pelanggan yang ada.
2. Menjalankan validasi regulasi untuk **seluruh** baris dengan fungsi murni yang sama dari [sales.ts](../src/utils/sales.ts), sebelum ada data yang ditulis. Jika satu baris gagal, tidak ada Sales Order yang dibuat.
3. Memvalidasi kredit secara **agregat**. Eksposur dihitung dari `piutangBerjalan` ditambah nilai Sales Order pelanggan yang belum difakturkan dan total pesanan ini, termasuk ongkir. Status `Diblokir` langsung ditolak. Status `Perlu Persetujuan Manajemen` memerlukan persetujuan tercatat dari pemegang `sales-marketing:publish`. Dengan cara ini, memecah pesanan menjadi beberapa Sales Order tidak dapat melewati batas kredit.
4. Mencatat jurnal konversi (`konversi-berjalan`) di `customer-portal-db.json`. Setelah itu, endpoint menulis semua baris ke kunci `penjualan` dalam **satu** penulisan server. Setiap baris memakai ID deterministik `SO-PRT-{pesananId}-{barisId}` dan `referensiPortal` (`pesananId`, `barisId`, `versiPenawaran`). Baris dengan ID yang sudah ada dilewati, sehingga retry aman.
5. Menandai pesanan sebagai `diproses` setelah penulisan dikonfirmasi, lalu mengirim event sinkronisasi agar klien ERP memuat ulang.
6. Saat server dimulai dan melalui `GET /api/erp/portal/rekonsiliasi`, server membandingkan baris yang diharapkan dengan isi `penjualan`. Konversi yang terputus di tengah jalan dilanjutkan atau ditandai untuk ditinjau.

**Perlindungan Sales Order portal dari sinkronisasi generik.** Klien ERP menulis seluruh koleksi sekaligus tanpa pemeriksaan versi dasar (P0-02). Karena itu, penulisan `/api/sync` untuk `penjualan` ditolak dengan `409` jika menghapus baris yang memiliki `referensiPortal` atau mengubah field berikut pada baris tersebut: `pelangganId`, `referensiPortal`, `produkId`, `jumlah`, `hargaSatuan`, `diskonNilai`, `ppnPersen`, `ongkirAlokasi`, dan `totalHarga`. Perubahan status kirim melalui workflow gudang tetap diizinkan. Guard ini **tidak** menggantikan penanganan konflik P0-02. Klien yang menerima `409` perlu memuat ulang data, sehingga penyelesaian P0-02 menjadi prasyarat sebelum fitur konversi diaktifkan untuk pengguna nyata.

**Status untuk customer** dihitung server dari Sales Order dengan `referensiPortal.pesananId` yang cocok **dan** `pelangganId` yang sama dengan akun. Ketidakcocokan tidak ditampilkan dan ditandai untuk rekonsiliasi. Customer tidak pernah membaca `penjualan` secara langsung.

**Aturan pembatalan:**

- Customer dapat membatalkan pesanan saat status masih `menunggu-penawaran` atau `penawaran-dikirim`. Setelah menyetujui penawaran, customer hanya dapat mengajukan permintaan pembatalan kepada sales.
- Staf dapat membatalkan pesanan secara langsung sebelum konversi.
- Setelah konversi, pembatalan dilakukan secara terkoordinasi. Setiap Sales Order tertaut ditandai `Dibatalkan` hanya jika `statusKirim` masih `Verifikasi Pesanan` atau `Menunggu Alokasi FEFO` dan belum ada faktur. Pembatalan juga melepaskan reservasi kredit dan stok yang masih dipesan.
- Jika ada baris yang sudah dikirim, difakturkan, atau dibayar, pembatalan penuh ditolak. Penanganannya memerlukan alur **retur/refund** yang belum tersedia di ERP, yaitu pengembangan lanjutan yang harus dirancang terlebih dahulu. Sampai alur itu tersedia, portal tidak menawarkan pembatalan setelah pengiriman.

### 3.6 Transaksi, faktur dan pembayaran

**Relasi faktur yang tervalidasi.** Nomor faktur yang dibuat saat surat jalan terbit hanya memakai tiga karakter terakhir nomor pesanan ([pocketbase.ts](../src/services/pocketbase.ts)). Akibatnya, nomor dapat bentrok antar-Sales Order dalam bulan yang sama. Karena itu, portal **tidak** menautkan faktur melalui `nomorFaktur`.

- Field opsional baru `TransaksiKeuangan.penjualanId` diisi saat transaksi faktur dibuat dalam alur pengiriman.
- Relasi yang dipakai adalah `baris pesanan portal -> SO.id -> transaksi.penjualanId`. Sales Order harus memiliki `referensiPortal` dan `pelangganId` milik akun.
- Jika satu Sales Order memiliki lebih dari satu transaksi atau datanya tidak konsisten, relasi dianggap ambigu. Customer melihat status "faktur sedang diproses", dan finance menerima tanda rekonsiliasi.
- Transaksi lama tanpa `penjualanId` tidak ditampilkan kepada customer.

**Pelunasan otoritatif oleh finance.** ERP saat ini belum memiliki alur pelunasan. [FakturTab.tsx](../src/components/modules/supporting/finance/FakturTab.tsx) hanya mencatat faktur baru dan draf jurnal. Status pembayaran juga dapat berubah ketika seluruh koleksi `transaksi` ditulis ulang melalui sinkronisasi generik. Rancangan untuk portal:

- `POST /api/erp/portal/pembayaran/:id/verifikasi` (`finance-akuntansi:approve`) memvalidasi bukti, nominal yang diterima, dan transaksi tertaut. Endpoint ini mengubah `statusPembayaran` menjadi `Lunas` dan mengisi field opsional `pelunasan` (`buktiId`, `nominalDiterima`, `diverifikasiOleh`, `waktu`) dalam satu penulisan server, lalu mencatat audit.
- Penulisan `/api/sync` yang mengubah `statusPembayaran` atau `pelunasan` pada transaksi yang tertaut ke Sales Order portal ditolak dengan `409`. Perilaku transaksi non-portal tidak berubah. Pengerasan global dicatat sebagai temuan terpisah.
- Pada tahap awal, pelunasan sebagian dan pembayaran lebih belum didukung. Finance menolak bukti dengan alasan yang jelas.
- Jurnal penerimaan kas tetap dibuat finance melalui modul jurnal existing. Pembuatan jurnal otomatis dievaluasi terpisah karena rantai hash jurnal saat ini dibentuk di klien.

**Bukti bayar dan dokumen:**

- Status bukti bayar: `belum-dibayar` -> `menunggu-verifikasi` (bukti diunggah) -> `lunas` atau `bukti-ditolak` (customer dapat mengunggah ulang).
- Bukti bayar berupa JPG, PNG, atau PDF berukuran maksimal 5 MB. Jenis berkas diperiksa melalui magic bytes. Berkas disimpan di `AMS_DATA_DIR/customer-private/bukti-bayar/` dengan nama acak, terpisah dari media website publik, dan hanya dapat diunduh oleh pemiliknya atau staf finance yang berwenang.
- Dokumen yang dapat diunduh adalah ringkasan pesanan dan penawaran dalam PDF, dibuat dengan `jspdf` dari data server yang sudah diotorisasi. Unggahan dokumen faktur resmi dari finance dicatat sebagai pengembangan lanjutan.

### 3.7 Notifikasi

- **Belum diimplementasikan:** notifikasi pesanan, penawaran, pembayaran, perubahan status akun, dan pengumuman perusahaan.
- `GET /api/customer/notifikasi` saat ini hanya mengembalikan daftar kosong; endpoint ini tidak menyiratkan bahwa event sudah dibuat.
- Pengumuman direncanakan untuk staf dengan izin `sales-marketing:publish`; email di luar email autentikasi Firebase belum termasuk.
- Refetch saat tab aktif dan polling 30 detik adalah rancangan. Kanal WebSocket khusus customer dievaluasi setelah alur dasar stabil.

### 3.8 API tersedia dan rancangan

**Customer — tersedia lokal** (selain `/status`, rute pendaftaran, sesi dan keluar, endpoint memerlukan cookie sesi `ams_customer_session`; API portal selain `/status` mengembalikan 404 saat flag nonaktif):

| Endpoint | Fungsi |
| --- | --- |
| `GET /api/customer/status` | Publik: apakah portal aktif (untuk menampilkan pilihan login) |
| `POST /api/customer/auth/daftar` | Membuat profil customer dari ID token terverifikasi |
| `POST /api/customer/auth/sesi` | Menukar ID token menjadi sesi portal |
| `POST /api/customer/auth/keluar`, `/api/customer/auth/keluar-semua` | Mencabut sesi aktif atau semua sesi milik customer |
| `GET /api/customer/auth/saya`, `GET /api/customer/profil` | Profil ringkas dan status akun |
| `GET /api/customer/katalog`, `GET /api/customer/katalog/:id` | Katalog terbit: pencarian, kategori, detail dan label ketersediaan |
| `GET` / `PUT /api/customer/keranjang` | Keranjang server per customer, tanpa checkout |
| `GET` / `POST` / `PATCH` / `DELETE /api/customer/alamat[/:id]` | Alamat pengiriman |
| `PATCH /api/customer/profil` | Memperbarui nama, telepon belum terverifikasi dan perusahaan |
| `GET /api/customer/notifikasi` | Endpoint tersedia, saat ini selalu mengembalikan daftar kosong |

**Rancangan customer API — belum tersedia:** pengajuan/riwayat/detail pesanan, keputusan penawaran, tagihan, unggah/unduh bukti bayar, dan operasi baca notifikasi.

**Staf ERP — tersedia lokal** (sesi `ams_session` + `requirePermission`; semua mutasi wajib lolos pemeriksaan Origin yang sama):

| Endpoint | Izin |
| --- | --- |
| `GET /api/erp/portal/customers` | `sales-marketing:view` |
| `POST /api/erp/portal/customers/:id/tautkan` (body: `pelangganId`) | `sales-marketing:update` |
| `POST /api/erp/portal/customers/:id/tangguhkan` | `sales-marketing:update` |

Tidak ada resource atau aksi RBAC baru. `tautkan` hanya menerima master `sales_pelanggan` yang unik dan aktif; akun yang belum memverifikasi email atau telah ditangguhkan tidak dapat diaktifkan melalui endpoint ini. Satu pelanggan B2B tidak boleh tertaut ke lebih dari satu akun portal. Penangguhan mencabut sesi server customer dan dicatat bersama username staf. Endpoint ini belum memiliki UI staf dan belum menyediakan pemulihan akun yang ditangguhkan. Data akun portal **tidak** dimasukkan ke kunci `/api/sync`, sehingga data pribadi customer tidak tersalin ke cache localStorage browser karyawan.

**Rancangan endpoint staf yang belum tersedia** (jangan dianggap sebagai fitur berjalan): inbox pesanan/penawaran, persetujuan kredit, konversi Sales Order, rekonsiliasi, pembayaran, pengumuman dan notifikasi. Aksi `publish` dimiliki `sales_manager`/`pjt`, bukan `sales_medrep`; role bawaan finance belum memiliki `finance-akuntansi:approve`. Seluruh workflow tersebut masih memerlukan implementasi backend, UI dan validasi sebelum checkout portal diaktifkan.

### 3.9 Frontend dan UI/UX

- `src/main.tsx`: path `/akun` memuat `CustomerPortalApp` secara lazy sebagai bundle terpisah yang tidak memuat layanan sinkronisasi ERP (`pocketbase.ts`).
- Rute UI yang tersedia: `/akun/masuk`, `/akun/daftar`, `/akun/lupa-sandi`, `/akun/verifikasi`, `/akun` (ringkasan), `/akun/katalog`, `/akun/katalog/:id`, `/akun/keranjang`, `/akun/alamat`, `/akun/profil`, dan `/akun/notifikasi` (endpoint notifikasi masih kosong). Halaman pesanan dan tagihan belum dibangun.
- Halaman depan: pilihan login dua kartu yang responsif. Kartu karyawan membuka `KartuMasuk` existing.
- ERP: tab **Portal Customer** pada modul Sales & Marketing dan tab **Bukti Bayar Portal** pada modul Finance merupakan rancangan; belum tersedia di UI. API staf yang telah tersedia dijelaskan pada bagian 3.8.
- Identitas visual: logo dan warna brand dari identitas website CMS. Layout bersih dengan header dan navigasi samping di desktop, navigasi bawah di mobile, serta tipografi yang mudah dibaca. Tampilan dibuat berbeda dari dashboard ERP internal.
- Aksesibilitas: target sentuh minimal 44 px, label form yang jelas, status loading, kosong dan error di setiap halaman, serta tidak memakai data contoh.

### 3.10 Penyimpanan, migrasi dan rollback

| Perubahan | Sifat |
| --- | --- |
| `AMS_DATA_DIR/customer-portal-db.json` | Versi 2 berisi `version`, `revision`, `customers`, `sessions` ter-hash, keranjang dan alamat. `pelangganId` ditambahkan sebagai field opsional pada record customer; data versi 2 yang sudah ada tetap valid tanpa migrasi destructive. Ditulis atomik tmp + rename; loader berhenti tanpa menimpa jika berkas rusak/versi tidak didukung. Pesanan, notifikasi dan metadata bukti belum ditambahkan. |
| `AMS_DATA_DIR/customer-portal-audit.jsonl` | Berkas baru, append-only |
| `AMS_DATA_DIR/customer-private/bukti-bayar/` | Direktori baru, privat |
| `PenjualanAlkes.referensiPortal?` (`pesananId`, `barisId`, `versiPenawaran`) dan `PenjualanAlkes.ongkirAlokasi?` | Field opsional tambahan; data lama tetap valid |
| `TransaksiKeuangan.penjualanId?` dan `TransaksiKeuangan.pelunasan?` | Field opsional tambahan; transaksi lama tanpa `penjualanId` tidak tampil di portal |
| Kunci `penjualan` dan `transaksi` di `app-state.json` | Ditulis oleh endpoint konversi dan pelunasan server dengan struktur tambahan saja; guard sync hanya berlaku pada baris yang tertaut ke portal |
| Pemeriksaan provider `google.com` di `/api/auth/firebase-login`, `/api/firebase/hydrate`, dan fungsi admin Firestore Rules | Pengetatan; rollback dengan mengembalikan pemeriksaan lama hanya jika Email/Password dinonaktifkan kembali |
| Environment `CUSTOMER_PORTAL_ENABLED` (default `false`) | Flag fitur |
| `rbac-db.json`, resource RBAC, dan koleksi Firestore | **Tidak diubah** |

- **Migrasi:** store awal versi 1 kini dimigrasikan secara aditif ke versi 2 dengan keranjang/alamat kosong; loader menolak versi rusak/tidak didukung tanpa mengubah berkas. Field `pelangganId` bersifat opsional pada versi 2. Sebelum kenaikan versi berikutnya, wajib implementasikan salinan `customer-portal-db.v{n}.bak.json`, migrasi aditif, dan uji rollback.
- **Rollback:** set `CUSTOMER_PORTAL_ENABLED=false` lalu restart service. Endpoint Customer Portal selain `/status` menjawab `404 PORTAL_NONAKTIF`, pilihan login customer disembunyikan, dan data portal tetap utuh. Rollback skema dilakukan dengan memulihkan salinan `.bak.json` versi sebelumnya.
- **Backup:** seluruh isi `AMS_DATA_DIR`, termasuk berkas dan direktori baru, harus masuk backup VPS Linux dan diuji restore-nya.
- **Skalabilitas:** berkas JSON tunggal cukup untuk tahap awal. Jika ukuran melewati sekitar 5 MB atau penulisan lebih dari 50 per menit, pindahkan ke database transaksional (sejalan dengan rencana PostgreSQL Fase 2).

## 4. Rencana kerja per tahap

### Tahap 3 — Autentikasi customer dan pemisahan akses

- [x] ✅ **Lokal — pembatasan provider:** jalur token Firebase login/hydrate hanya menerima Google; sesi karyawan username/password tetap berlaku. Rules identitas terverifikasi dan data privat juga dibatasi ke Google. Tes provider Admin/REST sintetis, penolakan HTTP login/hydrate dan lint rules lulus. **Rules nyata belum diuji/di-deploy; jangan aktifkan Email/Password sebelum pemeriksaan staging.**
- [x] ✅ **Lokal — `ServerCustomerStore` versi 1:** loader tervalidasi, penolakan versi asing/rusak, tulis atomik, rollback state memori saat gagal tulis, persistensi restart, dan flag default nonaktif. Belum ada migrasi antarversi yang diperlukan.
- [x] ✅ **Lokal — sesi customer:** token acak 256-bit ter-hash, cookie HttpOnly terpisah, timeout, batas 10 sesi per customer, pencabutan dan pemeriksaan status Firebase; tes batas idle/absolut, penangguhan, reset sandi, email berubah dan logout paralel lulus.
- [x] ✅ **Lokal — middleware customer:** identitas cookie customer saja, Origin yang sama, JSON berukuran terbatas dan rate limit; helper Origin tersedia untuk endpoint staf berikutnya.
- [x] ✅ **Lokal — endpoint autentikasi:** status, daftar, sesi, keluar, keluar-semua dan auth/saya dengan verifier terinjeksi pada tes, bukan bypass autentikasi pada produksi.
- [x] ✅ **Lokal — audit JSONL:** event attempt/committed tanpa kredensial atau isi profil; kegagalan tulis ditampilkan eksplisit.
- [x] ✅ **Lokal — pilihan akses:** modal dua pilihan; flag nonaktif kembali ke form karyawan existing. `?masuk=1`, setup awal dan reset developer tetap langsung ke `KartuMasuk`. Browser memeriksa tautan customer dan callback karyawan; tes server memeriksa kredensial karyawan.
- [x] ✅ **Lokal — UI customer:** masuk, daftar, lupa sandi, verifikasi email, pemulihan pendaftaran yang terputus, ringkasan akun dan profil dasar. Memakai SDK Firebase nyata; lalu lintas Firebase disimulasikan hanya di tes browser terisolasi.
- [x] ✅ **Lokal — pemisahan akses:** tes router dengan RBAC nyata dan tes server terisolasi memeriksa cookie customer tidak diterima API ERP; cookie/bearer karyawan tidak diterima API customer.

### Tahap 4 — Customer Dashboard

- [x] ✅ **Lokal — kerangka akun:** layout dan navigasi ringkasan/profil, link katalog existing, serta penanganan 401. Browser memeriksa profil pada lebar CSS 360, 768 dan 1280 px tanpa overflow horizontal. Navigasi modul transaksi menyusul bersama backend-nya.
- [x] ✅ **Lokal — ringkasan dan navigasi:** ringkasan akun menampilkan jumlah baris keranjang, jumlah alamat dan jumlah notifikasi dari data portal. Akses cepat menuju katalog dan keranjang tersedia. Statistik pesanan, pesanan terbaru dan event transaksi belum ditampilkan karena modul ERP belum diintegrasikan.
- [x] ✅ **Lokal — katalog terbit:** pencarian nama/model/produsen/SKU/izin edar, kategori, foto, spesifikasi dan detail per produk. Pilihan SKU dilakukan eksplisit sebelum masuk keranjang. Harga final dan ketersediaan diberi keterangan perlu konfirmasi sales, bukan angka atau stok operasional yang belum tersambung. Sumbernya snapshot CMS terbit; API terautentikasi hanya mengembalikan field non-internal.
- [x] ✅ **Lokal — keranjang server:** tambah varian, ubah jumlah, hapus baris dan persistensi lintas restart. Keranjang divalidasi terhadap katalog terbit, dibatasi 30 baris, dan dipisah per customer. Checkout/pengajuan pesanan belum aktif.
- [ ] Pengajuan pesanan dengan alamat pengiriman, catatan, dan requestId idempoten.
- [ ] Pesanan: riwayat, detail, status, penawaran (setujui/tolak), pembatalan, dan unduh PDF.
- [ ] Tagihan: daftar faktur, status pembayaran, instruksi transfer, serta unggah dan unduh bukti.
- [ ] Profil: nama, telepon, data perusahaan, alamat, ganti password, ganti email, dan keluar dari semua perangkat.
  - [x] ✅ **Lokal — profil dasar:** nama, telepon belum terverifikasi, perusahaan, tautan reset sandi dan keluar semua perangkat. Tes dua customer, simpan/reload browser dan persistensi disk lulus. Email/alamat belum dapat diubah dari portal.
  - [x] ✅ **Lokal — alamat pengiriman:** tambah, ubah, hapus, dan alamat utama melalui UI serta penyimpanan server. Endpoint dan data dipisah per customer; perubahan antar-customer ditolak melalui sesi.
- [ ] Pusat notifikasi dan pengumuman nyata. Endpoint saat ini mengembalikan daftar kosong dan tidak membuat notifikasi palsu.

### Tahap 5 — Integrasi ERP

- [x] ✅ **Lokal — API staf akun customer:** daftar data minimum, penautan ke satu `sales_pelanggan` aktif yang unik, dan penangguhan dengan pencabutan sesi. RBAC `sales-marketing:view/update`, guard Origin, larangan aktivasi sebelum verifikasi email, pencegahan tautan ganda, dan audit username pelaku diuji dengan router/store terisolasi.
- [ ] UI staf Portal Customer untuk meninjau dan mengelola akun; endpoint lokal belum tersedia di UI ERP.
- [ ] Alur pemulihan/aktivasi ulang akun ditangguhkan dengan pemeriksaan ulang master B2B dan audit.
- [ ] Inbox pesanan portal dan form penawaran berversi dengan perhitungan kanonik di server (tarif PPN dari konfigurasi, ongkir, alokasi pembulatan).
- [ ] Endpoint konversi idempoten: validasi regulasi semua baris, kredit agregat dan persetujuan manajer, ID Sales Order deterministik, jurnal konversi, dan rekonsiliasi saat start.
- [ ] Guard sinkronisasi untuk baris `penjualan` dan `transaksi` yang tertaut ke portal, sehingga penghapusan atau perubahan nilai dan status pembayaran ditolak dengan `409`.
- [ ] Isi `TransaksiKeuangan.penjualanId` saat faktur terbit dan relasi tagihan yang menolak data ambigu.
- [ ] Status pesanan customer dihitung dari Sales Order, surat jalan, dan faktur tertaut.
- [ ] Tab Bukti Bayar Portal di Finance: verifikasi atau tolak bukti melalui endpoint pelunasan otoritatif.
- [ ] Pembatalan terkoordinasi sesuai batas siklus hidup pesanan.
- [ ] Pengumuman perusahaan dan event `portal:berubah` untuk staf.
- [ ] Notifikasi otomatis kepada customer untuk setiap perubahan status.

### Tahap 6 — Pengujian dan validasi

- [ ] Seluruh skenario pada [matriks pengujian](#5-matriks-pengujian) lulus di lokal.
- [ ] Regresi penuh: `npm test`, `npm run lint`, `npm run lint:rules`, dan `npm run build`.
- [ ] Uji browser desktop, tablet, dan mobile dengan data uji yang jelas ditandai, bukan data dummy produk.
- [ ] Staging Linux: Firebase Email/Password nyata dengan akun uji, backup data portal, dan rollback dengan flag.
- [ ] Tinjauan keamanan sebelum flag diaktifkan untuk pengguna nyata.

## 5. Matriks pengujian

| Area | Skenario wajib |
| --- | --- |
| Login karyawan | Username/password, Google Firebase, setup awal, reset developer, logout, dan dashboard sesuai role tidak berubah |
| Pemisahan provider | Token Email/Password ditolak di `/api/auth/firebase-login`, `/api/firebase/hydrate`, dan rules admin, termasuk jika emailnya sama dengan akun karyawan |
| Registrasi customer | Data valid, email sudah terdaftar, data tidak valid, tanpa persetujuan privasi, dan rate limit |
| Login customer | Email belum terverifikasi, UID tanpa profil, akun ditangguhkan, sesi kedaluwarsa, logout, dan keluar dari semua perangkat |
| Reset password | Email terdaftar dan tidak terdaftar menerima pesan yang sama; sesi portal lama dicabut setelah reset melalui Firebase, termasuk reset yang tidak melewati server AMS |
| Role-based access | Customer ditolak di API internal; sesi karyawan ditolak di API customer; customer tidak dapat mengubah status, role, `pelangganId`, harga, atau status pembayaran |
| Proteksi dashboard internal | Customer yang membuka `/` atau modul ERP tidak mendapatkan data ERP |
| Proteksi antar-customer (IDOR) | Akses pesanan, tagihan, bukti, alamat, dan notifikasi milik customer lain menghasilkan 404 |
| Integrasi order | Pengajuan idempoten, penawaran berversi, persetujuan, dan total Sales Order sama dengan penawaran yang disetujui |
| Konversi Sales Order | Retry tidak menggandakan Sales Order; satu baris gagal validasi membatalkan seluruh konversi; konversi terputus dipulihkan oleh rekonsiliasi; kredit agregat ditegakkan untuk pesanan multi-baris |
| Guard sinkronisasi | Klien basi yang menghapus Sales Order portal atau mengubah harga, jumlah, `pelangganId`, atau status pembayaran transaksi portal menerima `409`; perubahan status kirim tetap diterima |
| Transaksi | Faktur hanya dari relasi `penjualanId` milik sendiri; nomor faktur bentrok atau relasi ganda tidak bocor ke customer lain; unggah bukti dengan jenis dan ukuran salah ditolak; verifikasi dan penolakan oleh finance |
| Pembatalan | Pembatalan sebelum konversi berhasil; pembatalan setelah konversi hanya melepaskan Sales Order yang belum dikirim dan belum difakturkan; pembatalan setelah pengiriman ditolak |
| Keamanan | Request lintas origin ke API customer dan mutasi staf `/api/erp/portal/*` ditolak; input berisi skrip ditampilkan sebagai teks; audit tercatat tanpa rahasia |
| Responsif | Lebar 360, 768, dan 1280 px untuk semua halaman portal |
| Rollback | Flag nonaktif menyembunyikan portal tanpa mengubah data ERP maupun data portal |

## 6. Risiko dan mitigasi

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| Customer dimasukkan ke store RBAC | Sesi karyawan terdorong keluar (batas 200), data customer ikut sinkron RBAC ke Firebase | Store, sesi, dan cookie customer terpisah |
| Akun Email/Password Firebase dipakai untuk masuk ERP atau Firestore sebagai admin | Jalur login karyawan bertambah tanpa disengaja | **Wajib:** pemeriksaan provider `google.com` di login internal, hydrate, dan rules admin sebelum Email/Password diaktifkan |
| Customer terverifikasi dapat membuat dokumen `users/{uid}` di Firestore | Penyalahgunaan kuota kecil | Tinjau rules sebelum Email/Password diaktifkan; batasi bila jalur tersebut tidak dipakai |
| Cookie internal `SameSite=None` tanpa CSRF/Origin | Risiko CSRF pada ERP (temuan existing) | Semua mutasi staf portal wajib memeriksa Origin; pengerasan API ERP lain ditangani sebagai temuan terpisah |
| Nomor faktur bentrok antar-Sales Order | Tagihan customer lain dapat tampil | Relasi `penjualanId` tervalidasi; data ambigu ditolak dan direkonsiliasi |
| Klien ERP basi menimpa koleksi `penjualan` atau `transaksi` (P0-02) | Sales Order portal hilang atau nilai/status pembayaran berubah | Guard sync per baris portal dengan `409`; konversi tidak diaktifkan untuk pengguna nyata sebelum P0-02 ditutup |
| Konversi Sales Order terputus | Pesanan setengah diproses atau Sales Order ganda | ID deterministik, satu penulisan server, jurnal konversi, dan rekonsiliasi |
| Pesanan dipecah menjadi beberapa Sales Order | Batas kredit terlewati | Validasi kredit agregat untuk seluruh pesanan dan persetujuan manajer yang tercatat |
| Belum ada alur pelunasan, retur, dan refund | Status pembayaran tidak dapat dipercaya; pembatalan setelah kirim tidak tertangani | Endpoint pelunasan otoritatif; pembatalan setelah kirim ditolak sampai alur retur/refund dirancang |
| Reset password Firebase tidak melewati server AMS | Sesi portal lama tetap aktif | Sinkron `tokensValidAfterTime` dengan cache maksimal 5 menit dan pemeriksaan tanpa cache untuk aksi sensitif |
| Berkas JSON tunggal | Kontensi tulis dan ukuran berkas besar | Tulis atomik, batas data, metrik ukuran, dan rencana pindah ke database |
| Data pribadi dan bukti bayar | Kewajiban UU PDP | Persetujuan privasi, minimasi data, penyimpanan privat, kebijakan retensi, dan prosedur penonaktifan akun |
| Konflik dua editor (P0-02) dan restore lengkap belum selesai | Produksi belum aman | Portal hanya aktif di staging sampai P0 ditutup |
| Seed data `INITIAL_*` di klien ERP | Data contoh tampil seolah nyata | Portal hanya membaca data server; tidak ada fallback ke data contoh |

## 7. Tindakan dan keputusan yang masih diperlukan

- [ ] Siapkan `CUSTOMER_PORTAL_ENABLED`, `CUSTOMER_PRIVACY_URL`, `CUSTOMER_TERMS_URL`, dan `CUSTOMER_PRIVACY_VERSION` memakai [template environment](../.env.example). URL kebijakan harus benar-benar memuat teks yang disetujui; jangan memakai placeholder.
- [ ] Verifikasi `APP_URL` sebagai origin kanonik HTTPS dan project Firebase Admin sama dengan konfigurasi browser. Pastikan endpoint hanya dicapai melalui proxy tepercaya; rate limit memakai alamat dari konfigurasi `trust proxy` Express existing.
- [ ] Aktifkan provider **Email/Password** di Firebase Console proyek akun `ptams.erp@gmail.com`, atur bahasa template email, nama pengirim, dan domain staging/produksi di **Authorized domains**.
- [ ] Pastikan Firebase Admin (service account) aktif di VPS Linux. Tanpa Admin SDK, pendaftaran customer dinonaktifkan.
- [ ] Siapkan teks **Kebijakan Privasi** dan **Syarat Layanan** untuk persetujuan saat registrasi.
- [ ] Buat atau tetapkan role finance dengan izin `finance-akuntansi:view` dan `finance-akuntansi:approve` melalui Manajemen RBAC.
- [ ] Tentukan rekening tujuan transfer, kebijakan PPN dan perlakuan pajak ongkir pada penawaran, aturan pembulatan, serta masa berlaku penawaran default.
- [ ] Tentukan apakah pelanggan **perorangan** dilayani dan bagaimana dicatat di ERP.
- [ ] Tentukan apakah nomor telepon perlu verifikasi OTP SMS (berbiaya).
- [ ] Tentukan masa retensi bukti bayar dan data akun yang dinonaktifkan.
- [ ] Rancang alur **retur/refund**, pelunasan sebagian, dan jurnal penerimaan kas otomatis jika dibutuhkan. Fitur ini belum didukung ERP saat ini dan di luar lingkup awal portal.
- [ ] Tutup P0-02 (pemeriksaan versi dasar sinkronisasi) sebelum konversi Sales Order portal dipakai oleh pengguna nyata.

## 8. Riwayat

### 24 November 2026 — audit, keputusan desain, dan rencana kerja

- Tahap 1 audit diselesaikan secara lokal tanpa perubahan kode, Firebase, atau VPS.
- Pengguna memilih Firebase Email/Password, transfer manual dengan unggah bukti, checkout berbasis penawaran, aktivasi setelah tautan pelanggan B2B, dan URL `/akun`.
- Rancangan arsitektur, rencana kerja, matriks pengujian, dan daftar risiko disusun di dokumen ini.
- **Batasan:** belum ada kode portal. Seluruh item Tahap 3–6 masih terbuka.

### 24 November 2026 — tinjauan rancangan dan revisi baseline

Rancangan ditinjau secara independen sebelum Tahap 3. Klaim temuan dicocokkan langsung dengan kode: pembentukan nomor faktur di `pocketbase.ts`, PPN tetap di `SalesOrderModule.tsx`, validasi kredit tunggal di `sales.ts`, `FakturTab.tsx` tanpa pelunasan, dan fungsi admin `firestore.rules` yang belum memeriksa provider. Sembilan temuan blocking dan perubahan rancangannya:

1. **Join faktur melalui `nomorFaktur` tidak aman** → relasi `penjualanId` tervalidasi dan penolakan data ambigu ([3.6](#36-transaksi-faktur-dan-pembayaran)).
2. **Pembatasan provider Firebase hanya opsional** → menjadi prasyarat wajib untuk login internal, hydrate, dan rules admin ([3.3](#33-sesi-dan-keamanan)).
3. **Konversi Sales Order lewat form klien tidak dapat dipulihkan** → endpoint konversi server yang idempoten, jurnal, dan rekonsiliasi ([3.5](#35-alur-pesanan-dan-penawaran)).
4. **Reset password Firebase tidak mencabut sesi portal** → sinkron `tokensValidAfterTime` dan status akun ([3.3](#33-sesi-dan-keamanan)).
5. **Mutasi staf memakai cookie `SameSite=None`** → pemeriksaan Origin wajib untuk semua mutasi `/api/erp/portal/*` ([3.8](#38-rancangan-api)).
6. **Form Sales Order menghitung ulang harga, PPN tetap, tanpa ongkir** → perhitungan kanonik di server, alokasi ongkir dan pembulatan, serta guard nilai yang disetujui ([3.5](#35-alur-pesanan-dan-penawaran)).
7. **Pemecahan pesanan melewati validasi kredit** → validasi kredit agregat dan persetujuan manajer tercatat ([3.5](#35-alur-pesanan-dan-penawaran)).
8. **Belum ada alur pelunasan; sync generik dapat mengubah status bayar** → endpoint pelunasan otoritatif dan guard sync untuk transaksi portal ([3.6](#36-transaksi-faktur-dan-pembayaran)).
9. **Pembatalan staf dapat bertentangan dengan Sales Order** → batas siklus hidup, pembatalan terkoordinasi, dan penolakan setelah pengiriman sampai alur retur/refund tersedia ([3.5](#35-alur-pesanan-dan-penawaran)).

- Rencana Tahap 3 dan 5, matriks pengujian, risiko, serta tindakan diperbarui. P0-02 menjadi prasyarat sebelum konversi dipakai pengguna nyata.
- **Batasan:** revisi ini hanya dokumentasi. Belum ada perubahan kode, Firebase, atau VPS.

### 24 November 2026 — implementasi autentikasi lokal

- **Kode:** [customerStore.ts](../server/customerStore.ts), [customerAuth.ts](../server/customerAuth.ts), [customerRoutes.ts](../server/customerRoutes.ts), [CustomerPortalApp.tsx](../src/components/customer/CustomerPortalApp.tsx), [AccessChoice.tsx](../src/components/customer/AccessChoice.tsx), serta routing dan pemeriksaan provider internal.
- **Bukti otomatis:** regresi penuh 40 file / 478 tes lulus; setelah penambahan satu kasus batas server, tes terarah customer/provider/server lulus 3 file / 40 tes. TypeScript, lint rules Firestore dan build frontend/server lulus. Bukti ada pada [tes customer](../tests/domain/customer-auth.test.ts), [tes provider](../tests/domain/firebase-provider-isolation.test.ts), serta [tes HTTP server](../tests/domain/website-http.test.ts).
- **Bukti browser:** pendaftaran tersimpan di store terisolasi; masuk sebelum email terverifikasi ditolak; verifikasi, login, logout dan keluar semua perangkat berjalan; nama profil tetap ada setelah reload. Lupa sandi menampilkan pesan yang sama untuk respons Firebase sukses dan email tidak ditemukan. Isi profil, password dan refresh token uji tidak ditemukan di localStorage/sessionStorage; isian pribadi dibersihkan setelah logout. Pilihan login mengarah ke `/akun/masuk` atau callback form karyawan. Pemeriksaan ulang rute `/akun/masuk` tidak memuat layanan ERP/Firestore atau membuka `/api/sync`. Ini bukan pengiriman email nyata atau uji akun Firebase/VPS.
- **Penyesuaian rancangan:** profil disimpan sebelum email verifikasi dikirim supaya kegagalan pengiriman email tidak menghilangkan pendaftaran; retry UID yang sama tidak membuat akun ganda. Status Firebase diperiksa setiap request tanpa cache. Store awal hanya akun/sesi; migrasi tambahan dikerjakan ketika versi berikutnya diperlukan. Akun perorangan belum ditawarkan karena pemetaan ERP-nya belum diputuskan.
- **Pengoperasian:** flag default `false`; `/api/customer/status` tetap dapat dibaca untuk UI, sedangkan endpoint lain 404 ketika nonaktif. Jika Firebase Admin/project belum sesuai, autentikasi 503; jika kebijakan belum dikonfigurasi, registrasi ditolak. Password ditangani Firebase, tidak pernah dikirim ke AMS. Cookie customer tidak menghapus sesi karyawan.
- **Batasan:** belum ada checkout, penawaran, konversi Sales Order, tagihan, unggah bukti, perubahan email/alamat atau notifikasi transaksi. Tidak ada tombol dummy untuk fungsi tersebut. Halaman akun menjelaskan batas ini dan menyediakan katalog/RFQ existing. Belum commit, push, deploy, perubahan Firebase atau migrasi data nyata; Tahap 4–6 dan keputusan produksi tetap terbuka.

### 24 November 2026 — fondasi Customer Dashboard tahap 4

- **Kode:** store versi 2 dengan `carts` dan `addresses`, endpoint katalog/keranjang/alamat/notifikasi pada router customer, dan navigasi/ringkasan/katalog/keranjang/alamat pada aplikasi `/akun`.
- **Sumber data:** katalog API disanitasi dari snapshot website yang benar-benar terbit. Tidak ada harga penjualan palsu, stok palsu atau katalog fallback dari seed klien.
- **Keamanan:** seluruh endpoint fitur baru memakai cookie customer terautentikasi, scoping customer, Origin/JSON guard existing, validasi varian, batas baris dan batas jumlah. Keranjang/alamat customer lain tidak dapat dibaca melalui ID akun.
- **Bukti:** `customer-auth.test.ts` lulus 23 tes; migration versi 1, persistensi restart, isolasi keranjang/alamat antar-customer dan katalog terbit tercakup. `npm run lint` dan `npm run build` lulus.
- **Batasan:** belum ada pengajuan pesanan, penawaran, invoice, bukti bayar atau notifikasi otomatis. Checkout tetap dinyatakan belum aktif sampai integrasi ERP Tahap 5 dan P0-02 ditutup.

### 24 November 2026 — penyempurnaan katalog dan alamat Customer Dashboard

- **UI katalog:** pencarian diajukan eksplisit, mencakup SKU, dan detail produk menampilkan spesifikasi/izin edar serta selector varian sebelum keranjang. Harga akhir dan ketersediaan tidak disajikan sebagai angka/stock live sebelum integrasi operasional.
- **Alamat:** formulir akun kini mendukung edit alamat selain tambah/hapus; kepemilikan tetap diturunkan dari sesi di server.
- **Bukti lokal:** tes Customer Portal dan typecheck dijalankan setelah perubahan. Belum dikirim atau dideploy ulang ke staging.
- **Batasan tetap:** pengajuan pesanan, penawaran, invoice, pembayaran dan notifikasi otomatis memerlukan integrasi serta workflow staf Tahap 5; tidak dibuka sebagai checkout semu.

### 24 November 2026 — API awal integrasi akun ERP (lokal)

- **API staf:** `GET /api/erp/portal/customers`, `POST .../:id/tautkan`, dan `POST .../:id/tangguhkan` memakai sesi karyawan dan izin `sales-marketing:view/update`. Master pelanggan dibaca dari `ServerDataSyncStore` key `sales_pelanggan`; ID yang dikirim harus ditemukan tepat satu kali dan berstatus Aktif.
- **Proteksi akun:** pendaftaran yang emailnya belum diverifikasi tidak dapat diaktifkan; satu record B2B tidak dapat dihubungkan ke dua akun customer. Penangguhan mencabut sesi portal yang tersimpan dan menghentikan login berikutnya. Customer tidak dapat melihat atau mengubah `pelangganId`.
- **Audit dan data:** mutasi mencatat username pelaku dalam audit JSONL Customer Portal, tanpa menyertakan email atau isi profil. Field opsional `pelangganId` kompatibel dengan record store versi 2 yang sudah ada.
- **Bukti lokal:** `customer-auth.test.ts` lulus 25 tes; regresi penuh lulus 40 file / 483 tes, `npm run lint`, dan `npm run build`. Cakupan termasuk RBAC (sales rep tanpa izin ditolak), Origin silang, master tidak aktif, batas payload, tautan ganda, audit, dan pencabutan sesi tanpa memengaruhi customer lain.
- **Batasan:** hanya endpoint backend lokal; belum ada UI staf, aktivasi ulang akun, pesanan/penawaran, Sales Order, transaksi/pembayaran, Firebase nyata, deploy atau perubahan data VPS. P0-02 tetap terbuka dan konversi Sales Order belum boleh digunakan.
