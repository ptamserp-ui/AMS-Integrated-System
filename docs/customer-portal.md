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
- [x] ✅ **Penyelarasan aksen biru — lokal Windows, 24 November 2026:** portal mengikuti token global biru `#2a6199` dan turunannya. Pemeriksaan browser form masuk dengan status API sintetis membuktikan tombol `#245382`, hover `#1e456c`, dan fokus `#2a6199`; TypeScript dan build lulus. Ini verifikasi visual, bukan login nyata atau deployment; Tahap 4–6 tetap terbuka.

## 1. Keputusan desain

Keputusan diambil oleh pengguna pada 24 November 2026.

| Topik | Keputusan | Konsekuensi teknis |
| --- | --- | --- |
| Verifikasi email dan reset password | Firebase Authentication (Email/Password) | Email verifikasi dan reset dikirim oleh Firebase. Password tidak pernah disimpan di server AMS; sejak login username, password melewati server AMS (HTTPS) hanya untuk diteruskan ke Firebase dan tidak dicatat. Provider Email/Password harus diaktifkan di Firebase Console. |
| Identitas masuk customer | Username unik (keputusan pengguna 25 November 2026) | Customer memilih username saat mendaftar dan masuk dengan username + kata sandi, bukan email. Username tidak membedakan huruf besar/kecil, unik, tidak dapat diubah, dan tidak sama dengan nama sistem (mis. `admin`). |
| Metode pembayaran | Transfer bank manual + unggah bukti, diverifikasi tim finance | Perlu penyimpanan privat untuk bukti bayar dan tampilan verifikasi bagi finance. Data rekening tujuan dikonfigurasi oleh admin, bukan ditulis di kode. |
| Lingkup akun awal | B2B saja; akun perorangan ditunda (keputusan pengguna 24 November 2026) | Akun portal harus ditautkan ke satu `sales_pelanggan` aktif; pemetaan perorangan tidak masuk lingkup tahap ini. |
| Pajak ongkir | Sales/Finance menetapkan perlakuan pajak per penawaran (keputusan pengguna 24 November 2026) | Server menyimpan perlakuan yang dipilih per versi penawaran; tidak mengasumsikan ongkir selalu kena atau bebas PPN. |
| Pembayaran tahap awal | Pelunasan penuh; pembayaran sebagian dan refund ditunda (keputusan pengguna 24 November 2026) | Alur portal awal tidak menghitung cicilan/refund; keduanya memerlukan desain ERP terpisah. |
| Harga | Checkout sebagai permintaan pesanan; sales menetapkan harga, lalu customer menyetujui | Katalog tidak membutuhkan harga numerik. Total transaksi berasal dari penawaran sales yang disetujui customer. |
| Aktivasi customer | Customer bebas melihat katalog; checkout setelah admin menautkan akun ke data pelanggan B2B | Akun baru berstatus menunggu verifikasi. Tim sales menautkan akun ke `sales_pelanggan` sebelum customer dapat mengajukan pesanan. |
| URL portal | `/akun` | Rute `/`, `/web` dan `/mobile` tidak berubah. |

## 2. Ringkasan audit (Tahap 1)

### Baseline sebelum implementasi

- **Teknologi:** React 19 + Vite 8, Express 4, TypeScript, Vitest, Firebase/Firestore Admin dan WebSocket `ws`. Tidak ada database SQL; state server disimpan dalam berkas JSON di `AMS_DATA_DIR`.
- **Routing frontend:** [main.tsx](../src/main.tsx) memilih aplikasi berdasarkan pathname: `/mobile`, `/web`, dan selain itu `App` (halaman depan + ERP). Tombol Masuk di [HalamanDepan.tsx](../src/components/modules/website/site/HalamanDepan.tsx) membuka [KartuMasuk.tsx](../src/components/modules/website/site/KartuMasuk.tsx).
- **Login karyawan:** [rbacStore.ts](../server/rbacStore.ts) menyimpan user, role, sesi dan audit di `rbac-db.json`. Password memakai scrypt, token sesi bertanda tangan HMAC, sesi berlaku 12 jam, dan cookie bernama `ams_session`. Batas total sesi adalah 200. Baseline audit pernah dibatasi 500 entri; kode lokal saat ini mempertahankan seluruh riwayat dan menyalinnya ke arsip bulanan `audit-archive/YYYY-MM.jsonl`. Login Google melalui `/api/auth/firebase-login` hanya menerima email terverifikasi yang cocok dengan akun RBAC.
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
4. **Tidak ada promosi otomatis.** Login karyawan tidak membuat akun customer, dan login customer tidak membuat sesi karyawan. Akun customer hanya dibuat melalui pendaftaran eksplisit. **Pengecualian developer:** satu akun developer tersembunyi (`isHiddenDeveloper`) bukan karyawan, sehingga sesi ERP-nya membuka ruang kerja portal terpisah (`aksesDeveloper`). Ruang kerja ini tidak memakai Firebase, tidak tampil di daftar staf, dan tidak dapat ditautkan ke pelanggan B2B. Role `developer_it_support` yang diberikan ke staf tetap diperlakukan sebagai karyawan dan ditolak.
5. **Field sensitif tidak dapat diubah sendiri.** Status akun, `pelangganId`, harga penawaran dan status pembayaran hanya dapat diubah melalui endpoint staf yang dilindungi `requirePermission`. Nilai yang sudah disetujui juga dilindungi dari perubahan melalui sinkronisasi generik.
6. **ERP tetap sumber kebenaran operasional.** Pesanan portal adalah antrean masuk. Konversi ke Sales Order dan pelunasan dilakukan oleh endpoint server yang otoritatif. Pengiriman, FEFO, surat jalan, dan jurnal tetap memakai workflow ERP existing.

### 3.2 Alur autentikasi customer

| Alur | Rancangan |
| --- | --- |
| Pilihan login | Tombol Masuk di halaman depan membuka pilihan **Masuk Karyawan** dan **Masuk / Daftar Customer**. Masuk Karyawan memakai `KartuMasuk` tanpa perubahan. `?masuk=1`, setup awal dan reset developer tetap langsung membuka form karyawan. |
| Registrasi | Klien memeriksa username melalui `POST /api/customer/auth/cek-username` sebelum membuat akun Firebase dengan `createUserWithEmailAndPassword`, lalu memanggil `POST /api/customer/auth/daftar` dengan ID token, username dan data profil sebelum mengirim email verifikasi. Server memverifikasi token, memvalidasi profil dan username, menolak username yang sudah dipakai (409 `USERNAME_TAKEN`), memeriksa rate limit, mewajibkan persetujuan kebijakan privasi, lalu membuat profil berstatus `menunggu-email`. Jika sudah terverifikasi, status awal `menunggu-verifikasi`, bukan `aktif`. Jika email sudah punya identitas Firebase tanpa profil (pendaftaran terputus), kata sandi yang sama melanjutkannya. |
| Verifikasi email | Customer membuka tautan dari Firebase. Sesi portal baru diterbitkan setelah `email_verified` bernilai `true`. Login username sebelum verifikasi mengirim ulang tautan paling banyak sekali per 10 menit per akun. |
| Login | Customer mengisi username dan kata sandi di `POST /api/customer/auth/masuk`. Server mencari email secara privat, masuk ke Firebase melalui Identity Toolkit REST (`signInWithPassword`, header Referer `APP_URL`), memverifikasi ID token dengan Admin SDK (`checkRevoked`), lalu menerbitkan cookie. Username tidak dikenal, salah sandi dan akun ditangguhkan menerima respons 401 yang sama; email tidak pernah dikembalikan. Batas: 20 percobaan per IP/15 menit dan 10 kegagalan per username/15 menit. `POST /auth/sesi` tetap dipakai untuk penukaran ID token setelah pendaftaran/verifikasi. |
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
- **Rate limit (memori, dengan batas jumlah kunci):** daftar 5/jam/IP; tukar sesi 20/15 menit/IP; pengajuan pesanan 20/jam **per akun** (termasuk retry idempoten dan percobaan gagal, agar customer di balik NAT rumah sakit tidak berbagi kuota), ditambah maksimal 10 permintaan berstatus `menunggu-penawaran` per akun; unggah bukti 10/jam/akun (rancangan).
- **Validasi input:** validator bersama untuk klien dan server, batas panjang setiap kolom, maksimal 30 baris keranjang, dan jumlah bilangan bulat 1–1.000.000 (memakai `jumlahRfqValid`).
- **XSS:** seluruh teks dirender sebagai teks React tanpa `dangerouslySetInnerHTML`. Nama berkas unggahan tidak pernah dipakai sebagai path.
- **Audit:** event baru ditulis append-only ke `customer-portal-audit-archive/YYYY-MM.jsonl`; pada startup, entri dari `customer-portal-audit.jsonl` legacy disalin ke arsip bulanan tanpa mengubah atau menghapus file lama. Event tidak memuat token, password, email atau isi profil; mutasi staf mencatat username pelaku. Catatan `attempt` ditulis sebelum commit dan `committed` setelahnya, dengan ID event dan revisi yang sama. Jika penulisan arsip gagal, API melaporkan kegagalan; `attempt` tanpa `committed` harus direkonsiliasi dengan revisi database, bukan dianggap sukses atau gagal secara otomatis. Audit ini terpisah dari audit RBAC umum. Belum ada penghapusan otomatis atau endpoint ekspor arsip Customer Portal.
- **Pemisahan provider Firebase (wajib sebelum Email/Password diaktifkan):** `/api/auth/firebase-login` dan `/api/firebase/hydrate` hanya menerima token dengan `firebase.sign_in_provider == 'google.com'`, sesuai tombol yang tersedia saat ini. Fungsi admin di Firestore Rules juga mewajibkan provider Google. Alasannya, token Email/Password customer tidak boleh menjadi jalur masuk ERP atau Firestore, walaupun emailnya sama dengan email karyawan. Perubahan ini dilakukan bersama tes regresi login karyawan, hydrate dan rules.

### 3.4 Status akun customer

| Status | Arti | Hak akses |
| --- | --- | --- |
| `menunggu-email` | Profil dibuat, email belum diverifikasi | Belum dapat masuk portal; hanya kirim ulang verifikasi |
| `menunggu-verifikasi` | Email terverifikasi, menunggu tautan pelanggan B2B oleh sales | Katalog, keranjang, profil, alamat, notifikasi; belum dapat mengajukan pesanan |
| `aktif` | Tertaut ke `sales_pelanggan` | Seluruh fitur portal yang tersedia, termasuk pengajuan permintaan penawaran dan pembatalannya; penawaran harga, faktur dan pembayaran belum dibangun |
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

**Status implementasi (25 November 2026, lokal):** baru status `menunggu-penawaran` dan `dibatalkan` yang dibangun. Pengajuan memotret baris keranjang server (nama, model, SKU, izin edar, satuan dari katalog terbit saat itu) dan alamat, lalu mengosongkan keranjang dalam satu penulisan. Browser hanya mengirim `requestId`, revisi keranjang, ID alamat dan catatan; baris tidak pernah diambil dari body. Nomor `PRT-YYMMDD-XXXXXX` adalah nomor permintaan portal, bukan nomor Sales Order. Pesanan dari ruang kerja developer diberi penanda `uji` dan tampil sebagai "uji developer" di inbox staf. Status setelah `menunggu-penawaran` belum tersedia karena penawaran membutuhkan tarif PPN dari konfigurasi finance (`keuangan_tetapan_pajak`, `PPN Keluaran`, terverifikasi) yang saat ini hanya tersedia di klien, serta konversi Sales Order yang masih terhalang P0-02.

**Penawaran dihitung secara kanonik di server.** Form Sales Order existing menurunkan harga dari kontrak/skema harga dan menetapkan PPN 11% secara tetap ([SalesOrderModule.tsx](../src/components/modules/commercial/sales/SalesOrderModule.tsx)), serta tidak memiliki ongkir. Karena itu, nilai penawaran tidak boleh dihitung ulang oleh form tersebut.

- Sales mengisi harga satuan dan diskon per baris dalam rupiah bulat, ongkir, dan masa berlaku. Tarif PPN diambil dari konfigurasi finance, bukan konstanta.
- Server menghitung DPP, PPN, dan total per baris. Ongkir dan pembulatan dialokasikan secara proporsional ke baris, dan selisih pembulatan ditempatkan di baris terakhir. Dengan begitu, jumlah seluruh Sales Order sama persis dengan total penawaran.
- `PenjualanAlkes` tidak memiliki field ongkir, sehingga alokasi ongkir disimpan di field opsional baru `ongkirAlokasi`. Sesuai keputusan pengguna 24 November 2026, Sales/Finance menetapkan perlakuan pajak ongkir pada setiap penawaran; server harus menyimpan pilihan itu pada versi penawaran.
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

- **Tersedia lokal:** notifikasi pesanan diturunkan dari riwayat status pesanan milik customer (diterima, dibatalkan customer, dibatalkan tim beserta alasannya), maksimal 50 terbaru. Status baca disimpan per ID event pada `notificationReads`, sehingga event yang terjadi bersamaan dengan "tandai sudah dibaca" tetap belum dibaca. Username staf tidak pernah tampil ke customer.
- **Belum diimplementasikan:** notifikasi penawaran, pembayaran, perubahan status akun, dan pengumuman perusahaan.
- Pengumuman direncanakan untuk staf dengan izin `sales-marketing:publish`; email di luar email autentikasi Firebase belum termasuk.
- Refetch saat tab aktif dan polling 30 detik adalah rancangan. Kanal WebSocket khusus customer dievaluasi setelah alur dasar stabil.

### 3.8 API tersedia dan rancangan

**Customer — tersedia lokal** (selain `/status`, rute pendaftaran, sesi dan keluar, endpoint memerlukan cookie sesi `ams_customer_session`; API portal selain `/status` mengembalikan 404 saat flag nonaktif):

| Endpoint | Fungsi |
| --- | --- |
| `GET /api/customer/status` | Publik: apakah portal aktif (untuk menampilkan pilihan login) |
| `POST /api/customer/auth/daftar` | Membuat profil customer dari ID token terverifikasi dan username unik |
| `POST /api/customer/auth/cek-username` | Memeriksa format dan ketersediaan username (rate limit 30/15 menit) |
| `POST /api/customer/auth/masuk` | Login username + kata sandi, menerbitkan sesi portal |
| `POST /api/customer/auth/sesi` | Menukar ID token menjadi sesi portal |
| `POST /api/customer/auth/keluar`, `/api/customer/auth/keluar-semua` | Mencabut sesi aktif atau semua sesi milik customer |
| `GET /api/customer/auth/saya`, `GET /api/customer/profil` | Profil ringkas dan status akun |
| `GET /api/customer/katalog`, `GET /api/customer/katalog/:id` | Katalog terbit: pencarian, kategori, detail dan label ketersediaan |
| `GET` / `PUT /api/customer/keranjang` | Keranjang server per customer dengan nomor revisi |
| `GET` / `POST` / `PATCH` / `DELETE /api/customer/alamat[/:id]` | Alamat pengiriman |
| `PATCH /api/customer/profil` | Memperbarui nama, telepon belum terverifikasi dan perusahaan |
| `GET /api/customer/pesanan`, `GET /api/customer/pesanan/:id` | Riwayat dan detail permintaan milik akun; ID milik customer lain menjawab 404 |
| `POST /api/customer/pesanan` (body: `requestId`, `cartRevision`, `alamatId`, `catatan`) | Mengajukan permintaan penawaran dari keranjang server. Hanya akun `aktif` tertaut (atau developer). 201 saat dibuat, 200 untuk `requestId` yang sama; `CART_CHANGED`, `CART_EMPTY`, `ADDRESS_NOT_FOUND`, `CART_PRODUCT_UNAVAILABLE`, `TOO_MANY_OPEN_ORDERS` |
| `POST /api/customer/pesanan/:id/batal` (body: `alasan` opsional) | Membatalkan permintaan yang masih `menunggu-penawaran` |
| `GET /api/customer/notifikasi`, `POST /api/customer/notifikasi/baca` | Notifikasi pesanan dan penandaan sudah dibaca |

**Rancangan customer API — belum tersedia:** keputusan penawaran, tagihan, unggah/unduh bukti bayar, dan unduh PDF.

**Staf ERP — tersedia lokal** (sesi `ams_session` + `requirePermission`; semua mutasi wajib lolos pemeriksaan Origin yang sama):

| Endpoint | Izin |
| --- | --- |
| `GET /api/erp/portal/customers` | `sales-marketing:view` |
| `POST /api/erp/portal/customers/:id/tautkan` (body: `pelangganId`) | `sales-marketing:update` |
| `POST /api/erp/portal/customers/:id/tangguhkan` | `sales-marketing:update` |
| `GET /api/erp/portal/pesanan` | `sales-marketing:view` |
| `POST /api/erp/portal/pesanan/:id/batalkan` (body: `alasan` wajib) | `sales-marketing:update` |

Tidak ada resource atau aksi RBAC baru. `tautkan` hanya menerima master `sales_pelanggan` yang unik dan aktif; akun yang belum memverifikasi email atau telah ditangguhkan tidak dapat diaktifkan melalui endpoint ini. Satu pelanggan B2B tidak boleh tertaut ke lebih dari satu akun portal. Penangguhan mencabut sesi server customer dan dicatat bersama username staf. Inbox pesanan menampilkan ringkasan akun pengaju, baris, alamat, catatan dan riwayat, tanpa `requestId` atau ID internal customer; pembatalan staf menyimpan username pelaku untuk audit tetapi tidak menampilkannya ke customer. Pemulihan akun yang ditangguhkan belum tersedia. Data akun portal **tidak** dimasukkan ke kunci `/api/sync`, sehingga data pribadi customer tidak tersalin ke cache localStorage browser karyawan.

**Rancangan endpoint staf yang belum tersedia** (jangan dianggap sebagai fitur berjalan): form penawaran berversi, persetujuan kredit, konversi Sales Order, rekonsiliasi, pembayaran, pengumuman dan pemulihan akun. Aksi `publish` dimiliki `sales_manager`/`pjt`, bukan `sales_medrep`; role bawaan finance belum memiliki `finance-akuntansi:approve`. Seluruh workflow tersebut masih memerlukan implementasi backend, UI dan validasi.

### 3.9 Frontend dan UI/UX

- `src/main.tsx`: path `/akun` memuat `CustomerPortalApp` secara lazy sebagai bundle terpisah yang tidak memuat layanan sinkronisasi ERP (`pocketbase.ts`).
- Rute UI yang tersedia: `/akun/masuk`, `/akun/daftar`, `/akun/lupa-sandi`, `/akun/verifikasi`, `/akun` (ringkasan dengan statistik dan 3 pesanan terbaru), `/akun/katalog`, `/akun/katalog/:id`, `/akun/keranjang` (dengan panel pengajuan permintaan penawaran), `/akun/pesanan`, `/akun/alamat`, `/akun/profil`, dan `/akun/notifikasi` (dengan badge belum dibaca). Halaman tagihan belum dibangun. Detail pesanan menyatakan "belum ada penawaran" untuk harga dan tagihan, bukan angka contoh.
- Halaman depan: pilihan login dua kartu yang responsif. Kartu karyawan membuka `KartuMasuk` existing.
- ERP: tab **Portal Customer** pada modul Sales & Marketing tersedia lokal (`PortalCustomerModule.tsx`): inbox permintaan dengan detail dan pembatalan beralasan, serta daftar akun dengan penautan ke `sales_pelanggan` aktif dan penangguhan. Tombol aksi tetap divalidasi RBAC di server. Tab **Bukti Bayar Portal** pada modul Finance masih rancangan.
- Identitas visual: logo dan warna brand dari identitas website CMS. Layout bersih dengan header dan navigasi samping di desktop, navigasi bawah di mobile, serta tipografi yang mudah dibaca. Tampilan dibuat berbeda dari dashboard ERP internal.
- Aksesibilitas: target sentuh minimal 44 px, label form yang jelas, status loading, kosong dan error di setiap halaman, serta tidak memakai data contoh.

### 3.10 Penyimpanan, migrasi dan rollback

| Perubahan | Sifat |
| --- | --- |
| `AMS_DATA_DIR/customer-portal-db.json` | Versi 2 berisi `version`, `revision`, `customers`, `sessions` ter-hash, keranjang dan alamat. `pelangganId` ditambahkan sebagai field opsional pada record customer; data versi 2 yang sudah ada tetap valid tanpa migrasi destructive. Ditulis atomik tmp + rename; loader berhenti tanpa menimpa jika berkas rusak/versi tidak didukung. Koleksi aditif `orders` dan `notificationReads` ditambahkan tanpa menaikkan versi: berkas lama tanpa koleksi ini dimuat sebagai daftar kosong, dan kode lama mengabaikannya. Metadata bukti bayar belum ditambahkan. |
| `AMS_DATA_DIR/customer-portal-audit-archive/YYYY-MM.jsonl` | Arsip bulanan append-only untuk event baru; entri dari `customer-portal-audit.jsonl` legacy disalin tanpa menghapus sumber legacy |
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
- [x] ✅ **Lokal — masuk dengan Google (Gmail pribadi):** 25 November 2026. Tombol "Lanjutkan dengan Google" di halaman masuk/daftar. Server customer menerima provider `password` dan `google.com` (Google wajib `email_verified`); provider lain ditolak. Akun Google baru wajib melengkapi username, profil dan persetujuan kebijakan; login ERP tetap hanya untuk email karyawan RBAC. Bukti: `firebase-provider-isolation.test.ts`.

### Tahap 4 — Customer Dashboard

- [x] ✅ **Lokal — kerangka akun:** layout dan navigasi ringkasan/profil, link katalog existing, serta penanganan 401. Browser memeriksa profil pada lebar CSS 360, 768 dan 1280 px tanpa overflow horizontal. Navigasi modul transaksi menyusul bersama backend-nya.
- [x] ✅ **Lokal — ringkasan dan navigasi:** ringkasan akun menampilkan jumlah baris keranjang, jumlah alamat, jumlah notifikasi belum dibaca, jumlah permintaan menunggu penawaran, dan 3 pesanan terbaru dari data server. Akses cepat menuju katalog, keranjang dan pesanan tersedia. Data dimuat langsung setelah login tanpa perlu memuat ulang halaman. Event transaksi/tagihan belum ditampilkan karena modulnya belum dibangun.
- [x] ✅ **Lokal — katalog terbit:** pencarian nama/model/produsen/SKU/izin edar, kategori, foto, spesifikasi dan detail per produk. Pilihan SKU dilakukan eksplisit sebelum masuk keranjang. Harga final dan ketersediaan diberi keterangan perlu konfirmasi sales, bukan angka atau stok operasional yang belum tersambung. Sumbernya snapshot CMS terbit; API terautentikasi hanya mengembalikan field non-internal.
- [x] ✅ **Lokal — keranjang server:** tambah varian, ubah jumlah, hapus baris dan persistensi lintas restart. Keranjang divalidasi terhadap katalog terbit, dibatasi 30 baris, dan dipisah per customer.
- [x] ✅ **Lokal — pengajuan permintaan penawaran:** 25 November 2026. Alamat tersimpan, catatan (maks. 1.000 karakter) dan `requestId` idempoten; baris diambil dari keranjang server dan katalog terbit, keranjang dikosongkan dalam penulisan yang sama, dan revisi keranjang mencegah pengajuan isi yang sudah berubah di perangkat lain. Hanya akun `aktif` tertaut atau developer (ditandai uji). Bukti: `customer-auth.test.ts`.
- [ ] Pesanan: riwayat, detail, status, penawaran (setujui/tolak), pembatalan, dan unduh PDF.
  - [x] ✅ **Lokal — riwayat, detail dan pembatalan:** halaman `/akun/pesanan` dengan daftar, detail baris/alamat/catatan/riwayat status, dan pembatalan beralasan opsional selama `menunggu-penawaran`. ID milik customer lain menjawab 404. Penawaran, persetujuan dan PDF menunggu Tahap 5.
- [ ] Tagihan: daftar faktur, status pembayaran, instruksi transfer, serta unggah dan unduh bukti.
- [ ] Profil: nama, telepon, data perusahaan, alamat, ganti password, ganti email, dan keluar dari semua perangkat.
  - [x] ✅ **Lokal — profil dasar:** nama, telepon belum terverifikasi, perusahaan, tautan reset sandi dan keluar semua perangkat. Tes dua customer, simpan/reload browser dan persistensi disk lulus. Email/alamat belum dapat diubah dari portal.
  - [x] ✅ **Lokal — alamat pengiriman:** tambah, ubah, hapus, dan alamat utama melalui UI serta penyimpanan server. Endpoint dan data dipisah per customer; perubahan antar-customer ditolak melalui sesi.
- [ ] Pusat notifikasi dan pengumuman nyata.
  - [x] ✅ **Lokal — notifikasi pesanan:** diturunkan dari riwayat status pesanan, badge belum dibaca, "tandai semua sudah dibaca" per ID event, dan tautan ke pesanan. Pengumuman perusahaan serta notifikasi penawaran/pembayaran belum ada.

### Tahap 5 — Integrasi ERP

- [x] ✅ **Lokal — API staf akun customer:** daftar data minimum, penautan ke satu `sales_pelanggan` aktif yang unik, dan penangguhan dengan pencabutan sesi. RBAC `sales-marketing:view/update`, guard Origin, larangan aktivasi sebelum verifikasi email, pencegahan tautan ganda, dan audit username pelaku diuji dengan router/store terisolasi.
- [x] ✅ **Lokal — UI staf Portal Customer:** tab baru di Sales & Marketing untuk meninjau akun, menautkan ke `sales_pelanggan` aktif dan menangguhkan akun. Typecheck dan build lulus; aksi divalidasi oleh endpoint yang sudah diuji.
- [x] ✅ **Lokal — saran penautan dari email:** 25 November 2026. Field opsional `emailPortal` pada master B2B (diisi di detail CRM, unik). `GET /api/erp/portal/customers` menambahkan `saranB2B` hanya jika email akun cocok (tanpa membedakan huruf besar) dengan tepat satu B2B aktif yang belum tertaut. Staf menekan **Konfirmasi tautan**; tidak ada penautan otomatis. Bukti: `customer-auth.test.ts`.
- [ ] Alur pemulihan/aktivasi ulang akun ditangguhkan dengan pemeriksaan ulang master B2B dan audit.
- [ ] Inbox pesanan portal dan form penawaran berversi dengan perhitungan kanonik di server (tarif PPN dari konfigurasi, ongkir, alokasi pembulatan).
  - [x] ✅ **Lokal — inbox dan pembatalan staf:** `GET /api/erp/portal/pesanan` (`sales-marketing:view`) dan pembatalan dengan alasan wajib (`sales-marketing:update`, Origin sama, audit username). Sales rep tanpa izin update ditolak 403. Form penawaran belum dibangun karena tarif PPN finance belum tersedia di server.
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
- [x] ✅ **Lokal — konfigurasi popup Google:** 24 November 2026. Resolver browser dikonfigurasi bersama persistensi memori; tes mock memverifikasi konfigurasi dan pesan kegagalan popup. Regresi penuh 41 file / 508 tes, TypeScript dan build lulus di Windows lokal. Login Firebase nyata dan browser staging tetap belum diuji.
- [x] ✅ **Lokal — regresi penuh:** 24 November 2026; `npm test` lulus 40 file/497 tes, `npm run lint`, `npm run lint:rules`, dan `npm run build` lulus.
- [ ] Uji browser desktop, tablet, dan mobile dengan data uji yang jelas ditandai, bukan data dummy produk.
- [ ] Staging Linux: Firebase Email/Password nyata dengan akun uji, backup data portal, dan rollback dengan flag.
- [ ] Tinjauan keamanan sebelum flag diaktifkan untuk pengguna nyata.

**Status Tahap 4–6:** belum selesai. Hasil regresi di atas hanya mencakup kode dan skenario yang sudah ada; penawaran, konversi Sales Order, tagihan/pembayaran, notifikasi transaksi, dan sebagian profil belum dibangun. Uji Firebase nyata, staging Linux, dan tinjauan keamanan juga belum dilakukan. Lingkup penyelesaian yang dikonfirmasi pengguna: B2B saja, pajak ongkir ditetapkan per penawaran, pembayaran penuh saja, dan lokal saja; tidak ada izin deploy pada tahap ini.

## 5. Matriks pengujian

| Area | Skenario wajib |
| --- | --- |
| Login karyawan | Username/password, Google Firebase, setup awal, reset developer, logout, dan dashboard sesuai role tidak berubah |
| Pemisahan provider | Token Email/Password ditolak di `/api/auth/firebase-login`, `/api/firebase/hydrate`, dan rules admin, termasuk jika emailnya sama dengan akun karyawan |
| Registrasi customer | Data valid, username format salah/terlarang/sudah dipakai (tanpa membedakan huruf besar), email sudah terdaftar, data tidak valid, tanpa persetujuan privasi, dan rate limit |
| Login customer | Login username, respons sama untuk username tidak dikenal/salah sandi/ditangguhkan, throttle per username, email belum terverifikasi, sesi kedaluwarsa, logout, dan keluar dari semua perangkat |
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
- [ ] Pastikan provider **Google** aktif (sudah dipakai karyawan) dan `erp.remediams.com` tercantum di **Authorized domains** agar pop-up "Lanjutkan dengan Google" customer berfungsi.
- [ ] Pastikan Firebase Admin (service account) aktif di VPS Linux. Tanpa Admin SDK, pendaftaran customer dinonaktifkan.
- [ ] Siapkan teks **Kebijakan Privasi** dan **Syarat Layanan** untuk persetujuan saat registrasi.
- [ ] Buat atau tetapkan role finance dengan izin `finance-akuntansi:view` dan `finance-akuntansi:approve` melalui Manajemen RBAC.
- [ ] Tetapkan rekening tujuan transfer, sumber tarif PPN finance yang otoritatif untuk server, aturan pembulatan, serta masa berlaku penawaran default. Perlakuan pajak ongkir per penawaran sudah diputuskan; implementasinya belum ada.
- [x] ✅ Keputusan 24 November 2026: pelanggan **perorangan** ditunda; tahap awal hanya melayani customer B2B yang ditautkan ke `sales_pelanggan` aktif.
- [ ] Tentukan apakah nomor telepon perlu verifikasi OTP SMS (berbiaya).
- [ ] Tentukan masa retensi bukti bayar dan data akun yang dinonaktifkan.
- [ ] Rancang alur **retur/refund**, pelunasan sebagian, dan jurnal penerimaan kas otomatis jika dibutuhkan. Fitur ini belum didukung ERP saat ini dan di luar lingkup awal portal.
- [ ] Tutup P0-02 (pemeriksaan versi dasar sinkronisasi) sebelum konversi Sales Order portal dipakai oleh pengguna nyata.

## 8. Riwayat

### 24 November 2026 — penyelarasan palet biru lokal

- Sesuai revisi pengguna, aksen tosca aplikasi, website dan portal diselaraskan menjadi biru `#2a6199`. Alias token teal yang dipakai portal kini mengikuti palet biru bersama untuk tombol, border, latar, teks dan fokus; warna status semantik tetap terpisah.
- Browser lokal memeriksa form masuk portal dengan status API sintetis, bukan akun nyata. Tombol utama memakai turunan `#245382`, hover `#1e456c`, dan ring fokus `#2a6199`. TypeScript, build dan 33 tes terarah website/dokumen lulus.
- Tidak ada perubahan autentikasi, sesi, izin, data customer atau layanan VPS. Tampilan halaman portal setelah login dan staging belum diuji; fase pengembangan tidak ditandai selesai.

### 24 November 2026 — deployment staging `d4b089e`

- Kode portal dalam `d4b089e` telah di-deploy ke Linux staging. Service `ams` aktif dan health lokal/publik serta koneksi Firebase Admin diperiksa; `/akun` dan status portal merespons HTTP 200, dengan `enabled`/`authAvailable` true dan `registrationAvailable` false. Hash snapshot website cocok dengan salinan stash.
- Ini bukan uji fungsi portal, login Google, penawaran atau pembayaran di staging. Tahap 4–6 tetap terbuka; verifikasi rules dan alur browser nyata masih diperlukan.

### 24 November 2026 — resolver popup Google lokal

- Inisialisasi Firebase customer kini menetapkan `browserPopupRedirectResolver` sekaligus mempertahankan `inMemoryPersistence`; tidak ada perubahan provider, akun, atau rules Firebase.
- `customer-firebase-config.test.ts` menguji konfigurasi melalui mock dan pesan popup diblokir/dibatalkan. Regresi lokal Windows: 41 file / 508 tes, TypeScript, build dan `git diff --check` lulus.
- **Batasan:** tes mock bukan bukti popup atau autentikasi Google bekerja pada browser, Firebase nyata, atau staging. Tahap 4–6 dan P1-10 tetap terbuka; belum commit atau deploy.

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

### 24 November 2026 — akses developer ke Customer Portal (lokal)

- **Aturan:** developer bukan karyawan dan dapat mengakses seluruh modul, termasuk portal customer. Hanya ada satu developer, yaitu user RBAC `isHiddenDeveloper`. Penanda ini tidak dapat diberikan melalui modul mana pun.
- **Cara kerja:** jika request ke `/api/customer/*` tidak membawa sesi customer yang valid tetapi membawa sesi ERP developer, server memakai ruang kerja portal milik developer. Ruang kerja dibuat sekali (audit `DEVELOPER_WORKSPACE_CREATED`). Sesi customer yang valid tetap diutamakan, Origin tetap diwajibkan untuk mutasi, dan "keluar dari semua perangkat" ditolak karena akses mengikuti sesi ERP.
- **Isolasi:** ruang kerja tidak memakai Firebase, tidak tampil di `GET /api/erp/portal/customers`, dan endpoint tautkan/tangguhkan menjawab 404. UID Firebase berawalan `rbac-developer:` ditolak saat pendaftaran. UI menampilkan penanda "Mode developer" dan tautan kembali ke ERP.
- **Bukti lokal:** `customer-auth.test.ts` lulus 26 tes, termasuk penolakan sales rep dan staf role `developer_it_support`, isolasi keranjang antara developer dan customer, prioritas cookie customer, Origin silang, dan persistensi setelah restart. Regresi penuh lulus 40 file / 484 tes, `npm run lint`, `npm run build`.

### 25 November 2026 — login customer dengan username (lokal)

- **Keputusan pengguna:** customer masuk dengan username, bukan email. Username dibuat saat mendaftar dan tidak boleh sama dengan yang sudah dipakai.
- **Implementasi:** field `username` pada record customer (huruf kecil, 3–30 karakter `a-z0-9._-`, unik, divalidasi saat store dimuat). `POST /auth/daftar` mewajibkan username; `POST /auth/cek-username` memeriksa ketersediaan; `POST /auth/masuk` memetakan username ke email di server, masuk melalui Firebase Identity Toolkit REST, lalu memakai verifikasi ID token dan sesi yang sama. Email tetap dipakai untuk verifikasi dan lupa sandi. Profil menampilkan username.
- **Keamanan:** respons 401 identik untuk username tidak dikenal, salah sandi dan akun ditangguhkan; email tidak dikembalikan; throttle per username (10 gagal/15 menit) di samping batas per IP; kiriman ulang verifikasi maksimal sekali per 10 menit. Password kini melewati server AMS melalui HTTPS hanya untuk diteruskan ke Firebase dan tidak disimpan atau dicatat.
- **Kompatibilitas:** username opsional pada record lama. Staging belum memiliki customer terdaftar karena registrasi masih tertutup, sehingga tidak ada akun yang kehilangan jalur masuk. Ruang kerja developer tidak memakai username.
- **Bukti lokal:** `customer-auth.test.ts` dan `firebase-provider-isolation.test.ts` lulus 33 tes (registrasi username, duplikat tanpa membedakan huruf besar, nama terlarang, login username, respons generik, throttle, verifikasi ulang, akun ditangguhkan, pemetaan error REST dan header Referer). Regresi penuh lulus 40 file / 488 tes, `npm run lint`, `npm run build`. Login nyata ke Firebase staging belum diuji.

### 25 November 2026 — permintaan penawaran, inbox staf dan notifikasi pesanan (lokal)

- **Lingkup:** pengajuan permintaan penawaran dari keranjang, halaman Pesanan saya, pembatalan oleh customer dan staf, notifikasi pesanan nyata, serta tab ERP **Portal Customer** (inbox pesanan dan manajemen akun).
- **Keputusan teknis:** harga, PPN dan penawaran **belum** dibangun. Tarif PPN wajib berasal dari `keuangan_tetapan_pajak` yang terverifikasi dan saat ini hanya dibaca di klien; menghitung penawaran tanpa sumber itu akan melanggar rancangan 3.5. Konversi Sales Order tetap menunggu P0-02. UI menyatakan "belum ada penawaran" alih-alih menampilkan angka.
- **Perbaikan bersamaan:** data ringkasan/katalog/keranjang kini dimuat segera setelah login (sebelumnya baru tampil setelah memuat ulang); teks profil tidak lagi menyebut alamat belum dapat diubah; rate limit pengajuan berbasis akun, bukan IP.
- **Bukti lokal:** `customer-auth.test.ts` lulus 33 tes, termasuk akun belum tertaut ditolak, idempotensi `requestId`, revisi keranjang, alamat/produk tidak tersedia, batas 10 permintaan terbuka, IDOR GET/batal, Origin silang, RBAC inbox dan pembatalan staf, alasan staf wajib, username staf tidak bocor ke customer, status baca notifikasi, rate limit per akun, persistensi restart, berkas tanpa koleksi pesanan, dan penolakan data pesanan yang dirusak. Regresi penuh lulus 40 file / 492 tes, `npm run lint`, `npm run build`, `git diff --check`.
- **Batasan:** belum di-commit, di-push atau di-deploy. UI baru belum diuji di browser staging. Penawaran berversi, persetujuan customer, konversi Sales Order, tagihan, bukti bayar, PDF, pengumuman, dan pemulihan akun ditangguhkan masih terbuka.

### 25 November 2026 — masuk dengan Google dan saran penautan B2B (lokal)

- **Keputusan pengguna:** customer boleh masuk dengan Gmail pribadi; akun dicocokkan dengan pelanggan B2B sebagai **saran** yang dikonfirmasi staf, bukan penautan otomatis.
- **Alur:** pop-up Google pada app Firebase `portal-customer` (persistensi memori) → ID token ditukar di `POST /auth/sesi`. Jika belum ada profil (409 `REGISTRATION_REQUIRED`), form daftar terbuka dengan email Google terkunci dan tanpa kata sandi; customer mengisi username unik, profil dan persetujuan. Email Google sudah terverifikasi sehingga status awal `menunggu-verifikasi`. Jika pendaftaran belum dibuka, sesi Google ditutup dengan pesan jelas. Firebase memakai satu akun per email, sehingga Gmail yang sebelumnya terdaftar dengan email/sandi masuk ke akun customer yang sama.
- **Pemisahan:** login ERP tetap hanya memetakan email Google ke pengguna RBAC; Gmail customer tidak mendapat akses ERP. Karyawan tidak otomatis menjadi customer; mereka harus mendaftar sendiri.
- **Saran B2B:** field opsional `emailPortal` pada `sales_pelanggan` (aditif, data lama tetap valid). Saran hanya muncul jika tepat satu B2B aktif yang belum tertaut memiliki email sama; staf mengonfirmasi melalui endpoint `tautkan` yang sudah ada (RBAC, Origin, audit).
- **Risiko yang diterima:** (1) "Keluar dari semua perangkat" mencabut refresh token Firebase untuk UID tersebut; jika Gmail yang sama juga akun karyawan, sesi klien Firebase karyawan ikut dicabut, sedangkan sesi ERP `ams_session` tidak terpengaruh. (2) Rules Firestore yang sudah ada mengizinkan pengguna Google terverifikasi membaca `/test` dan membuat profil `public` sendiri; paparan ini sudah ada melalui tombol Google ERP dan tidak bertambah, tetapi tetap perlu ditinjau sebelum produksi.
- **Bukti lokal:** `customer-auth.test.ts` dan `firebase-provider-isolation.test.ts` lulus 39 tes (Google terverifikasi diterima, Google tanpa verifikasi dan provider lain ditolak, saran hanya untuk kecocokan unik/aktif/belum tertaut, tanpa penautan otomatis). Regresi penuh lulus 40 file / 493 tes, `npm run lint`, `npm run build`, `git diff --check`.
- **Batasan:** belum di-commit/di-deploy. Pop-up Google nyata di staging belum diuji; registrasi staging masih menunggu URL kebijakan.
