# Evaluasi Staging dan Kesiapan Produksi AMS

**Tanggal evaluasi awal:** 23 November 2026

**Keputusan awal:** **NO-GO untuk produksi penuh**; staging dapat digunakan untuk pengujian.

**Kandidat yang dievaluasi:** `origin/main` commit `5780a4f`, melalui worktree rilis terisolasi.

**Lingkungan target:** Ubuntu staging `https://erp.remediams.com`, Firebase staging dan service `ams`.

Dokumen ini mencatat kondisi pada tanggal evaluasi, bukan pernyataan bahwa kondisi tersebut masih berlaku selamanya. Perubahan lokal lain di worktree utama bukan bagian dari kandidat yang diperiksa dan tidak otomatis terpasang di VPS. Hasil pengujian kode bukan bukti kepatuhan hukum atau kesiapan operasional.

## Cara mencatat progres

Pertahankan evaluasi awal sebagai baseline. Setiap evaluasi berikutnya ditambahkan di bagian **Riwayat evaluasi**, dengan tanggal, commit, lingkungan, perubahan, hasil pengujian, tautan bukti yang aman, penanggung jawab dan keputusan terbaru. Perbarui juga status di **Daftar tindak lanjut** dengan tanggal dan bukti; jangan menandai selesai hanya karena kode sudah dibuat atau di-push. Bukti staging dan produksi dicatat terpisah.

Status yang digunakan:

- **Terbukti:** ada bukti yang sesuai dengan lingkup dan lingkungan pemeriksaan.
- **Parsial:** sebagian tersedia atau telah diperiksa, tetapi persyaratan belum lengkap.
- **Belum diverifikasi:** belum ada bukti memadai; bukan berarti pasti gagal.
- **Ditunda:** secara sadar dikecualikan dari fase ini dan memerlukan persetujuan tertulis.
- **Terbuka / dalam pengerjaan / selesai diverifikasi:** status tindak lanjut; selesai hanya setelah kriteria penerimaan dibuktikan.

Setiap pekerjaan yang rampung ditambahkan ke checklist di bawah dengan `- [x] ✅`, lingkungan dan bukti. Tanda hijau hanya berlaku untuk lingkup yang disebutkan, bukan seluruh fase atau lingkungan lain. Pekerjaan parsial, tertunda dan belum terbukti tetap `- [ ]`; perbarui riwayat saat status berubah tanpa menghapus baseline.

Jangan menyimpan kata sandi, token, isi environment, service-account JSON, data pribadi, atau log berisi rahasia dalam dokumen atau bukti yang dirujuk.

### Checklist pekerjaan berdasarkan bukti yang tersedia

Pemeriksaan statis baseline dilakukan pada 24 November 2026 di worktree berbasis commit `ca6e2b0`. Entri lokal dan riwayat di bawah mempertahankan status pada saat pemeriksaannya; status deployment terbaru dicatat tersendiri.

- [x] ✅ **Lokal Windows — submenu Daftar Kode Akun:** Finance tab 8 memuat 180 akun referensi beserta dokumen sumber lengkap, pencarian dan tambah/edit dengan izin update Finance pada UI/server. Kode unik dan sub-akun divalidasi, identitas akun tetap saat kode berubah, serta draf usang dan kegagalan storage/antrean dilaporkan. Koleksi terpisah dari CoA/jurnal dan dipertahankan saat purge dummy. Bukti: 86 tes terarah pada 4 file lulus, mencakup render sintetis, tambah/edit/reload perangkat, RBAC, antrean HTTP batch dan penerimaan data server dengan respons sintetis, serta persistensi server lokal setelah restart dan penolakan versi usang; `npm run lint`, `npm run build` dan `git diff --check` lulus. Panduan: [daftar-kode-akun.md](./daftar-kode-akun.md).
- [x] ✅ **Lokal Windows — verifikasi paket perubahan Finance/FOC sebelum publikasi, 26 November 2026:** 138 tes terarah pada 6 file lulus untuk daftar kode akun, antrean/sinkronisasi, RBAC, asal data, rujukan jurnal/pajak dan stok promosi FOC. Type-check dan build client/server paket perubahan ini telah lulus pada pemeriksaan lokal sebelumnya. Bukti ini tidak mencakup deployment, login browser terautentikasi atau penyelesaian audit seluruh perhitungan.
- [ ] **Daftar Kode Akun — staging:** belum di-deploy. Login dan interaksi browser terautentikasi, acknowledgment koleksi pada VPS/Firebase aktual serta sinkronisasi dua pengguna masih perlu diverifikasi; hasil lokal tidak membuktikan deployment atau audit seluruh perhitungan.
- [x] ✅ **Dokumentasi lokal — referensi daftar kode akun, 26 November 2026:** isi PDF 8 halaman yang diberikan pengguna disalin ke [daftar-kode-akun.md](./daftar-kode-akun.md), mencakup seluruh daftar akun, struktur kode, pedoman, contoh sub-akun dan disclaimer. Perbedaan kode terhadap AMS diberi catatan; tidak ada impor CoA, perubahan jurnal, migrasi akun atau deployment.
- [x] ✅ **Lokal Windows — mekanisme promosi FOC:** konfigurasi promosi manual, snapshot Sales Order, alokasi FEFO atomik untuk kit gratis, baris faktur Rp0 tanpa PPN, rincian komponen Surat Jalan, dan rancangan jurnal beban promosi berbasis valuasi batch `ASLI` telah diterapkan. Verifikasi: 46 file / 552 tes, `npm run lint`, `npm run build`, dan `git diff --check` lulus. Belum diuji atau di-deploy ke staging; data SKU promosi aktual belum dikonfigurasi.
- [x] ✅ **Deploy FOC `dc37b07` — Linux staging, 26 November 2026:** output yang dibagikan operator menunjukkan build selesai, restart service `ams`, lalu `HEALTH_OK: staging, Firebase terhubung` dan `DEPLOY_OK: dc37b07`. Percobaan health pertama gagal terhubung dan parser JSON menerima input kosong; percobaan berikutnya berhasil. Output yang dibagikan tidak mencakup rincian jumlah tes, health publik atau uji browser. Konfigurasi promosi aktual, alur FOC terautentikasi, sinkronisasi koleksi dan pencetakan belum diverifikasi di staging.
- [x] ✅ **Lokal Windows — penjagaan stok bebas dan rujukan jurnal:** alokasi pengiriman utama/FOC mempertahankan kuota pesanan aktif, termasuk ketika SKU sama dipakai produk utama dan hadiah. Finance mencari transaksi berdasarkan ID jurnal atau nomor faktur legacy yang unik; draf pajak menampilkan nomor faktur dan menahan unduhan jika rujukan hilang atau ambigu, tanpa mengubah jurnal yang sudah tersimpan. Bukti: dua kasus regresi reservasi, tes rujukan dan render sintetis Finance; `npm test` 46 file / 555 tes, `npm run lint`, dan `npm run build` lulus. Belum di-deploy atau diuji di staging; belum membuktikan atomisitas lintas koleksi dan pengiriman bersamaan.
- [ ] **Audit seluruh perhitungan dan rekonsiliasi lintas modul:** belum selesai. Hasil uji dan perbaikan lokal di atas tidak membuktikan keselarasan seluruh modul, aturan pajak atau data aktual; diperlukan matriks perhitungan, skenario integrasi dan pemeriksaan operator/keuangan.
- [ ] **Payroll gross-up — pemeriksaan kebijakan dan pembulatan:** contoh sintetis menghasilkan potongan/tunjangan Rp222.417, sementara pajak tahunan pada slip dibagi 12 dan dibulatkan menghasilkan Rp222.438. Iterasi saat ini menerima selisih di bawah Rp500; metode payroll tidak diubah tanpa keputusan pemilik dan validasi Finance/pajak.
- [ ] **Faktur pengiriman dan jurnal pendapatan — verifikasi alur:** penerbitan faktur dari pengiriman menambahkan transaksi tetapi tidak menyusun jurnal pendapatan pada jalur tersebut. Perlu dipastikan prosedur pembukuan, penanganan PPN dan rekonsiliasi data existing sebelum mengubah perilaku.
- [x] ✅ **Lokal Windows — dokumentasi alur promosi FOC:** alur konfigurasi Sales, Sales Order, alokasi Warehouse, tampilan faktur, jurnal Finance, integrasi data, posisi tombol, dan batasan saat ini dicatat di [Alur-FOC.md](./Alur-FOC.md). Perubahan dokumentasi saja; staging tidak berubah.
- [x] ✅ **Lokal Windows — warna Executive Overview:** latar dashboard dan footer, tombol aksi serta highlight navigasi Executive memakai palet tosca; `npm run lint` dan `npm run build` lulus. Tampilan browser dan staging belum diverifikasi; belum di-deploy.
- [x] ✅ **Preview browser lokal Windows — warna Executive Overview:** komponen Navbar dan ExecutiveOverview asli dirender dalam preview visual sementara di Vite `127.0.0.1:5173`, dengan stylesheet aplikasi dan data contoh lokal. Screenshot menunjukkan latar cockpit, highlight navigasi Executive dan footer berwarna tosca. Ini bukan sesi ERP terautentikasi atau uji aksi operasional; refresh mengembalikan halaman aplikasi biasa. Staging belum diperiksa atau di-deploy.
- [x] ✅ **Revisi warna Executive — lokal Windows:** sesuai revisi pengguna, palet tosca sebelumnya diganti biru `#2a6199`. Pemeriksaan computed style browser pada latar cockpit, highlight Executive dan footer menghasilkan `rgb(42, 97, 153)` untuk ketiganya; tombol/kartu memakai turunan gelap dan teks terang. `npm run lint`, `npm run build` dan `git diff --check` lulus. Bukti hanya preview visual komponen lokal; bukan uji sesi ERP, aksi operasional atau deployment staging.
- [x] ✅ **Tema biru aplikasi dan website — lokal Windows, 24 November 2026:** token biru/sky dan alias teal memakai palet `#2a6199` (utama), `#245382` (hover/sekunder), serta tingkat 50–950 untuk latar, garis, teks dan fokus. Berlaku melalui stylesheet bersama pada ERP, mobile dan Customer Portal; navigasi aktif, merek website/CMS, selection, metadata PWA serta warna bawaan dokumen/PDF diselaraskan. Snapshot dengan tosca bawaan lama dinormalisasi saat render tanpa mutasi sumber; warna kustom lain tetap dipertahankan. Bukti: TypeScript, build, 33 tes terarah pada 4 file dan `git diff --check` lulus; browser website desktop/mobile memakai brand baru, 15 alias CSS yang terpakai cocok, dan kontras putih terhadap utama 6,43:1. Login portal diuji visual dengan status API sintetis: tombol `#245382`, hover `#1e456c`, fokus `#2a6199`. Warna semantik sukses/peringatan/bahaya tetap berbeda. Bukan pengujian seluruh halaman, autentikasi/operasional, PDF yang sudah tersimpan atau deployment staging.

- [x] ✅ **Lokal — analitik Sales & Marketing:** metrik, simulasi terpisah, grafik dan navigasi dibuat dan diuji pada kandidat `5fd1631`; bukan bukti akurasi data operasional atau smoke test staging.
- [x] ✅ **Staging saat pemeriksaan — Ubuntu, HTTPS dan Firebase:** service dan health diperiksa pada deployment `0a1c6d0`; bukan bukti kondisi saat ini atau migrasi data produksi. Lihat [riwayat deployment](#24-november-2026--deployment-staging-dan-ketahanan-loader-lokal).
- [x] ✅ **Staging Linux — deployment `d4b089e`:** 24 November 2026, pengguna menjalankan fast-forward, lint, tes dan build staging; perintah berantai mencapai akhir build. Service `ams` dilaporkan `active`; health lokal dan publik merespons `staging`, Firebase Admin terhubung dan validasi siap, project `ams-integrated-system-2b9e2` dan database `(default)` cocok untuk client/Admin. Rute `/`, `/akun` dan status portal merespons HTTP 200; portal enabled/authAvailable true, registrationAvailable false. Snapshot website dipulihkan dari stash dan hash file cocok dengan stash setelah start; stash tetap disimpan. Pengguna menyatakan backup terbaru dan restore terverifikasi, tetapi bukti restore lengkap tidak diperiksa pada sesi ini. Ini bukan uji fungsional P0-01/P0-02, audit, login Google atau Customer Portal.
- [x] ✅ **Staging saat pemeriksaan — empat form Pengadaan tampil:** pengguna mengonfirmasi tampilan pada `5780a4f`; alur simpan dan persetujuan belum dinyatakan selesai.
- [x] ✅ **Staging saat pemeriksaan — satu akun uji:** pembuatan, login dan peran setelah restart diuji pada `3de93b8`; matriks seluruh akun/peran masih terbuka.
- [x] ✅ **Staging saat pemeriksaan — logout/login UI:** pengguna menguji ulang setelah deploy `70463e8`; pencabutan token lama di VPS belum diuji.
- [x] ✅ **Backup parsial — salinan terenkripsi:** hash arsip data VPS dan salinannya cocok; ekstraksi empat berkas diuji lokal. Restore lengkap dan login dari backup belum diuji.
- [x] ✅ **Lokal — pembatasan HRIS pada skenario sintetis:** HTTP/WebSocket dan aturan yang disebut pada [riwayat HRIS](#23-november-2026--push-dan-lanjutan-isolasi-hris) diuji; P0-05 tetap parsial.
- [x] ✅ **Lokal — CMS, snapshot dan RFQ:** skenario pada [riwayat website](#23-november-2026--prioritas-cms-dan-website-publik-lokal) diuji dengan data sintetis; belum mencakup seluruh fitur dan jalur live.
- [x] ✅ **Lokal dan push — loader state dan indeks media:** kasus berkas rusak dan startup diuji, commit `55c7982` dipush; belum dibuktikan di VPS.
- [x] ✅ **Lokal — rollback unggah media saat indeks gagal:** skenario yang dijelaskan pada [riwayat media](#24-november-2026--ketahanan-unggah-media-lokal) diuji; belum di-commit atau di-deploy.
- [x] ✅ **Lokal — retry cache dan penjagaan draf tertunda:** tes delta/realtime dan antrean lulus; interaksi tombol belum diuji di browser dan konflik dua editor belum selesai.
- [x] ✅ **Lokal — optimistic concurrency jalur sync umum dan administratif:** PUT/DELETE memakai `If-Match`, batch dan purge memeriksa versi semua key sebelum mutasi atomik, tombstone bertahan setelah hapus, dan reset membandingkan `expectedRevision` global. Klien memulihkan cache purge/restore setelah penolakan atau respons tak pasti; reset hanya menghapus cache setelah konfirmasi server terautentikasi. Antrean offline mempertahankan konflik 409 melewati reload. Bukti lokal terbaru: 40 file / 500 tes, `npm run lint`, dan `npm run build` lulus. **Masih terbuka:** UI dua editor/lintas tab dan staging belum diuji; perubahan belum di-commit atau di-deploy.
- [x] ✅ **Lokal — validasi batas RFQ:** tes batas dan uji browser sintetis menampilkan alasan untuk 31 produk atau jumlah pecahan tanpa mengirim permintaan; belum di-commit atau di-deploy.
- [x] ✅ **Lokal — navigasi formulir RFQ:** isian dan status pengiriman dipertahankan selama navigasi internal, diuji dengan respons sintetis; lihat [riwayat RFQ](#24-november-2026--navigasi-formulir-rfq-lokal). Belum di-deploy.
- [x] ✅ **Lokal — regresi saat pemeriksaan sebelumnya:** 38 file / 452 tes, TypeScript dan lint rules Firestore lulus sebelum perubahan navigasi RFQ.
- [x] ✅ **Lokal — audit Tahap 1 Customer Portal:** autentikasi, sesi, RBAC, sinkronisasi dan model data penjualan/keuangan ditelaah tanpa perubahan kode; lihat [riwayat audit portal](#24-november-2026--audit-customer-portal-tahap-1-lokal).
- [x] ✅ **Lokal — rancangan Tahap 2 Customer Portal:** keputusan pengguna, arsitektur, rencana kerja, matriks uji, dan revisi atas 9 temuan tinjauan dicatat di [customer-portal.md](./customer-portal.md). Pada tahap rancangan ini belum ada kode portal.
- [x] ✅ **Lokal — implementasi autentikasi Customer Portal:** store/sesi terpisah, API autentikasi, pemisahan provider, pilihan login dan UI akun/profil dasar diuji. Lihat [bukti dan batasan](./customer-portal.md#24-november-2026--implementasi-autentikasi-lokal). Firebase pada browser disimulasikan; belum diaktifkan atau di-deploy.
- [x] ✅ **Lokal — irisan pertama integrasi akun ERP:** API staf untuk daftar akun, tautan unik ke master B2B aktif, dan penangguhan dengan pencabutan sesi; tes RBAC, Origin, audit dan isolasi customer lulus. Belum ada UI staf. Lihat [bukti dan batasan](./customer-portal.md#24-november-2026--api-awal-integrasi-akun-erp-lokal).
- [x] ✅ **Staging Linux — Customer Portal aktif:** commit `5b273a2` ter-deploy dan flag portal menyala; status publik `enabled`/`authAvailable` bernilai true. Registrasi masih menunggu URL kebijakan. Lihat [riwayat aktivasi](#24-november-2026--deploy-dan-aktivasi-customer-portal-di-staging-linux).
- [x] ✅ **Lokal — akses developer ke Customer Portal:** sesi ERP akun developer tersembunyi membuka ruang kerja portal terpisah; karyawan lain, termasuk role `developer_it_support`, tetap ditolak. 40 file / 484 tes, lint dan build lulus. **Staging:** commit `ca6e2b0` ter-deploy, service `active`, status portal `enabled`/`authAvailable` true; uji browser login developer → `/akun` belum dilaporkan. Lihat [rincian](./customer-portal.md#24-november-2026--akses-developer-ke-customer-portal-lokal).
- [x] ✅ **Lokal — login customer dengan username:** registrasi mewajibkan username unik (tanpa membedakan huruf besar), cek ketersediaan, login `POST /api/customer/auth/masuk` dengan respons generik dan throttle per username. 40 file / 488 tes, lint dan build lulus; belum di-deploy. Lihat [rincian](./customer-portal.md#25-november-2026--login-customer-dengan-username-lokal).
- [x] ✅ **Lokal — permintaan penawaran dan inbox staf Customer Portal:** 25 November 2026. Akun tertaut dapat mengajukan permintaan penawaran (idempoten, tanpa harga) dari keranjang server, melihat/membatalkan pesanannya, dan menerima notifikasi status. Tab ERP **Portal Customer** menampilkan inbox serta penautan/penangguhan akun dengan RBAC server. 40 file / 492 tes, lint, build dan `git diff --check` lulus; belum di-commit/di-deploy. Penawaran harga menunggu tarif PPN finance di server. Lihat [rincian](./customer-portal.md#25-november-2026--permintaan-penawaran-inbox-staf-dan-notifikasi-pesanan-lokal).
- [x] ✅ **Lokal — implementasi login Google dan saran penautan B2B:** UI/provider dan saran staf ada pada worktree lokal; uji server/provider lulus sesuai catatan Customer Portal. Review sebelumnya menemukan resolver popup belum dikonfigurasi; perbaikan lokal tercatat di bawah. Alur Google browser belum terbukti siap dan belum di-deploy. Lihat [rincian](./customer-portal.md#25-november-2026--masuk-dengan-google-dan-saran-penautan-b2b-lokal) dan P1-10.
- [x] ✅ **Review kode lokal — konflik sync, audit, headers dan limiter:** review awal 24 November menemukan jalur tulis umum belum mewajibkan versi klien; perbaikan lokal kini melindungi PUT/DELETE/batch/purge/reset dengan precondition, diuji pada 40 file / 500 tes, TypeScript dan build. Audit RBAC masih menyimpan maksimal 500 entri, sebagian audit bisnis memakai aktor tetap, dan limiter login/RFQ berada di memori proses. Template reverse proxy ada, tetapi CSP dan status header aktif di staging belum dibuktikan. Ini temuan kode/template, bukan bukti eksploitasi atau keadaan live.
- [x] ✅ **Lokal — arsip audit bulanan P0-03:** audit RBAC tidak lagi dipangkas pada 500 entri dan disalin append-only ke arsip JSONL bulanan dengan ekspor berizin. Audit Customer Portal kini ditulis per bulan; entri legacy disalin ke arsip tanpa mengubah file lama. Tidak ada penghapusan otomatis. Verifikasi penuh: 40 file / 506 tes, lint, build dan `git diff --check` lulus. Belum di-deploy atau diuji di staging; audit bisnis klien dan atribusi aktor tetap terbuka.
- [x] ✅ **Audit dependensi runtime lokal:** `npm audit --omit=dev` menghasilkan 4 temuan *high* dan 0 *critical*, terkait dua advisory gRPC pada pohon Firebase. `npm ls` menunjukkan `@grpc/grpc-js@1.9.16` pada rantai `firebase`/Firestore client dan `@grpc/grpc-js@1.14.7` pada rantai Firebase Admin. Dampak terhadap proses produksi belum dipastikan; `npm audit fix --force` tidak dijalankan.
- [x] ✅ **Pengukuran bundle dan dialog lokal:** aset build yang diperiksa: Firestore 408 KiB (118 KiB gzip), React 395 KiB (119 KiB), jsPDF 390 KiB (126 KiB), seed ERP 315 KiB (88 KiB). Pemindaian sumber menemukan 10 panggilan `alert`/`confirm` browser di 8 file. Ini ukuran/kiraan statis lokal, bukan metrik unduhan atau kinerja staging.
- [x] ✅ **Review statis login Google lokal:** inisialisasi Firebase customer memakai `initializeAuth` dengan `inMemoryPersistence`, tanpa resolver popup, sedangkan UI memanggil `signInWithPopup`. Login Google belum boleh dinyatakan siap; perlu konfigurasi resolver dan uji browser. Staging belum diperiksa ulang.
- [x] ✅ **Lokal — konfigurasi resolver popup Google:** 24 November 2026. Firebase Customer Portal memakai `browserPopupRedirectResolver` bersama persistensi memori; tes mock memeriksa konfigurasi dan pesan popup diblokir/dibatalkan. `npm test` lulus 41 file / 508 tes, `npm run lint`, `npm run build`, dan `git diff --check` lulus pada Windows lokal. Firebase nyata, browser, domain staging dan deployment belum diuji; P1-10 tetap terbuka.
- [x] ✅ **Lokal — perlindungan state dan media hilang/sementara:** 24 November 2026. Jika state/indeks hilang tetapi file `.tmp` ada, startup menolak membuat file kosong; indeks media juga tidak dibuat jika direktori unggahan berisi file. State tidak menimpa `.tmp` yang ada. Media tanpa metadata indeks tidak ditebak sebagai publik dan akses, unggah dengan ID sama, serta penghapusan ditahan. Kegagalan migrasi media pada sync dilaporkan; pada hydrate, error menjelaskan bahwa sebagian state mungkin telah dipulihkan. Tes store dan HTTP terisolasi lulus; regresi Windows lokal 41 file / 515 tes, TypeScript, build dan `git diff --check` lulus. Belum di-deploy atau diuji terhadap data historis/staging.

- [x] ✅ **Pra-rilis tema biru — lokal Windows, 24 November 2026:** regresi `npm test -- --mode staging` lulus 42 file / 523 tes dan `npm run build:staging` lulus, melengkapi TypeScript serta verifikasi visual lokal sebelumnya. Pengguna menyetujui penyertaan catatan backup/deploy terdahulu dalam commit. Ini bukan bukti deployment Linux.
- [x] ✅ **Deploy tema biru `ce6174e` — Linux staging, 24 November 2026:** setelah pengguna membuka SSH agent, deployment dijalankan operator melalui satu perintah sudo karena akses sudo noninteraktif ditolak. Script memverifikasi target `origin/main`, mempertahankan perubahan `public/website-published.json` tanpa stash dan memeriksa kesamaan SHA-256, lalu lint, tes staging dan build mencapai `RELEASE_READY`. Hanya service `ams` direstart; output akhir `DEPLOY_OK`. Verifikasi ulang melalui SSH menunjukkan service `active`; health lokal/publik menunjukkan `staging`, Firebase connected/ready dan database `(default)`. Rute `/`, `/web`, `/akun` HTTP 200; CSS publik memuat token utama `#2a6199`, dan browser staging membuktikan brand `#2a6199` serta sekunder `#245382`. Script sementara dihapus setelah selesai. Ini bukan uji browser ERP/portal terautentikasi, seluruh halaman, restore lengkap atau persetujuan produksi.

- [x] ✅ **Lokal Windows — form edit Customer Database:** detail identitas, alamat, kredit/TOP dan kontak pelanggan existing diperluas; data lain dan properti alamat tambahan dipertahankan. TypeScript, build dan 7 tes terarah lulus; preview browser memakai pelanggan sintetis dan store tiruan untuk menguji tab, simpan, validasi, konflik lokal dan akses baca saja. Ini bukan konfirmasi penyimpanan server, uji ERP terautentikasi atau staging; perubahan belum di-commit atau di-deploy.
- [x] ✅ **Deploy form edit Customer Database — Linux staging, 25 November 2026:** operator menjalankan rilis dan melaporkan akhir build serta service `ams` aktif. Checkout melaporkan `7711426` pada `main`; health lokal dan publik merespons `aktif`, `staging`, Firebase terhubung dan siap. Snapshot website tetap tercatat sebagai perubahan lokal; isi dan hash pascadeploy tidak diperiksa dalam output yang diterima. Form belum diuji melalui ERP terautentikasi di staging; tambah pelanggan, draf server dan impor Excel tetap belum tersedia.
- [x] ✅ **Rintisan skema shadow PostgreSQL customer — lokal Windows, 25 November 2026:** pengguna memilih customer sebagai domain pertama. Skema eksperimental menyimpan record sumber lengkap sebagai JSONB, ID/kode/nama, versi sumber dan waktu impor; fungsi batch membatasi 10.000 record dan menolak data konflik tanpa menimpa. Uji PGlite sintetis membuktikan pelestarian field tambahan, penolakan identitas tidak sah/duplikat, pengulangan batch identik tanpa duplikasi dan rollback batch konflik. TypeScript, build dan 12 tes terarah pada 2 file lulus. PGlite hanya dependensi pengujian; PostgreSQL server, integrasi aplikasi dan data staging belum disentuh.
- [x] ✅ **Pemeriksaan awal PostgreSQL — Linux staging, 25 November 2026:** pemeriksaan SSH baca-saja menunjukkan `psql` dan `pg_lsclusters` tidak ditemukan pada PATH, paket metapackage `postgresql` belum terpasang, unit `postgresql` tidak aktif, dan tidak ada listener TCP port 5432 saat pemeriksaan. Kandidat paket Ubuntu yang terdaftar adalah PostgreSQL 16; ini tidak membuktikan tidak ada instance lain pada port atau container lain. Tidak ada paket atau konfigurasi VPS yang diubah.
- [x] ✅ **PostgreSQL 16 — Linux staging, 25 November 2026:** setelah persetujuan pengguna dan simulasi apt tanpa upgrade paket, operator memasang PostgreSQL 16. Output operator menunjukkan cluster `16/main` online pada port 5432, `listen_addresses=localhost`, dan listener TCP `127.0.0.1:5432`. Saat pemeriksaan ini belum ada database customer, akun aplikasi, skema, impor data, integrasi AMS, pengujian restore PostgreSQL atau cutover.
- [x] ✅ **Skema shadow customer — PostgreSQL 16 Linux staging, 25 November 2026:** operator membuat database kosong `ams_customer_shadow_staging`, mencabut seluruh izin database dari `PUBLIC`, lalu memasang skema terisolasi setelah hash berkas cocok dengan salinan lokal. Uji operator memakai satu record sintetis dalam transaksi: impor pertama 1, retry identik 0, dan setelah rollback jumlah record 0. Berkas SQL sementara di VPS dihapus. Belum ada data customer aktual, role aplikasi, integrasi, uji konflik/konkurensi PostgreSQL server, backup/restore PostgreSQL atau cutover.
- [x] ✅ **Latihan backup/restore PostgreSQL kosong — Linux staging, 25 November 2026:** operator membuat dump custom terenkripsi GPG AES256 dari database shadow kosong, melaporkan SHA-256 arsip, lalu mendekripsi dan me-restore ke database latihan terpisah yang akses `PUBLIC`-nya dicabut. Restore mencapai `RESTORE_LATIHAN_OK` dan tabel customer berjumlah 0. Arsip dan database latihan tetap disimpan; salinan di luar VPS, restore berisi data nyata, dan pemulihan menyeluruh AMS/Firebase belum dibuktikan.
- [x] ✅ **Pemeriksaan sumber dan baseline kosong customer — 25 November 2026:** operator memeriksa metadata state server Linux staging dan melaporkan `sales_pelanggan` tidak ada. Pengguna memilih memulai PostgreSQL kosong; tidak ada cache, seed, workbook atau data terkait yang dihapus. Migrasi eksperimental penanda baseline kosong diuji secara terisolasi di PGlite: actor wajib, retry tidak mengganti actor, dan tabel berisi data ditolak; lint dan 13 tes terarah lulus. Penanda belum dipasang di VPS dan tidak membuktikan browser, Firebase atau modul lain kosong.
- [x] ✅ **Pemeriksaan satu browser ERP staging — 25 November 2026:** setelah pengguna masuk dan membagikan sesi, pemeriksaan baca-saja menunjukkan cache lokal `sales_pelanggan` belum ada dan tidak ada kunci tersebut dalam antrean sinkronisasi browser itu. Ini tidak membuktikan kondisi browser lain, Firebase, data seed yang dapat dimuat saat modul dibuka, atau seluruh referensi transaksi. Tidak ada perubahan data melalui pemeriksaan ini.
- [x] ✅ **Prototipe sync PostgreSQL — lokal dan Linux staging, 25 November 2026:** skema terisolasi menyimpan nilai koleksi, versi, tombstone dan revisi batch; uji PGlite sintetis meliputi JSON null, penolakan versi stale, rollback batch, tombstone dan batas integer. TypeScript dan 18 tes terarah pada 3 file lulus. Pada PostgreSQL 16 staging, operator memasang skema shadow dengan hash SQL terverifikasi; satu batch tulis/hapus mencapai revisi 1/2, versi lama ditolak, dan rollback menyisakan 0 entri. Salinan SQL sementara dihapus. Belum terhubung ke AMS, diuji dengan klien offline bersamaan, diuji restore setelah penambahan skema, atau diisi data aktual.
- [x] ✅ **Prototipe impor snapshot sync — lokal Windows, 25 November 2026:** migrasi eksperimental memeriksa bentuk state, mempertahankan nilai, versi koleksi, tombstone dan revisi, serta mengimpor secara atomik ke shadow kosong; pengulangan snapshot yang sama diizinkan hanya sebelum target berubah. Uji sintetis PGlite mencakup rollback saat versi bertentangan, penolakan replay setelah mutasi, target berisi data dan state hilang; TypeScript dan 22 tes terarah pada 3 file lulus. Penjagaan state hilang pada skema sync juga baru lokal; skema staging yang dipasang sebelumnya belum memilikinya. Impor belum diuji pada PostgreSQL server, belum terhubung ke AMS dan belum menggunakan data aktual; inventaris RBAC/portal/media/Firebase dan persiapan backup lengkap tetap diperlukan.
- [x] ✅ **Inventaris metadata state — Linux staging, pemeriksaan sesi ini:** operator membaca `/var/lib/ams-data/app-state.json` sebagai akun aplikasi tanpa mengeluarkan isi data. Hasil agregat: revisi 252, 6 koleksi, 0 tombstone, 0 key RBAC legacy, 0 versi berbeda dan 0 entri tidak didukung menurut pemeriksaan awal; file RBAC dan portal ditemukan, file state sementara tidak ditemukan. Pemeriksaan tidak menghitung key versi yang hilang dari peta. Ini hanya snapshot saat pemeriksaan, bukan verifikasi seluruh format/importer, data Firebase, referensi, browser, antrean offline, isi file RBAC/portal atau backup. Tidak ada data yang diubah.
- [x] ✅ **Prototipe reset sync PostgreSQL — lokal Windows:** reset atomik memeriksa revisi, menaikkan versi koleksi menjadi tombstone dan menolak overflow; tes mencakup konflik revisi, penolakan versi lama serta reset kosong. TypeScript dan 24 tes terarah pada 3 file lulus. Fungsi reset dan perubahan penjagaan state belum dipasang di PostgreSQL staging dan belum terhubung ke AMS.
- [x] ✅ **Uji sintetis impor dan reset sync — PostgreSQL 16 Linux staging, pemeriksaan sesi ini:** checksum kedua SQL cocok; operator menjalankannya pada skema uji terpisah di dalam transaksi database shadow. Impor, replay identik, konflik tombstone dan reset menghasilkan `SYNTHETIC_TEST_OK`; `ROLLBACK` dan pemeriksaan membuktikan skema uji tidak tersisa. Dua berkas SQL sementara dihapus. Versi impor yang diuji memiliki SHA-256 `a9a1ace74bb39259d0c9252617cc2e8fecbae3c56eb3cf23239f68d06c9facf8`; validasi versi key yang ditambahkan setelah itu baru diuji lokal (TypeScript dan 25 tes terarah lulus). Ini bukan instalasi migrasi, pengujian konkurensi atau uji dengan data aktual, dan AMS belum memakai PostgreSQL.
- [x] ✅ **Validasi pra-push prototipe PostgreSQL — Windows lokal, 25 November 2026:** `npm run lint`, `npm test -- --mode staging` (44 file / 544 tes) dan `npm run build:staging` lulus. Ini bukan uji deployment Linux, integrasi aplikasi ke PostgreSQL, migrasi data aktual atau cutover.
- [x] ✅ **Persiapan deployment — Linux staging, 25 November 2026:** pemeriksaan SSH baca-saja menunjukkan service `ams` aktif dan health lokal merespons pada port 3000; health publik melaporkan `staging`, driver Firebase dan Firebase terhubung. Akses checkout serta service melalui `sudo -n` ditolak, sehingga deployment standar memerlukan tindakan operator; kondisi checkout tidak dapat diperiksa ulang secara noninteraktif. Belum ada deployment, instalasi skema, migrasi data atau cutover pada pemeriksaan ini.
- [x] ✅ **Pemeriksaan checkout operator — Linux staging, 25 November 2026:** operator melaporkan checkout `/opt/ams/app` pada `main` commit `7711426`, dengan satu perubahan lokal `public/website-published.json`; service berjalan sebagai user `ams`. Perubahan lokal harus dipertahankan dan script deployment standar akan menolak checkout tidak bersih. Tidak ada perubahan pada VPS.
- [x] ✅ **Pengarsipan infrastruktur lama — Windows lokal, 25 November 2026:** materi historis dipisahkan dari panduan dan template aktif; modul IT menampilkan arahan Linux dan endpoint panduan lama merespons 410. Pemeriksaan render sintetis serta HTTP berizin, lint, build staging, `deploy:check`, dan regresi 45 file / 546 tes lulus. Ini belum di-deploy atau diuji melalui browser staging; konfigurasi dan data VPS tidak diubah.
- [x] ✅ **Deployment pengarsipan `32aee94` — Linux staging, 25 November 2026:** operator menjalankan deployment terverifikasi yang mencapai `RELEASE_READY` dan `DEPLOY_OK`; hanya service `ams` direstart dan hash snapshot website tetap sama. Pemeriksaan independen menunjukkan service `active`, health lokal/publik `staging`, Firebase terhubung, dan rute `/` serta `/akun` HTTP 200. Browser ERP yang dibagikan sempat memuat aset lama setelah deployment; setelah memuat ulang melalui pesan pemulihan, tab IT menampilkan panduan Linux. Jumlah tes VPS tidak terlihat pada output yang dibagikan; login baru, seluruh modul, antrean offline dan restore penuh belum diuji. PostgreSQL belum menjadi database aplikasi.
- [x] ✅ **Penyelarasan dokumentasi — lokal, 25 November 2026:** README dan 23 dokumen Markdown di `docs/` diberi pembaruan atau penanda status dengan acuan kode, konfigurasi dan bukti staging yang sudah tercatat; arsitektur aktif, batas PostgreSQL shadow, Customer Portal dan dokumen historis dibedakan. Pemeriksaan 46 tautan lokal baru dan `git diff --check` lulus. Tidak setiap klaim historis divalidasi ulang; ini bukan uji fitur, restore, integrasi eksternal atau deployment baru.
- [x] ✅ **README terperinci — lokal, 25 November 2026:** uraian modul dan susunan README sebelumnya dipulihkan serta diperbarui berdasarkan menu, konfigurasi dan status implementasi terkini. Sembilan tautan lokal README dan `git diff --check` lulus. Ini perubahan dokumentasi, bukan uji fitur atau deployment.
- [ ] **Identitas tanpa Firebase:** pengguna menyatakan administrator dapat menyiapkan Google OAuth dan SMTP untuk staging, dan memilih reset kata sandi customer melalui alur aman setelah identitas diverifikasi jika kata sandi Firebase tidak dapat dipindahkan secara aman. Penyediaan OAuth/SMTP, desain/verifikasi reset, migrasi identitas, pengujian login dan cutover belum dilakukan; jangan menonaktifkan Firebase sebelum pengganti terbukti.
- [ ] **Backup lengkap sebelum migrasi/cutover:** pengguna memilih komputer Windows administrator sebagai lokasi salinan terenkripsi di luar VPS. Backup konsisten seluruh sumber aktual (termasuk state, RBAC, portal, media, audit dan Firebase), salinan offsite, uji restore serta rekonsiliasi belum dibuktikan. Backup PostgreSQL shadow kosong sebelumnya tidak memenuhi persyaratan ini.

**Belum selesai atau ditunda:**

- [ ] **Master Data Pelanggan:** pembuatan pelanggan sebagai draf terpisah, impor `.xls`/`.xlsx`, penyimpanan draf server berizin, peninjauan konflik dan penyelesaian draf belum diimplementasikan atau diuji. Tidak ada data workbook aktual yang diimpor atau customer existing yang dihapus/ditimpa; backup dan restore lengkap tetap diperlukan sebelum impor nyata.
- [ ] **Migrasi customer ke PostgreSQL:** lanjutkan uji PostgreSQL server staging terisolasi, migration runner, akses aplikasi/RBAC dan audit, pembacaan sumber yang konsisten, backfill idempoten data aktual, pelaporan konflik serta rekonsiliasi record dan referensi. Uji beban, backup/restore dan rollback sebelum persetujuan cutover; belum ada perubahan sumber kanonis atau impor data aktual.
- [ ] **Cutover customer dengan baseline kosong:** inventaris dan rekonsiliasi cache/antrean browser, Firebase, data contoh serta referensi Sales/Portal terlebih dahulu. Keputusan baseline kosong tidak membuktikan data lain kosong dan tidak mengizinkan penghapusan data terkait; pengguna sebelumnya meminta customer yang masih terhubung dipertahankan. Penanda lokal belum diterapkan dan integrasi AMS belum tersedia.
- [ ] **Migrasi seluruh AMS ke VPS PostgreSQL:** pengguna memilih mempertahankan data existing dan antrean offline, melepas ketergantungan login Firebase, mempertahankan login Google melalui integrasi non-Firebase, dan menyimpan file terlindungi di disk VPS dengan metadata di PostgreSQL. Prototipe sync belum menggantikan store aplikasi. Inventaris serta migrasi state, RBAC, identitas, Customer Portal, media, audit, Firebase dan antrean seluruh perangkat masih diperlukan; siapkan konsistensi transaksi, kompatibilitas klien, uji akses dan konflik, backup terenkripsi di luar VPS, restore lengkap, serta rollback tanpa kehilangan transaksi sebelum cutover. Jangan mematikan Firebase atau menghapus data lama sebelum rekonsiliasi dan penerimaan hasil.
- [ ] **P0-01:** verifikasi data historis pada target, pemulihan media/backup dan kegagalan lain yang masih tercantum di riwayat. Hilangnya seluruh file tanpa sisa `.tmp` atau unggahan tidak dapat dibedakan dari instalasi baru; penulisan indeks media dengan file sementara yang sudah ada dan pemulihan pascapemadaman masih memerlukan penanganan.
- [ ] **P0-02:** seluruh jalur tulis sync termasuk purge/reset kini memiliki precondition dan tes lokal lulus. Belum diverifikasi melalui UI dua editor/lintas tab atau staging; lakukan uji tersebut setelah jadwal dan persetujuan tersedia. Jangan menandai P0-02 selesai atau menganggap rilis live terlindungi sebelum verifikasi target.
- [ ] **P0-03:** retensi arsip server ditangani lokal, tetapi audit bisnis masih dicatat di klien, dipangkas menjadi 100 entri, dan beberapa aktor/peran memakai label tetap. Belum ada bukti staging; atribusi server-side dan jalur ekspor/rekonsiliasi Customer Portal masih terbuka.
- [ ] **P0-04–05:** backup/restore lengkap serta seluruh jalur hak akses dan Firebase masih memerlukan bukti.
- [ ] **P1-01–10:** dependensi, headers live, rate limit terdistribusi, rules, migrasi, privasi, operasional, pengujian modul/performa serta resolver popup Google; lihat daftar temuan.
- [ ] **Website:** pengujian seluruh seksi dan peran, Firebase nyata, performa jaringan serta perubahan lokal pada Linux staging.
- [ ] **Restore lengkap dan login dari backup:** belum dilakukan; wajib sebelum keputusan GO dan sebelum pembersihan seed atau cutover database. Bukti hash/ekstraksi parsial bukan bukti restore lengkap.
- [ ] **Produksi dan API pemerintah:** produksi tetap NO-GO; integrasi pemerintah ditunda sesuai keputusan dan persetujuan yang masih diperlukan.
- [ ] **Customer Portal Tahap 4–6 dan aktivasi nyata:** penawaran berversi, pemulihan akun, konversi Sales Order, invoice/pembayaran, Firebase nyata, rules terpasang dan validasi staging masih terbuka. Pengajuan permintaan penawaran, UI staf dan resolver popup termasuk dalam `d4b089e` yang telah di-deploy, tetapi alurnya belum diuji di browser staging. Registrasi masih menunggu URL kebijakan. Regresi lokal terbaru lulus 41 file/515 tes, TypeScript dan build, tetapi tidak menutup fitur yang belum dibangun atau validasi staging. Progres di [customer-portal.md](./customer-portal.md). Jangan aktifkan provider Email/Password atau anggap login Google teruji sebelum verifikasi provider dan flow nyata. P0-02 harus ditutup sebelum konversi Sales Order dipakai pengguna nyata.

## 1. Lingkup dan kesimpulan awal

API pihak pemerintah tidak langsung dihubungkan pada fase produksi awal. Integrasi dilakukan setelah integrasi internal optimal. Penundaan API pemerintah **bukan alasan NO-GO** pada evaluasi ini, tetapi tidak menghapus kewajiban operasional dan pelaporan yang berlaku.

Alasan NO-GO adalah risiko integritas data dan jejak audit yang ditemukan pada kode, hasil audit dependensi, serta belum adanya bukti yang memadai untuk backup/restore, migrasi, pengujian lintas modul, keamanan dan persetujuan operasional. Optimistic concurrency untuk jalur tulis umum dan administratif telah diuji lokal dan di-deploy dalam `d4b089e`, tetapi perilakunya belum diuji di staging; review statis dan tes lokal tidak membuktikan kondisi live. Keputusan produksi harus ditinjau kembali berdasarkan bukti terbaru oleh manajemen, PJT, QA dan penanggung jawab teknis.

Tidak ada perubahan kode, konfigurasi atau data VPS selama audit awal.

## 2. Bukti pemeriksaan awal

### Pemeriksaan kandidat rilis di komputer lokal

| Pemeriksaan | Hasil pada 23 November 2026 | Batas bukti |
|---|---|---|
| Tes otomatis | Lulus: 28 file, 310 tes | Bukan uji operasional menyeluruh di VPS |
| `npm run lint` | Lulus; menjalankan `tsc --noEmit` | Lokal |
| `npm run cek:semua` | Lulus: pemeriksaan data gudang, jalur FEFO, 39 pemeriksaan gudang dan e-report | Menguji aturan dalam kode, bukan kepatuhan operasional |
| `npm audit --omit=dev` | 4 temuan high; exit code 1 | Keterpaparan aktual AMS masih perlu dianalisis |

Pengujian lokal memakai Node.js `26.13.1` dan npm `11.20.0`; VPS menggunakan Node.js `24.22.3` dan npm `11.19.1`. Tes lokal tidak menggantikan pengujian ulang di VPS.

### Bukti staging dari pengguna dan pemeriksaan publik

| Pemeriksaan | Hasil yang tersedia | Batas bukti |
|---|---|---|
| Build staging di VPS | Berhasil menurut output pengguna | Ada peringatan `NODE_ENV` dan chunk besar; tidak menghentikan build |
| Service | `ams` **active** dan **enabled** pada pemeriksaan pengguna | Bukan bukti monitoring berkelanjutan |
| HTTPS dan health | HTTPS `/api/health` merespons HTTP 200 | Tidak menjamin seluruh alur bisnis berfungsi |
| Firebase | Health menunjukkan mode staging, driver Firebase, project staging yang diharapkan, Admin initialized dan connected, serta konfigurasi siap | Tidak membuktikan setiap transaksi tersimpan dan dapat dipulihkan |
| Login dan setup | Pengguna mengonfirmasi login berhasil; `needsSetup: false` | Hak seluruh peran belum diuji |
| Endpoint sync tanpa login | HTTP 401 | Belum membuktikan sinkronisasi transaksi dua pengguna |
| WebSocket | Koneksi HTTPS menerima `sync:hello` sebagai koneksi anonim | Bukan uji sinkronisasi terautentikasi end-to-end |
| Internal Document | Pengguna mengonfirmasi empat form Pengadaan tampil | Pengisian, submit, persetujuan, ekspor PDF dan persistensi PO Umum belum diuji menyeluruh |
| HTTP dan security headers | HTTP redirect ke HTTPS; respons publik halaman HTTPS yang diperiksa tidak menampilkan HSTS, CSP, `X-Content-Type-Options`, `X-Frame-Options` atau `Referrer-Policy` | Hanya respons dan waktu pemeriksaan tersebut; kebijakan proxy lain belum diaudit menyeluruh |

Staging bukan cutover produksi. Data dan akun produksi lama belum dibuktikan telah dimigrasikan.

## 3. Temuan dan tindak lanjut

Temuan baseline mengacu pada commit `5780a4f`. Review statis terbaru dilakukan pada worktree lokal berbasis `ca6e2b0` yang berisi perubahan belum di-commit. Tautan source menunjuk path repository, bukan snapshot yang dibuktikan live; verifikasi ulang commit sebelum memakai kesimpulan sebagai bukti rilis.

### P0 — harus ditangani sebelum produksi

| ID | Temuan awal | Status | Kriteria penyelesaian |
|---|---|---|---|
| P0-01 | **File rusak atau hilang berisiko menghasilkan state kosong atau metadata yang salah.** Pada baseline, loader memakai fallback baru saat file tidak terbaca/tidak valid dan media tanpa indeks ditebak sebagai publik. Ini temuan kode, bukan bukti kerusakan VPS. Lihat [dataSyncStore.ts](../server/dataSyncStore.ts), [rbacStore.ts](../server/rbacStore.ts) dan [mediaStore.ts](../server/mediaStore.ts). | **Parsial:** loader dan perlindungan media diuji sintetis lokal dan termasuk dalam deployment `d4b089e`; service staging mulai dan health lulus, tetapi perilaku kasus file rusak/hilang di staging dan kompatibilitas seluruh data historis belum diuji. Hilangnya semua jejak, file sementara indeks yang sudah ada, pemadaman saat operasi media dan restore menyeluruh tetap terbuka. | Verifikasi kompatibilitas salinan data historis, tangani file sementara dan pemulihan pascapemadaman secara aman, lalu uji restore terisolasi dan staging dengan persetujuan. |
| P0-02 | **Perubahan bersamaan berisiko tertimpa.** Jalur tulis umum mewajibkan versi dasar: PUT/DELETE memakai `If-Match`; batch memeriksa semua versi atomik; versi hapus dipertahankan sebagai tombstone. `/api/sync/purge-dummy` kini mewajibkan expected version untuk setiap key yang disentuh dan menerapkan batch hanya setelah seluruh versi cocok; `/api/sync/reset` membandingkan expected global revision sebelum mengosongkan state. Versi basi ditolak `409`, precondition hilang `428`, dan versi tidak valid ditolak `400`. Klien mempertahankan draf/antrean konflik tanpa retry otomatis; purge/restore memulihkan cache pada penolakan atau respons tak pasti, sedangkan reset memerlukan sesi server dan konfirmasi revisi sebelum menghapus cache lokal. Implementasi ada pada [pocketbase.ts](../src/services/pocketbase.ts), [dataSyncStore.ts](../server/dataSyncStore.ts) dan [server.ts](../server.ts). | **Parsial:** implementasi dan skenario otomatis diuji lokal; `d4b089e` telah di-deploy ke staging dan health lulus. UI dua editor/lintas tab, perilaku konflik di staging dan penerimaan operasional belum diverifikasi. | Uji melalui UI dua pengguna/tab serta staging yang disetujui: perubahan sama, purge/reset bersamaan, batch/delete, publish dan offline/reconnect; buktikan pemulihan draf dan rekonsiliasi sebelum menutup P0-02. |
| P0-03 | **Kelengkapan dan atribusi audit belum memadai.** Audit bisnis pada `audit_trail` masih disimpan dari klien, hanya mempertahankan 100 entri terakhir, dan sejumlah pemanggil memasok label pelaku/peran tetap; ini bukan bukti audit otoritatif. Lihat [pocketbase.ts](../src/services/pocketbase.ts). | **Parsial:** retensi dan arsip bulanan RBAC serta Customer Portal diuji lokal dan termasuk deployment `d4b089e`; fungsinya belum diuji di staging. Kebijakan sementara: simpan seluruh event, arsip bulanan, tanpa penghapusan otomatis. Audit bisnis klien, aktor statis, ekspor portal dan rekonsiliasi tetap terbuka. | Pindahkan event bisnis kritis ke audit server append-only dengan actor dari sesi terverifikasi; tetapkan integritas/akses dan ekspor untuk portal, uji pemulihan/rekonsiliasi, lalu verifikasi pada staging yang disetujui. |
| P0-04 | **Backup dan restore belum terbukti.** Data tersebar pada state server, RBAC/sesi, media, konfigurasi dan Firebase; satu arsip data server belum tentu mencakup seluruh sumber atau kredensial eksternal. Skrip backup Windows yang ada bukan prosedur restore terisolasi dan tidak mengenkripsi arsipnya sendiri. | Terbuka; ada bukti parsial hash/ekstraksi arsip, bukan boot/login/rekonsiliasi penuh. | Definisikan cakupan dan konsistensi backup, enkripsi serta pengelolaan kunci terpisah; restore pada clone terisolasi dengan Firebase/secret non-produksi. Buktikan startup, login peran uji, media, jumlah/hash record, jurnal seimbang, stok dan audit sebelum menyetujui pembersihan atau cutover. |
| P0-05 | **Data sinkronisasi belum dibatasi berdasarkan hak baca peran.** Pada kandidat `d862ef7`, `GET /api/sync/state` mengembalikan seluruh state kepada pengguna yang terautentikasi, dan broadcast WebSocket mengirim pembaruan lengkap kepada klien terautentikasi tanpa memeriksa hak baca peran. Ini temuan kode, bukan bukti akses atau kebocoran aktual. | Dalam pengerjaan, parsial: perbaikan server telah diuji lokal, tetapi jalur Firebase, cache dan staging masih terbuka. | Tetapkan kebijakan akses per koleksi dan data pribadi; terapkan dan uji pembatasan pada HTTP dan WebSocket, termasuk perubahan peran/sesi serta kebutuhan self-service. |

- [x] ✅ **Backup parsial VPS Linux — 24 November 2026:** operator menghentikan sementara hanya service `ams` dan membuat arsip GPG AES256 berisi direktori data VPS, direktori secret, environment staging, snapshot website dan unit service yang diperiksa. Operator melaporkan service aktif kembali; dekripsi dan pembacaan daftar tar berhasil, dan checksum SHA-256 cocok pada VPS serta pada salinan terenkripsi di komputer Windows. Passphrase tidak dicatat dalam sesi. Bukti hanya untuk sumber yang disalin dan integritas transfer, bukan autentikasi/restore penuh, cakupan semua konfigurasi eksternal, konsistensi lintas Firebase, atau cadangan Firestore/Authentication.
- [ ] **Backup lengkap dan restore terisolasi:** Firestore dan Firebase Authentication belum dicadangkan atau dipulihkan; belum ada VM/project Firebase uji yang terpisah. Periksa sumber konfigurasi dan kredensial eksternal, lindungi salinan dan kunci, lalu buktikan startup, login, media dan rekonsiliasi di lingkungan terisolasi tanpa menghubungkan clone ke Firebase aktif. Pengguna menunda restore lengkap dan kemudian menyetujui deploy `1a6bda7` di staging dengan risiko tersebut.

Jangan melakukan purge, reset, migrasi atau cutover data tanpa backup yang tervalidasi, rencana pemulihan dan persetujuan yang diperlukan.

### P1 — harus ditutup atau diterima secara tertulis sebelum go-live

| ID | Temuan awal | Status | Kriteria penyelesaian |
|---|---|---|---|
| P1-01 | **Dependensi runtime:** audit terbaru (`npm audit --omit=dev`) melaporkan 4 temuan high, 0 critical, berkelompok pada dua advisory gRPC: [GHSA-m9gg-hp2v-232j](https://github.com/advisories/GHSA-m9gg-hp2v-232j) dan [GHSA-f596-whhp-79r4](https://github.com/advisories/GHSA-f596-whhp-79r4). Pohon lokal menunjukkan `@grpc/grpc-js@1.9.16` pada rantai Firebase client/Firestore dan `1.14.7` pada rantai Firebase Admin; belum dibuktikan paket mana yang termuat pada proses Node target. | Audit lockfile lokal terkonfirmasi; keterpaparan target belum dianalisis. | Petakan rantai runtime per proses dan jangkauan kode, naikkan versi yang kompatibel, jalankan tes/auth/sync serta audit ulang, atau catat penerimaan risiko tertulis. Jangan gunakan `npm audit fix --force`: laporan npm mengusulkan downgrade breaking ke Firebase 9.14.0. |
| P1-02 | **Security headers:** Express tidak memasang kebijakan header global; `nosniff` ditemukan pada respons media tertentu. Template Caddy memuat HSTS, `nosniff`, `SAMEORIGIN` dan referrer policy, tetapi tidak CSP. Contoh CSP Nginx dokumentasi mengizinkan `https:`, `unsafe-inline` dan `unsafe-eval`, sehingga bukan kebijakan final yang ketat. Template bukan bukti konfigurasi VPS aktif. | Belum diverifikasi ulang pada staging. Header proxy parsial tersedia; CSP yang sesuai aplikasi belum dirancang/diuji. | Terapkan satu kebijakan konsisten di reverse proxy atau Express. Uji semua respons HTTPS. Mulai CSP Report-Only, ukur pelanggaran Firebase/Auth/Firestore/WebSocket/media, lalu tegakkan bertahap. Jangan aktifkan HSTS `includeSubDomains`/`preload` sebelum seluruh subdomain siap HTTPS. |
| P1-03 | **Perlindungan akses dan rate limit:** limit login, registrasi, username dan RFQ ada, tetapi penghitung aplikasi memakai memori proses. Limit dapat reset saat restart dan tidak dibagi antar-worker. Konfigurasi proxy/IP tepercaya, perilaku lintas situs dan seluruh matriks peran di VPS belum terbukti. | Implementasi limiter lokal ada; ketahanan terdistribusi dan target belum diuji. | Verifikasi sumber IP di balik proxy; pertahankan batas per-akun dan terapkan limit lintas proses pada endpoint publik sensitif bila deployment multi-worker; uji reset, bypass, penyalahgunaan dan pengguna sah dari satu IP bersama. |
| P1-04 | **Rules dan admin Firebase:** rules staging pernah disesuaikan manual; [firestore.rules](../firestore.rules) pada kandidat masih memuat bootstrap lama. Pembatasan admin melalui environment tidak otomatis mencabut akun RBAC atau admin Firebase lain. | Terbuka | Verifikasi project target, rules yang benar-benar terpasang, daftar admin, RBAC dan perilaku akses. Jangan menimpa rules tanpa memastikan target. |
| P1-05 | **Data contoh:** manifest/provenance dan purge selektif tersedia di klien; kode membangun ulang rantai jurnal/pergerakan dan menyesuaikan kapasitas bin. Endpoint purge kini memeriksa expected versions seluruh key secara atomik, tetapi hal ini tidak membuktikan klasifikasi seed pada target atau rekonsiliasi saldo yang benar. | Terbuka; belum ada dry-run dan bukti rekonsiliasi data target. | Inventaris seed vs data nyata per koleksi, laporkan perubahan yang akan dilakukan, minta persetujuan pemilik data, backup/restore tervalidasi, lalu purge terkontrol. Cocokkan trial balance debit/kredit, saldo stok dengan ledger pergerakan, dan nilai persediaan sebelum/sesudah; jangan hapus transaksi tak dikenal otomatis. |
| P1-06 | **Migrasi, rekonsiliasi dan cutover** data asli belum diuji dan ditandatangani. State utama saat ini berupa file JSON berisi nilai koleksi, sedangkan mode driver yang dikenal adalah Firebase/PocketBase; PostgreSQL belum menjadi backend aplikasi. Perubahan skema dapat mengubah cara stok, jurnal, dokumen, audit, RBAC dan sync berinteraksi. | Terbuka; belum ada skema target, migrasi, atau keputusan PostgreSQL vs Firestore per dokumen. | Pulihkan backup di lingkungan terisolasi lebih dulu. Pilih satu sumber data kanonis; migrasikan satu domain vertikal, jalankan backfill idempoten dan pembandingan shadow, rekonsiliasi, uji rollback dan beban, baru cutover bertahap. Detail keputusan ada pada bagian 3A. |
| P1-07 | **Monitoring, rollback dan operasional** belum terbukti end-to-end. | Terbuka | Uji uptime/error alert, retensi log, latihan rollback/restore, penanggung jawab insiden, pelatihan dan hypercare. |
| P1-08 | **Privasi dan persetujuan** belum dibuktikan. | Terbuka | Inventaris data pribadi, dasar pemrosesan, hak subjek data, retensi, kebijakan privasi dan persetujuan PJT/QA sesuai kebutuhan organisasi. |
| P1-09 | **Alur internal dan performa** belum dibuktikan di lingkungan target. Build lokal menunjukkan chunk besar dan pemindaian menemukan 10 pemanggilan `alert`/`confirm` pada 8 file. Sudah ada primitive `Modal`, tetapi belum menjadi dialog konfirmasi terpadu; aksesibilitas fokus/keyboard perlu ditinjau dan belum ditemukan primitive toast generik. | Terbuka; hanya pengukuran aset dan source lokal. | Lulus smoke test 13 modul dan walkthrough; ukur target. Pecah monolit secara bertahap dengan tes regresi. Ganti alert dengan notifikasi internal dan confirm destruktif dengan dialog asinkron yang aksesibel; uji cancel/confirm serta dampak transaksi. |
| P1-10 | **Login Google Customer Portal belum terbukti bekerja pada target.** Review sebelumnya menemukan `initializeAuth` tanpa resolver popup, padahal UI memakai `signInWithPopup`. Staging memakai commit yang lebih lama menurut laporan deployment dan belum diperiksa ulang. | **Parsial, lokal:** `browserPopupRedirectResolver` ditetapkan pada inisialisasi baru; tes mock konfigurasi dan pesan error lulus. Belum ada uji browser dengan Firebase nyata atau staging. | Uji popup pada domain staging yang authorized; verifikasi email baru/lama, pendaftaran tertutup, username unik dan ERP tetap menolak Gmail non-karyawan. |

### 3A. Penilaian teknis: migrasi transaksi inti

**Perkembangan 25 November 2026:** customer dipilih sebagai domain pertama. Skema shadow eksperimental dan fungsi batch diuji memakai PGlite dengan data sintetis, lalu dipasang di database PostgreSQL 16 staging terisolasi dan diuji dengan record sintetis yang di-rollback. Batch sama pada versi sumber yang sama dapat diulang; data atau versi yang berbeda ditolak, bukan diperbarui otomatis. Normalisasi kode dan collation harus diperiksa pada PostgreSQL target sebelum impor. Belum ada koneksi AMS ke PostgreSQL, runner migrasi, integrasi aplikasi, backfill data aktual, atau cutover. Catatan baseline di bawah tetap berlaku untuk kandidat yang dievaluasi saat itu dan bukan deskripsi seluruh perubahan lokal terbaru.

#### Kondisi saat ini

State sync server berada di `app-state.json`: file memuat map `entries` berdasarkan nama koleksi, dan nilai setiap koleksi dapat berupa array record penuh. Saat ada perubahan, store menyerialisasi state berikutnya ke file sementara lalu me-rename file tersebut. Ini lebih tahan terhadap file setengah tertulis dibanding penulisan langsung, tetapi tetap berarti penyimpanan, pembacaan dan versi konkurensi berskala satu koleksi/key; bukan transaksi relasional per record. Detail implementasi ada di [dataSyncStore.ts](../server/dataSyncStore.ts).

Driver aplikasi yang dinyatakan di kode adalah `firebase` dan `pocketbase`; PocketBase disimpan sebagai konfigurasi arsip. PostgreSQL belum menjadi opsi runtime aplikasi dan belum ada paket/kontrak repository atau skema PostgreSQL. Karena itu migrasi memerlukan desain data, adapter, migrasi skema, pengujian dan prosedur operasi baru—bukan sekadar mengganti URL database. Lihat [dbDriverManager.ts](../server/dbDriverManager.ts) dan [package.json](../package.json).

#### Pilihan penyimpanan

| Pilihan | Cocok untuk | Kelebihan | Risiko/batasan | Penilaian |
|---|---|---|---|---|
| **PostgreSQL relasional** | Mutasi stok, jurnal, faktur dan dokumen yang perlu constraint dan transaksi lintas record | ACID transaction, foreign key, unique constraint, query/reporting relasional, row locking/version checks; cocok untuk posting stok dan jurnal secara atomik | Perlu operasi database, backup/restore, connection management, migration/rollback, pemantauan, skema serta proses sinkronisasi; pemodelan lama harus dipetakan dan direkonsiliasi | **Pilihan utama untuk transaksi stok dan akuntansi**, jika tim siap mengoperasikan PostgreSQL dan menetapkan sumber data kanonis |
| **Firestore satu dokumen per record** | Data yang modelnya sudah berupa dokumen dan perlu tetap dekat dengan Firebase | Perubahan incremental dari stack Firebase, query realtime dan Security Rules yang sudah ada | Bukan pengganti penuh constraint/relasi; transaksi lintas dokumen tetap perlu desain; ukuran, indexing, hot document dan biaya perlu diukur; Security Rules tidak otomatis membuat audit append-only | Pilihan layak bila prioritasnya Firebase dan relasi/transaksi lintas record terbatas. Simpan satu record bisnis per dokumen, bukan satu array koleksi yang terus membesar |

Istilah “subkoleksi per dokumen” perlu diperjelas: subkoleksi bukan otomatis solusi append-only ataupun relasional. Dokumen induk sebaiknya tidak menyimpan array transaksi yang tumbuh tanpa batas. Untuk audit immutable, server harus menjadi satu-satunya writer, menolak update/delete pada event lama, mencatat actor/waktu/aksi/objek, dan melakukan koreksi melalui reversal atau event kompensasi. PostgreSQL pun tidak otomatis append-only tanpa kontrol permission, trigger/prosedur atau desain ledger.

#### Rekomendasi arsitektur

Untuk kebutuhan yang disebut—stok, mutasi, jurnal dan faktur—PostgreSQL paling sesuai sebagai sumber kanonis transaksi karena satu transaksi dapat memvalidasi saldo, mencatat mutasi dan mem-posting jurnal secara atomik. Firebase Authentication dapat tetap dipakai untuk identitas; Firestore dapat tetap melayani kebutuhan non-ledger yang memang cocok sebagai dokumen. Jangan mempertahankan dua sumber tulis aktif tanpa mekanisme konsistensi yang eksplisit.

Model target sebaiknya memisahkan setidaknya:

- **Ledger stok:** dokumen mutasi immutable dengan kunci idempotensi, item/batch/bin, kuantitas masuk/keluar dan referensi sumber; saldo stok saat ini menjadi projection yang dapat dihitung ulang.
- **Ledger akuntansi:** header jurnal dan baris debit/kredit; satu transaksi posting memvalidasi debit = kredit dan periode terbuka. Koreksi memakai jurnal reversal, bukan mengedit posting lama.
- **Faktur/dokumen:** identitas dan status lifecycle terstruktur, nomor unik, versi dokumen, actor/timestamp, serta referensi ke transaksi sumber; file besar disimpan di object/media storage dan database menyimpan metadata.
- **Audit:** event server append-only terpisah dari tabel state mutable, dengan retensi, ekspor dan kontrol akses yang ditetapkan.

Ini adalah rancangan awal untuk diskusi, bukan keputusan skema final. Sebelum implementasi harus ada inventaris read/write setiap modul, pemetaan ID/relasi, kebijakan penghapusan, kebutuhan reporting, retensi, jumlah/ukuran data dan target performa.

#### Tahapan dan kriteria penerimaan

1. **Pulihkan dan ukur lebih dulu:** uji restore terenkripsi di lingkungan terisolasi; inventaris semua key/record, media, Firebase dan referensi; simpan snapshot/hash sumber sebelum migrasi.
2. **Tetapkan invariant bisnis:** Finance menyetujui trial balance, aturan pembulatan/periode, dan rekonsiliasi faktur; Gudang menyetujui stok awal, lot/batch, reservasi dan cara menghitung saldo. Pisahkan seed dengan persetujuan sebelum menjadi baseline migrasi.
3. **Bangun satu vertical slice:** pilih satu domain sempit (misalnya mutasi stok), buat migration versioned, constraint, repository/service dan audit server. Uji transaksi bersamaan, idempotency, rollback, restore, RBAC dan audit.
4. **Backfill idempoten dan shadow-read:** impor dengan checkpoint dan kunci unik; baca dari sumber lama dan baru untuk membandingkan hasil tanpa mengirim transaksi dua kali. Laporkan record hilang/duplikat, total kuantitas dan nilai; jangan menyamarkan selisih.
5. **Cutover satu domain:** jadwalkan write freeze atau mekanisme perubahan berurutan yang disetujui, rekonsiliasi akhir, alihkan satu domain ke satu sumber kanonis, pantau, lalu lanjutkan hanya setelah penerimaan tertulis. Sediakan rollback yang tidak membuang transaksi yang dibuat sesudah cutover.
6. **Perluas bertahap:** setelah slice pertama stabil, migrasikan jurnal, faktur dan dokumen satu per satu; baru kemudian hentikan penulisan lama dan tentukan retensi arsip JSON.

Kriteria minimum: trial balance debit/kredit seimbang; kuantitas dan nilai stok cocok dengan ledger per mutasi serta saldo pembuka; jumlah record dan referensi tidak hilang/duplikat; request retry tidak menggandakan posting; konflik konkurensi terdeteksi; audit actor benar; serta restore/rollback diuji. **Jangan memulai cutover** hanya karena tes unit atau backfill berhasil.

#### POC lokal: impor Excel saldo stok awal

Keputusan lingkup: POC dijalankan **terisolasi di lokal**, hanya untuk membuktikan preview dan commit ke PostgreSQL; tidak mengubah stok pada aplikasi berjalan, tidak melakukan dual-write ke sinkronisasi lama, dan tidak menyentuh VPS/staging. PGlite dipilih sebagai mesin PostgreSQL tertanam untuk pengujian skema dan transaksi secara lokal. Hasilnya bukan bukti kesiapan operasi server PostgreSQL, koneksi jaringan, backup/restore produksi, atau cutover.

Template Excel akan disediakan pengguna. Karena berkas tersebut belum tersedia, nama/alias kolom, format tanggal dan desimal, kunci unik, aturan baris kosong, serta pemetaan SKU, gudang dan bin belum boleh diasumsikan sebagai kontrak final. Model aplikasi yang menjadi titik pemeriksaan saat ini ialah `StokGudang` dan `LokasiBin`; status stok, pelacakan batch/serial serta lokasi harus dipetakan setelah struktur workbook dan sumber master yang sah diperiksa.

Rencana vertical slice:

1. Periksa workbook dan contoh datanya; tetapkan template versi, pemetaan kolom, format nilai dan aturan bisnis bersama pengguna Gudang.
2. Tentukan kunci unik saldo awal dan sumber referensi SKU/gudang/bin; tandai baris yang tidak dapat dicocokkan atau bertentangan sebagai gagal, bukan menebak nilai.
3. Buat migrasi PostgreSQL berversi untuk batch impor, baris staging, saldo per lokasi/batch dan mutasi pembukaan yang dapat diaudit; tentukan batas update/delete untuk ledger.
4. Implementasikan preview tanpa mengubah saldo: tampilkan ringkasan, duplikasi dalam file maupun di database, validasi per baris, serta sebab baris gagal.
5. Commit hanya untuk preview yang valid; jalankan secara atomik dan idempoten, simpan actor, hash sumber, waktu dan nomor baris. Retry tidak boleh menggandakan saldo atau mutasi.
6. Uji workbook valid/tidak valid, nilai kosong dan tidak sah, duplikasi, referensi tidak dikenal, commit berulang, rollback serta konkurensi menggunakan data sintetis di PGlite.
7. Setelah POC diterima, putuskan rancangan integrasi terpisah: migrasi stok aplikasi ke PostgreSQL sebagai satu sumber kanonis, atau hentikan POC. Jangan menghubungkan hasil POC ke koleksi stok lama sebagai dual-write.

Kriteria penerimaan POC: setiap baris memiliki hasil preview yang dapat ditelusuri; tidak ada commit parsial; saldo dan ledger pembukaan cocok; kegagalan dan retry tidak membuat saldo ganda; dan data uji tidak menyentuh data aplikasi/VPS. **Status sekarang: discovery selesai, implementasi tertahan menunggu workbook template pengguna.** PostgreSQL server tidak terpasang/terdeteksi di lingkungan lokal; PGlite belum ditambahkan atau dijalankan. Jadi belum ada impor, skema, atau perubahan data yang dilakukan.

#### Acuan impor master customer dari workbook

- [x] ✅ **Pemeriksaan struktur workbook customer — lokal Windows, 24 November 2026:** `ReportCustomer 261029.xls` dibuka read-only dengan Excel, pembaruan link dan macro dinonaktifkan; tidak ada data yang diimpor. File berformat Excel lama (`.xls`), memiliki sheet `Report`, `Report (2)`, dan `Sheet2`. Pemeriksaan sel menunjukkan masing-masing 3.222, 3.222, dan 1.852 baris terisi; dua sheet pertama memiliki 6 dan 7 kolom terpakai dan tidak menampilkan header yang jelas pada awal data. Kolom pertama pada masing-masing dua sheet pertama tidak memiliki nilai kosong atau duplikat setelah trim dan perbandingan tanpa membedakan huruf besar/kecil. `Report (2)` mengandung 1.483 sel error spreadsheet, termasuk `#N/A`; hasil ini bukan validasi keseluruhan isi atau bukti identitas customer unik.
- **Pemetaan kandidat, belum disetujui:** pada `Report`, kolom 1 tampak seperti kode, kolom 2 nama, kolom 3–4 alamat, kolom 5 wilayah, dan kolom 6 penanggung jawab/area. `Report (2)` memiliki kolom tambahan sebelum alamat yang tampak terkait nama; arti dan sumbernya perlu dikonfirmasi. `Sheet2` berupa daftar satu kolom; hubungan dan perannya belum diketahui. Jangan menganggap kedua sheet pertama sebagai dua daftar customer independen atau menetapkan arti kolom berdasarkan posisi saja.
- [x] ✅ **Preview sheet pertama — lokal Windows, 24 November 2026:** pengguna memilih `Report` sebagai sumber dan menyetujui label kolom tersebut sementara; revisi menyusul. Preview per baris tersimpan di workspace sesi lokal, bukan dalam repositori; 3.222 baris dan enam nilai sumber diperiksa ulang tanpa selisih, kode tidak terpotong dan file preview tidak mengandung formula. Kolom 3, 4, 5 dan 6 kosong masing-masing pada 139, 1.536, 849 dan 650 baris. Angka ini hanya kelengkapan sumber, bukan penilaian layak impor; belum diperiksa terhadap database staging.
- [x] ✅ **Menu Customer Database — kode lokal Windows, 24 November 2026:** menu Sales menampilkan master `sales_pelanggan` dengan kolom acuan workbook serta email dan nomor WhatsApp opsional; pengguna berizin update dapat menyunting alamat dan kontak, sedangkan akses baca tidak diberi tombol ubah. Email kontak terpisah dari email penautan portal. Lint, build dan 47 tes terarah lulus, termasuk render, validasi, persistensi lokal, kegagalan penyimpanan dan deteksi perubahan detail dengan data sintetis/seed.
- [x] ✅ **Interaksi browser Customer Database — lokal Windows, 24 November 2026:** harness terisolasi memakai komponen Sales aktual dan data sintetis dalam store tiruan. Pencarian, penolakan nomor tidak valid, penyuntingan email/WA, konflik perubahan paralel dengan draf tetap tampil, serta tampilan hanya-baca diperiksa di browser. Harness tidak memakai stylesheet aplikasi, login, store sesungguhnya atau server sinkronisasi; ini bukan uji visual lengkap maupun bukti persistensi, RBAC server, koneksi Firebase, atau deployment staging.
- [x] ✅ **Tampilan Master Data Pelanggan — lokal Windows, 24 November 2026:** tabel mengikuti pola Master Data Karyawan dan menampilkan enam kolom: kode, nama/instansi, alamat gabungan, nomor telepon, email, serta afiliasi/keterangan. Field afiliasi opsional ditambahkan ke master tanpa mengubah data lain. Lint, build dan 47 tes terarah lulus; browser memakai komponen dan stylesheet hasil build dengan data sintetis/store tiruan membuktikan tampilan tabel, penyuntingan dan pencarian afiliasi, serta scroll horizontal pada viewport sempit. Font aplikasi tidak disajikan oleh harness; login, server, penyimpanan nyata dan staging tidak diuji. Data Excel tidak diimpor.
- [x] ✅ **Verifikasi pra-push Customer Database — lokal Windows, 24 November 2026:** `npm run lint`, `npm run test` (42 file / 519 tes), dan `npm run build:staging` lulus. Build staging dijalankan secara lokal, bukan bukti deployment atau uji fungsi VPS.
- [x] ✅ **Deploy Customer Database `1a6bda7` — Linux staging, 24 November 2026:** setelah pengguna menerima risiko backup/restore yang belum lengkap, operator memperbarui `main` secara fast-forward, mempertahankan snapshot website melalui stash `3223acd` dan memulihkannya; hash sebelum/sesudah cocok. Perintah lint, tes staging dan build berantai mencapai akhir build. Service `ams` aktif; health lokal serta publik menunjukkan `staging`, project Firebase `ams-integrated-system-2b9e2`, Admin connected dan ready; halaman utama publik HTTP 200. Ini bukan uji browser terautentikasi, persistensi customer, impor Excel, restore lengkap, atau persetujuan produksi.
- [ ] **Impor staging dan penghapusan seed:** pengguna memilih preview lebih dulu dan hanya penghapusan seed yang teridentifikasi serta tidak dirujuk; backup/restore belum tersedia atau diverifikasi. Beberapa ID seed dirujuk oleh data contoh lain di `src/data/initialData.ts`; referensi aktual staging belum diperiksa. Jangan menghapus atau menulis sampai backup/restore terverifikasi, referensi dan data existing ditinjau, serta validasi dan persetujuan impor selesai.
- **Target dan kesenjangan:** master `sales_pelanggan` menggunakan `PelangganB2B` dengan kode, nama, tipe fasyankes, provinsi, rayon, status, serta atribut operasional dan keuangan; sebagian data tersebut tidak terlihat jelas dalam workbook. Model lokal kini memiliki field alamat dan penanggung jawab sales opsional, tetapi pemetaan workbook masih perlu disetujui. Jangan membuang data sumber, menebak nilai wajib, atau mengisi saldo kredit/piutang dengan angka asumsi.
- [ ] Konfirmasi sheet sumber kanonis, header dan arti semua kolom, hubungan `Sheet2`, penanganan formula/error dan aturan duplikasi termasuk tabrakan dengan master existing. Tentukan juga penanganan pelanggan yang bukan fasyankes dan data yang belum lengkap.
- [ ] Rancang impor terisolasi: template berversi, pembacaan `.xls` dan format lain yang disetujui, validasi dan preview per baris, pelaporan error serta data sensitif dengan akses terbatas; buat audit, idempotensi, kontrol konkurensi, rekonsiliasi dan uji rollback. Penulisan ke master berjalan memerlukan keputusan sumber kanonis dan persetujuan tersendiri. **Belum ada parser, impor, migrasi customer, atau perubahan database dari pemeriksaan ini.**

### 3B. Penilaian refactor monolit dan dialog

Worktree saat evaluasi memuat file besar: [server.ts](../server.ts) sekitar 115 KB/2.607 baris, [rbacStore.ts](../server/rbacStore.ts) 78 KB/1.834 baris, dan [DokumenInternalModule.tsx](../src/components/modules/supporting/DokumenInternalModule.tsx) 129 KB/2.697 baris. Pemecahan dapat dilakukan melalui router/service server per domain, fungsi persistensi RBAC terpisah dan subkomponen/hook UI; pertahankan kontrak API dan buat tes regresi di setiap ekstraksi. Hindari perubahan perilaku, migrasi data dan refactor besar dalam satu rilis.

Pemindaian lokal menemukan 10 panggilan `alert`/`confirm` pada 8 file. Reuse [Modal](../src/components/ui/index.tsx) memungkinkan, tetapi primitive itu perlu ditinjau untuk focus trap, fokus awal/kembali, Escape, `role="dialog"` dan `aria-modal`; toast generik belum ditemukan. Ganti bertahap: notifikasi hasil operasi menjadi toast/inline status yang dapat dibaca screen reader, sedangkan penghapusan, penautan akun dan tindakan berisiko menjadi dialog konfirmasi asinkron dengan dampak jelas dan tombol cancel/confirm. Tes kedua jalur, termasuk pembatalan, sebelum menghapus dialog native.

## 4. Checklist fase A–K

| Fase | Status awal | Hal yang masih diperlukan |
|---|---|---|
| A — fondasi dan data demo | Parsial | Inventaris seed, backup, rencana dan verifikasi pembersihan |
| B — keamanan | Parsial | Rules/admin, hak peran, header, rate limit, privasi dan MFA |
| C — monitoring | Belum diverifikasi | Uptime/error alert, retensi log, prosedur alarm suhu dan recall |
| D — staging | Parsial | Ulang tes di VPS, E2E, load test dan latihan rollback |
| E — domain dan TLS | Parsial | HTTPS dan redirect aktif; HSTS dan pembaruan sertifikat otomatis belum terbukti |
| F — database dan backup | Belum diverifikasi | Definisikan target kanonis, cakupan backup, restore terisolasi, dan disaster recovery |
| G — API pemerintah | Ditunda dengan pengecualian | Persetujuan tertulis atas G1/G2 dan proses manual; G3 tidak otomatis dikecualikan |
| H — migrasi | Belum diverifikasi | Pilih PostgreSQL/Firestore per record, schema, backfill, cut-off, rekonsiliasi dan persetujuan; H-IT2 ditunda |
| I — kepatuhan | Belum diverifikasi | Audit trail, SOP, retensi serta persetujuan PJT dan QA |
| J — operasional | Belum diverifikasi | Walkthrough lintas divisi, pelatihan, hypercare dan keputusan manajemen |
| K — go-live | Belum dilakukan | Cutover, rekonsiliasi dan smoke test produksi |

Rujukan checklist: [production-list.md](./production-list.md). Dokumen lama dapat berisi status yang bertentangan atau usang; misalnya klaim bahwa sistem sama sekali belum memiliki persistensi server tidak sesuai dengan kode yang diperiksa. Status dokumen lain bukan pengganti bukti target terkini.

## 5. Pengecualian integrasi pemerintah dan mitigasi

G1, G2 dan H-IT2 ditunda sesuai keputusan pengguna; pengecualian dari aturan zero-skip perlu ditandatangani Lead Developer dan PJT sesuai checklist, dengan persetujuan PJT/QA atas mitigasi operasional. Tinjau kembali saat integrasi internal telah optimal.

Tampilan dan pratinjau payload bukan bukti pengiriman pemerintah. Tab gudang menyatakan belum terhubung ke e-Katalog LKPP maupun SATUSEHAT; lihat [GerbangPemerintahTab.tsx](../src/components/modules/operations/gudang/GerbangPemerintahTab.tsx).

Tetapkan SOP manual untuk pemeriksaan NIE, tender dan pelaporan pemerintah, KTD serta recall, meliputi penanggung jawab, tenggat, kanal resmi, bukti pengiriman dan rekonsiliasi berkala. Kewajiban yang berlaku tetap harus dipenuhi meskipun API ditunda.

Alarm cold chain dan notifikasi darurat tidak otomatis dikecualikan. Sensor fisik belum terhubung menurut [WarehouseModule.tsx](../src/components/modules/operations/WarehouseModule.tsx). Bila diperlukan dalam operasi, PJT/QA harus menyetujui alternatif manual yang andal.

## 6. Rencana smoke test 13 modul

Jalankan di staging menggunakan data sintetis dan setidaknya dua akun dengan peran berbeda. Untuk setiap modul catat tanggal, commit, akun/peran tanpa kredensial, langkah, hasil, bukti dan penanggung jawab. Belum ada hasil menyeluruh untuk daftar ini pada evaluasi awal.

| Modul | Uji minimum | Status awal |
|---|---|---|
| Executive Dashboard | Cocokkan angka dengan transaksi uji, bukan seed | Belum diverifikasi |
| Regulatory/PJT | Input NIE dan tanggal berlaku; periksa tampilan pengingat | Belum diverifikasi |
| QA | Buat, verifikasi dan tutup CAPA | Belum diverifikasi |
| QC | Tolak inspeksi; pastikan penerimaan yang ditolak tidak diposting ke stok | Belum diverifikasi |
| Gudang | Penerimaan ke stok, FEFO, karantina/recall dan surat jalan | Belum diverifikasi |
| After-Sales | Buat tiket dan jadwalkan kalibrasi | Belum diverifikasi |
| Manufaktur | Buat BMR dan cocokkan perhitungan yield | Belum diverifikasi |
| Purchasing / Internal Document | Uji empat form, termasuk PO Umum: simpan, buka ulang, persetujuan dan PDF | Parsial: empat form tampil |
| CRM & Sales | Prospek → penawaran → order → faktur; tanpa uji pengiriman e-Katalog pada fase ini | Belum diverifikasi |
| PMS/Vigilance | Catat KTD dan uji eskalasi internal/manual | Belum diverifikasi |
| HRD | Absensi dan slip gaji contoh; batasi akses sesuai peran | Belum diverifikasi |
| Finance | Faktur, jurnal debit/kredit seimbang, pajak sesuai konfigurasi yang disetujui dan laporan | Belum diverifikasi |
| IT & Traceability | Telusur batch, audit pelaku sebenarnya, ekspor dan verifikasi rantai hash | Belum diverifikasi |

Tambahkan walkthrough bersama divisi: **terima barang → QC → stok → penjualan → faktur → jurnal → pembayaran**. Cocokkan kuantitas dan nilai pada setiap tahap; jangan mengasumsikan seluruh perpindahan otomatis sampai terbukti.

Uji pula dua pengguna yang mengubah koleksi sama, putus/sambung jaringan, login ulang, restart dan restore. Hasil harus menunjukkan tidak ada transaksi hilang atau tertimpa tanpa peringatan.

Target checklist beban: **50 pengguna bersamaan, tanpa HTTP 5xx dan respons kurang dari 2 detik**. Ini target, bukan hasil yang telah diukur. Load test pada VPS memerlukan jadwal dan persetujuan terlebih dahulu.

## 7. Urutan penyelesaian dan kriteria go-live

1. **Tim teknis — validasi P0-02:** jalur PUT/DELETE/batch/purge/reset sudah memiliki precondition dan tes lokal lulus. Jalankan uji UI dua pengguna/tab, konflik, batch, delete dan offline/reconnect; setelah hasil lokal ditinjau, lakukan uji staging yang disetujui. Pertahankan status parsial sampai bukti target dicatat.
2. **IT — backup/restore (paralel):** tetapkan cakupan backup penuh dan kunci enkripsi; pulihkan ke lingkungan terisolasi dengan secret/proyek Firebase non-produksi. Buktikan login serta rekonsiliasi data sebelum purge, migrasi atau cutover.
3. **Finance, Gudang dan pemilik data — klasifikasi seed:** buat dry-run yang mencantumkan rekaman yang akan dipertahankan/dihapus; tinjau bersama pemilik data, backup, lalu lakukan pembersihan terkendali. Rekonsiliasi checklist mensyaratkan selisih saldo nol dan selisih jumlah record maksimal 0,01%, dengan setiap pengecualian dijelaskan tertulis.
4. **IT/QA — headers:** terapkan header dasar di satu lapisan dan verifikasi HTTPS/API/media/error; jalankan CSP Report-Only sebelum kebijakan CSP ditegakkan dan sebelum mengaktifkan HSTS luas.
5. **Tim data — migrasi transaksi:** putuskan PostgreSQL atau Firestore per record berdasarkan invariant, operasi dan kapasitas tim; buat vertical slice, backfill/shadow-read, ukur selisih, buktikan rollback, lalu cutover domain per domain. Tidak ada big-bang migration.
6. **Tim aplikasi — refactor dan UX:** pecah file besar dengan tes regresi dan ganti dialog browser secara bertahap; prioritaskan aksi destruktif dan notifikasi kritis.
7. **PJT, QA, pemilik modul dan manajemen:** tinjau bukti, setujui risiko/pengecualian, rencana cutover, rollback, monitoring dan hypercare. Go-live tetap NO-GO sampai prasyarat yang diwajibkan lengkap.

## 8. Riwayat evaluasi

### 24 November 2026 — P0-02 jalur administratif sync (lokal)

- **Lingkup:** melanjutkan P0-02 berdasarkan evaluasi; perubahan dan tes hanya di worktree lokal. Tidak ada commit, push, deployment, akses atau perubahan data VPS/staging.
- **Perubahan:** `/api/sync/purge-dummy` menolak request tanpa versi lengkap dan memeriksa seluruh versi lewat batch atomik; konflik menghasilkan `409`. `/api/sync/reset` mewajibkan revisi global yang valid dan menolak reset stale sebelum mengubah state (`409`). Klien memulihkan snapshot lokal purge/restore saat ditolak atau respons server tak pasti; reset kini gagal aman tanpa sesi dan tidak menghapus cache sampai server mengonfirmasi revisi.
- **Bukti:** `npm test` lulus 40 file / 500 tes; pengujian terarah sync/admin lulus 50 tes; `npm run lint` dan `npm run build` lulus. Skenario mencakup PUT, DELETE, batch atomik, purge basi, reset basi/valid, cache lokal, offline/reconnect dan draf konflik setelah reload.
- **Batasan/keputusan:** UI dua editor/lintas tab, staging, restore backup lengkap dan rekonsiliasi data belum diuji. P0-02 tetap parsial sampai verifikasi target disetujui; produksi tetap **NO-GO**.

### 24 November 2026 — ulasan solusi operasional dan migrasi

- **Lingkup:** evaluasi kode/dokumentasi lokal dan rencana, tanpa akses atau perubahan VPS, database, Firebase, backup, atau data produksi.
- **Optimistic concurrency:** jalur PUT/DELETE/batch umum sudah membandingkan versi dan tes lokal lulus. Ulasan lanjutan menemukan `/api/sync/purge-dummy` dan `/api/sync/reset` belum memakai expected versions/revision; P0-02 karena itu masih parsial.
- **Restore dan seed:** belum ada bukti restore lengkap dari backup terenkripsi di lingkungan terisolasi, termasuk login serta rekonsiliasi saldo dan stok. Mekanisme purge seed/provenance ada, tetapi laporan dry-run dan verifikasi finansial/stok independen belum tersedia. Jangan melakukan purge sebelum restore dan persetujuan pemilik data.
- **Security headers:** Caddy/Nginx template lokal hanya mencakup sebagian header; CSP final belum disiapkan dan tidak ada bukti bahwa konfigurasi aktif telah terpasang di staging. CSP contoh yang terlalu luas tidak diterima sebagai kebijakan final; uji Report-Only dan kompatibilitas Firebase tetap diperlukan.
- **Migrasi transaksi:** saat ini state sync berupa `app-state.json` dengan nilai per koleksi; driver aplikasi yang diketahui Firebase/PocketBase, belum PostgreSQL. PostgreSQL direkomendasikan untuk ledger stok/akuntansi yang memerlukan transaksi lintas record, tetapi memerlukan skema, adapter, operasi dan migrasi bertahap. Firestore per record merupakan alternatif jika tim memilih tetap pada Firebase; tidak cukup memindahkan array besar menjadi subkoleksi tanpa aturan transaksi dan audit. Rencana rinci dicatat di bagian 3A.
- **Maintainability/UX:** ukuran source lokal sekitar `server.ts` 115 KB/2.607 baris, `rbacStore.ts` 78 KB/1.834 baris dan `DokumenInternalModule.tsx` 129 KB/2.697 baris. Ditemukan 10 panggilan native `alert`/`confirm` pada 8 file; ada Modal dasar, tetapi fokus/keyboard perlu diperkuat dan toast generik belum ditemukan.
- **Keputusan:** semua ini temuan dan rekomendasi lokal, bukan bukti keadaan live. Restore, pemisahan seed, validasi headers, migrasi database, dan uji staging masih terbuka; produksi tetap **NO-GO**.

### 24 November 2026 — optimistic concurrency lokal

- **Lingkup:** implementasi lokal pada worktree yang berisi perubahan belum di-commit; tidak ada commit, push, deployment, perubahan data VPS atau uji staging.
- **Perubahan server/store:** versi per-key persisten, termasuk tombstone setelah hapus; PUT/DELETE memerlukan `If-Match`, batch memerlukan `expectedVersions` untuk semua key. Versi basi menghasilkan `409`, precondition hilang `428`, dan batch stale tidak menulis bagian mana pun. Pemeriksaan dilakukan sebelum side effect migrasi media; kegagalan simpan delete dilaporkan sebagai HTTP 500.
- **Perubahan klien:** antrean offline v2 menyimpan versi dasar dan penanda konflik, mempertahankan kompatibilitas baca antrean lama secara konservatif. Konflik 409 ditahan dan tidak di-rebase saat sync ulang, reconnect atau reload; draf lokal tetap tersimpan. Pembaruan berhasil memakai versi server baru hanya untuk mutasi lanjutan dari operasi yang sama.
- **Bukti lokal:** tes API membuktikan dua PUT bersamaan dengan versi sama menghasilkan satu sukses dan satu 409; tes batch membuktikan tidak ada partial write; penghapusan/tombstone dan pembuatan ulang menaikkan versi; tes klien membuktikan konflik reconnect bertahan setelah reload serta batch konflik tidak dipecah menjadi per-key. `npm test`: 40 file / 497 tes lulus; `npm run lint`, `npm run build` dan `git diff --check` lulus.
- **Batasan/keputusan:** P0-02 belum ditutup karena purge/reset administratif masih melewati precondition, dan belum ada uji UI dua editor/lintas tab atau staging. Restore penuh di lingkungan terisolasi tetap tugas operasional paralel dan belum dilakukan. Produksi tetap **NO-GO**.

### 24 November 2026 — review risiko lokal dan pembaruan status

- **Lingkup:** review statis source pada worktree lokal berbasis `ca6e2b0`, yang masih berisi perubahan belum di-commit; pengulangan `npm audit --omit=dev`; pemeriksaan ukuran bundel build lokal. Tidak ada perubahan kode, akses staging/VPS, perubahan Firebase, deploy, atau uji browser pada langkah review ini.
- **Temuan prioritas saat evaluasi:** jalur tulis sync belum mewajibkan versi dasar klien (P0-02); batas audit RBAC 500 entri dan sebagian audit bisnis memakai aktor tetap (P0-03); limiter aplikasi berjalan di memori (P1-03). Jalur tulis umum kemudian ditangani lokal; cakupan purge/reset dan staging tetap terbuka sebagaimana dicatat pada evaluasi lanjutan 24 November. Temuan lain tetap terbuka.
- **Dependensi:** audit lokal melaporkan 4 high dan 0 critical pada dua advisory `@grpc/grpc-js`. Pohon dependency menunjukkan versi client `1.9.16` dan Firebase Admin `1.14.7`; keterpaparan paket dalam proses target belum dipetakan, dan tidak ada dependency yang diubah.
- **Keamanan/performa:** template proxy di repository berisi beberapa security headers, tetapi konfigurasi/response staging belum diverifikasi. Pengukuran bundle dan dialog dicatat pada checklist/P1-09; ini bukan pengukuran browser live.
- **Customer Portal:** `signInWithPopup` dipakai tanpa resolver popup pada inisialisasi Firebase customer di worktree lokal (P1-10). Jangan menyatakan login Google berfungsi sebelum resolver ditambahkan dan browser staging diuji.
- **Keputusan dan urutan berikutnya pada review awal:** produksi tetap **NO-GO**. Optimistic concurrency ditetapkan sebagai langkah engineering berikutnya; implementasi dan tindak lanjut lokal dicatat pada entri 24 November. Tim operasional dapat membuktikan restore secara paralel.

### 23 November 2026 — baseline

- **Commit:** `5780a4f`.
- **Lingkungan:** kandidat rilis lokal dan staging Ubuntu; bukti dibedakan pada bagian 2.
- **Keputusan:** NO-GO produksi penuh; staging untuk pengujian.
- **Sudah terbukti:** tes lokal, lint dan `cek:semua` lulus; build staging berhasil; service, HTTPS, login dan tampilan empat form telah diperiksa sesuai batas bukti.
- **Masih terbuka:** P0-01 sampai P0-04 dan P1-01 sampai P1-09; fase dan pengujian yang belum diverifikasi tercantum di atas.
- **Pengecualian yang direncanakan:** API pemerintah ditunda, menunggu dokumentasi persetujuan dan mitigasi manual.

### 23 November 2026 — fase 0 dan 1 dimulai

- **Kode pada saat evaluasi:** perubahan belum di-commit pada worktree rilis terisolasi berbasis `5780a4f`; belum digabungkan dengan perubahan lokal workspace utama, di-push, atau di-deploy. VPS masih memakai versi sebelumnya.
- **Fase 0, parsial:** loader RBAC dan secret sesi gagal dengan error jelas apabila berkas yang ada rusak, tidak valid atau tidak dapat dibaca; berkas tidak ditimpa. Uji pemulihan salinan data **lokal sintetis** lulus. Backup terenkripsi data VPS sudah dibuat dan disalin ke Windows, tetapi kesamaan hash dan restore lengkap terisolasi belum diverifikasi.
- **Fase 1, parsial:** pembaruan akun dan peran dibuat atomik terhadap kegagalan simpan; email duplikat ditolak untuk akun baru atau perubahan email dan login Google dengan email lama yang ambigu ditolak. Pembuatan akun tanpa email tidak lagi mengarang alamat; pesan antarmuka membedakan akun aktif/tidak aktif dan pengiriman Firebase yang belum berhasil. Pembatasan admin Firebase pada kandidat tetap dipertahankan.
- **Bukti lokal:** `npm test` lulus **28 file / 319 tes**; `npm run lint` dan `npm run build:staging` lulus. Uji HTTP lokal terisolasi berhasil membuat peran dan akun, login, menolak akses yang tidak diizinkan, membuka salinan data setelah restart, menonaktifkan akun dan mencabut sesi. Build masih memperingatkan chunk di atas 500 kB. Uji ini bukan pengujian UI atau Firebase staging sebenarnya.
- **Masih perlu:** backup terenkripsi VPS di luar server, restore lengkap, deployment yang disetujui, uji antarmuka dan beberapa peran di VPS, persistensi setelah restart, hak akses, login Google dan sinkronisasi/pemulihan Firebase. Snapshot Firebase yang dikirim tidak membuktikan backup lengkap atau penghapusan akun di cloud.
- **Backup VPS, parsial:** pengguna melaporkan `/var/lib/ams-data` berukuran 132 KB dan `gpg` serta `tar` tersedia. Setelah persetujuan penghentian sementara hanya service `ams`, arsip data terenkripsi dibuat di VPS; pengguna melaporkan service `active` dan arsip dapat dibaca oleh GPG/tar. Pengguna melaporkan arsip tersalin ke komputer Windows setelah verifikasi fingerprint SSH. Kesamaan hash salinan belum diverifikasi dan restore lengkap belum dibuktikan; backup Firestore dan konfigurasi/identitas tetap harus direncanakan terpisah.
- **Keputusan:** fase 0 dan 1 belum selesai; **NO-GO** produksi tetap berlaku.

### 23 November 2026 — deploy dan uji awal akun staging

- **Commit aplikasi:** `3de93b8`, di-push ke `origin/main` dan di-deploy ke VPS Ubuntu staging.
- **Bukti VPS:** lint, **28 file / 319 tes** dan build staging lulus. Setelah restart, service `ams` aktif, HTTPS health HTTP 200, mode staging, driver Firebase, Firebase Admin terhubung dan konfigurasi dilaporkan siap. Build masih menampilkan peringatan `NODE_ENV` dan chunk besar.
- **Uji pengguna:** pengguna melaporkan pembuatan dan login satu akun uji berhasil. Setelah restart tambahan yang disetujui, service kembali aktif, akun dapat login dan perannya masih sesuai.
- **Masih perlu:** uji matriks izin beberapa peran dan penolakan akses di VPS, pemulihan lengkap, backup Firestore/konfigurasi, pencocokan hash salinan backup dan sinkronisasi/pemulihan Firebase sebenarnya. Uji satu akun bukan bukti seluruh peran atau fitur telah lolos.
- **Keputusan:** fase 0 dan 1 masih parsial; **NO-GO produksi** tetap berlaku.

### 23 November 2026 — sinkronisasi laporan dan penyalinan backup

- **Laporan di VPS Ubuntu:** commit dokumentasi `9339dac` ditarik dengan fast-forward setelah deploy aplikasi `3de93b8`. Perubahan tersebut hanya dokumentasi, sehingga tidak membutuhkan build atau restart.
- **Backup di Windows:** output pengguna menunjukkan penyalinan arsip terenkripsi `/home/amsdeploy/ams-staging-data-20261123.tar.gpg` ke `Documents\AMS-Backups\ams-staging-data-20261123.tar.gpg` selesai melalui SCP, menggunakan pemeriksaan host key yang telah diverifikasi. Arsip mencakup data `/var/lib/ams-data`, bukan backup Firestore atau seluruh konfigurasi/identitas. Hash salinan belum dibandingkan dan restore lengkap belum diuji.
- **Percobaan deploy Windows:** perintah opsional dijalankan pada lingkungan Windows yang tidak memiliki `C:\Apps\AMS` maupun skrip deploy pada lokasi tersebut. Deploy Windows tidak terjadi dan pemeriksaan health lokal pada port 3100 gagal terhubung. Ini bukan deployment VPS Ubuntu staging dan bukan bukti gangguan pada service Ubuntu; tidak perlu mengulang perintah Windows untuk memperbarui staging Ubuntu.
- **Keputusan:** fase 0 dan 1 tetap parsial dan **NO-GO produksi** tidak berubah.

### 23 November 2026 — lanjutan fase 0–1: logout

- **Lingkungan:** kandidat lokal pada worktree rilis berbasis `d862ef7`; perubahan berikut belum di-commit, di-push atau di-deploy ke VPS.
- **Temuan:** logout akun developer menghapus cookie tetapi tidak mencabut sesi server, karena perlindungan sesi developer juga diterapkan pada logout sendiri. Klien juga tidak memperingatkan bila logout server atau Firebase gagal.
- **Perbaikan lokal:** logout mencabut sesi milik pengguna sendiri, termasuk developer; pencabutan sesi developer melalui fitur administrasi tetap ditolak. Penyimpanan pencabutan sesi dan audit dilakukan bersama. Klien tetap menghapus sesi lokal ketika gagal, tetapi memperingatkan bahwa logout server atau Firebase belum dipastikan.
- **Bukti lokal:** tes lulus **29 file / 325 tes**, termasuk logout developer dan staf, perlindungan sesi developer, kegagalan simpan serta kegagalan server, jaringan dan Firebase; lint dan build staging lulus. Build masih memperingatkan ukuran chunk. Pengujian ini belum membuktikan perilaku UI, HTTP atau Firebase di VPS.
- **Verifikasi salinan backup:** hash SHA-256 arsip di Windows cocok dengan hash arsip VPS yang dilaporkan pengguna. Ini membuktikan kesamaan berkas terenkripsi yang dibandingkan, bukan kelengkapan data atau keberhasilan restore.
- **Latihan restore data lokal, parsial:** arsip berhasil didekripsi dan diekstrak di folder Windows terbatas; hash keempat berkas hasil ekstraksi cocok dengan isi arsip dan semuanya berbentuk JSON yang terbaca. Struktur RBAC memuat satu akun dan 13 peran. Arsip ini dibuat sebelum uji akun staging terbaru; `.session-secret` tidak terdapat dalam arsip. Tidak ada aplikasi yang dijalankan dari hasil restore dan login belum diuji. Data hasil ekstraksi serta profil GPG sementara telah dihapus; arsip terenkripsi tetap disimpan.
- **Masih terbuka:** restore lengkap yang membuktikan login dan rekonsiliasi data, backup Firestore/konfigurasi dan identitas yang diperlukan, uji beberapa akun dan matriks peran di VPS, serta pengujian logout dan sinkronisasi/pemulihan Firebase setelah deployment yang disetujui. Fase 0 dan 1 tetap parsial; **NO-GO produksi** tetap berlaku.

### 23 November 2026 — penundaan uji restore lengkap

- **Keputusan pengguna:** uji restore lengkap dan login dari backup ditunda untuk dilakukan setelah semua fase lain selesai. Catat dan jalankan uji tersebut di lingkungan terisolasi, termasuk rekonsiliasi data dan verifikasi akun/peran, tanpa menyentuh data aktif.
- **Batas penundaan:** pekerjaan fase lain dapat dilanjutkan, tetapi kriteria restore pada fase 0, 1 dan 5 tetap terbuka. Keputusan produksi tetap **NO-GO** sampai uji dan prasyarat produksi lain terpenuhi; fase 6 tidak dapat dinyatakan GO hanya karena pengujian ditunda. Integrasi pemerintah fase 7 tetap mengikuti rencana dan pengecualian yang disetujui.

### 23 November 2026 — pemeriksaan akses baca peran

- **Temuan kode P0-05:** pada `d862ef7`, pembatasan menu dan pemeriksaan tulis tidak mencegah pengguna terautentikasi menerima seluruh snapshot sinkronisasi melalui HTTP dan pembaruan lengkap melalui WebSocket. Hak baca data tiap peran belum terbukti; akses data belum dapat dianggap aman hanya karena menu tersembunyi.
- **Batas dan mitigasi sementara:** belum dilakukan uji akses terhadap data VPS nyata. Jangan mengundang pengguna tambahan atau memasukkan data sensitif untuk evaluasi sebelum pembatasan diverifikasi; batasi staging pada personel tepercaya dan data sintetis. Kebijakan akses per koleksi, terutama self-service HRIS dan ketergantungan lintas modul, perlu ditetapkan sebelum implementasi agar alur penting tidak terputus.
- **Status:** fase 1 masih parsial dan **NO-GO produksi** tetap berlaku.

### 23 November 2026 — kebijakan akses minimum

- **Keputusan pengguna:** akses data dibatasi sesuai izin peran; data pribadi self-service hanya milik sendiri jika identitas dapat dibuktikan. Akses yang tidak dapat dipastikan ditolak.
- **Akses seluruh karyawan yang dipilih pengguna:** profil/administrasi untuk HRD, Payroll, Manajemen dan Developer; gaji/slip serta data kesehatan kerja untuk HRD, Payroll dan Manajemen. Pengguna kemudian mengklarifikasi bahwa **Developer memiliki akses penuh ke seluruh data dan modul**, termasuk gaji dan kesehatan. Ini kebijakan target, belum diterapkan atau diuji. Akses teknis langsung ke VPS/Firebase memerlukan pengendalian terpisah.
- **Peran:** pengguna memilih membuat peran khusus HRD, Payroll dan Manajemen jika belum tersedia. Daftar peran kustom di VPS belum diperiksa; jangan membuat duplikat atau mengaktifkan akses sebelum pembatasan server dan pengujian selesai.
- **Temuan lanjutan:** akun RBAC memiliki ID akun, sedangkan catatan HRIS memakai ID karyawan; model akun yang diperiksa belum memiliki relasi ID karyawan yang dapat dipakai untuk membuktikan kepemilikan. Koleksi absensi dan cuti juga ditulis sebagai kumpulan data, bukan transaksi per individu. Penyaringan tampilan saja tidak menjamin isolasi atau melindungi data dari perubahan oleh pengguna lain.
- **Tindak lanjut:** terapkan dan uji kebijakan HRIS yang dipilih, buat relasi identitas yang dikelola administrator dan jalur baca/tulis per individu yang tervalidasi. Tinjau pula cache browser, ekspor, media dan akses Firebase sebagai jalur terpisah. Sampai diperbaiki dan diuji, jangan menganggap self-service atau isolasi peran aman.

### 23 November 2026 — implementasi lokal P0-05 (belum dirilis)

- **Perubahan lokal:** snapshot HTTP, broadcast WebSocket, proxy PocketBase, media internal dan paket migrasi kini difilter menurut izin server; akses data personal HRIS, pelatihan dan sertifikasi dibatasi. Empat peran bawaan HRD, Payroll, Manajemen dan Developer mendapat cakupan baca HRIS penuh sesuai izin modul. Akun self-service diwajibkan memiliki tautan unik ke ID karyawan yang cocok dengan record HRIS di server; absensi dan pengajuan cuti dibatasi ke record sendiri, dan status persetujuan cuti dikuasai server.
- **UX mobile:** akun tanpa tautan ditampilkan peringatannya dan tidak dapat mengirim absensi/cuti. Identitas akun reguler dipilih hanya dengan ID, bukan nama atau fallback ke karyawan pertama; peran dengan akses seluruh karyawan tetap dapat memakai konteks karyawan.
- **Keputusan akses kolom:** pengguna memilih aturan ketat: self-service tidak boleh membaca gaji/slip atau kesehatan. Implementasi lokal menghapus gaji dasar, tanggal lahir dan status medis dari profil HRIS self-service, menolak koleksi slip/lembur/MCU/insiden K3, menyembunyikan tampilan rekam medis dan menu slip gaji untuk peran tersebut. Ini belum diuji di staging.
- **Verifikasi lokal:** tes terarah `npm exec vitest run -- tests/domain/rbac-realtime-sync.test.ts tests/domain/mobile-app.test.ts` lulus (22 tes); `npm run lint` (`tsc --noEmit`) lulus. Ini membuktikan hasil tes dan tipe di workspace saat ini saja, bukan uji VPS atau penetrasi seluruh jalur data.
- **Masih terbuka:** perubahan belum di-deploy atau diuji di VPS. `firestore.rules` memakai default-deny, tetapi akun bootstrap admin Firebase diberi akses luas ke koleksi sinkronisasi; otorisasi tersebut terpisah dari RBAC AMS dan tidak menerapkan penyaringan peran/kolom. Belum dibuktikan pemisahan akun, semua ekspor/cache eksternal dan jalur integrasi; aturan Firebase Storage juga tidak ditemukan di workspace. Atribut lain dalam bundel data contoh klien dan alur role/cache perlu divalidasi agar tidak membuka data melalui jalur di luar server; jangan anggap kerahasiaan atau kepatuhan privasi selesai. Server belum membuktikan validitas GPS/geofence atau seluruh isi absensi, sehingga catatan lokasi tetap dianggap input pengguna. Self-service menolak data identitas yang tidak ditemukan/valid di master server, sehingga alur operasional sinkronisasi master juga perlu diuji.
- **Status:** P0-05 **parsial, belum siap rilis**; fase 1 tetap parsial dan **NO-GO produksi** berlaku. Pertahankan perubahan lokal yang ada; jangan men-deploy sebelum tinjauan menyeluruh, pengujian staging terisolasi, dan persetujuan pengguna.

### 23 November 2026 — deploy dan uji logout staging

- **Commit aplikasi:** `70463e8`, di-push ke `origin/main` dan ditarik ke VPS Ubuntu staging dengan status Git bersih. Build staging selesai; setelah restart, service `ams` dilaporkan aktif dan HTTPS health mengembalikan 200.
- **Uji pengguna:** logout dan login ulang setelah hard refresh berhasil di UI staging. Ini belum membuktikan penolakan token lama melalui HTTP atau seluruh kondisi kegagalan pada VPS.
- **Batas:** perubahan yang di-deploy memperbaiki logout, bukan pembatasan akses data P0-05 atau pembuatan peran HRD, Payroll dan Manajemen. Batasi pengujian pada personel tepercaya dan data sintetis; keputusan produksi tetap **NO-GO**.

### 23 November 2026 — push dan lanjutan isolasi HRIS

- **Commit yang sudah di-push:** `8d132d4` pada `origin/main`, mencakup pembatasan HRIS dan perubahan modul yang disetujui pengguna. `npm run verifikasi` pada kandidat tersebut lulus lokal dengan **343 tes**. Status CI belum diperiksa dan commit ini belum dibuktikan terpasang di VPS.
- **Perubahan tambahan:** pekerjaan di bawah masih **lokal, belum di-commit, di-push, atau di-deploy**. Self-service kini memerlukan satu master karyawan dan satu tautan akun yang unik saat membaca maupun menulis, termasuk setelah hydrate cloud; perubahan master memicu pemberitahuan pembaruan hak melalui WebSocket. Hak baca dan tulis juga mengikuti izin modul yang masih aktif.
- **Perlindungan data:** field self-service dipilih dari daftar yang diizinkan, termasuk sertifikasi; field tambahan tidak otomatis ikut terkirim. Penulisan dan penghapusan HRIS dibatasi menurut peran; peran tanpa hak hapus tidak dapat menghilangkan record melalui penggantian seluruh koleksi. Jalur batch, purge, reset dan media dengan scope pelatihan/sertifikasi mengikuti pembatasan terkait. Cuti yang sudah diputuskan tidak dapat diubah lewat self-service, dan ID record milik karyawan lain tidak dapat digunakan ulang.
- **Akun/Firebase:** aturan sumber dan blueprint diperbarui agar `employeeId` opsional dapat dibuat dan diperbarui pada snapshot akun tanpa menolak dokumen lama. Hydrate lokal juga mempertahankan tautan pada dokumen lama dan dapat menerapkan penghapusan tautan secara eksplisit. Ini belum membuktikan penulisan atau pemulihan akun pada Firebase sebenarnya.
- **Bukti lokal terbaru:** `npm run verifikasi` lulus: TypeScript, lint rules, **31 file / 353 tes**, seluruh pemeriksaan gudang dan build. Tes HTTP/WebSocket menggunakan server loopback, data dan akun sintetis, direktori sementara terpisah serta tanpa kredensial Firebase aktif; mencakup proyeksi data, perubahan izin, tautan duplikat, cuti, batas Payroll, purge/reset dan media. Rules Firestore baru diperiksa secara statis dan lint; **belum diuji dengan emulator atau pada Firebase staging**.
- **Risiko tersisa:** akses Firestore langsung masih memakai otorisasi Firebase terpisah dan realtime klien dapat melewati filter server. Endpoint hydrate cloud masih memberi sebagian admin kemampuan memulihkan state secara luas, sehingga pembatasan HRIS belum menyeluruh. Identitas cache sinkronisasi belum memasukkan `employeeId`; perubahan peran/identitas dapat membersihkan antrean lokal yang belum terkirim. Penanganan cache, perubahan tautan, data offline, ekspor dan seluruh jalur pemulihan harus ditinjau sebelum pengujian pengguna lain. Status sakit/alasan cuti merupakan data sensitif dalam alur yang tersedia dan perlu dipastikan sesuai kebijakan privasi yang disetujui.
- **Aturan target:** rules staging pernah diubah manual dan konfigurasi bootstrap pada repository dapat berbeda dari target. Jangan menerapkan file rules lokal secara langsung tanpa membandingkan rules aktif, memverifikasi project/database tujuan, meninjau akses administrator, membuat rencana rollback dan mendapat persetujuan.
- **Keputusan:** fase 0–1 dan P0-05 tetap **parsial**, produksi **NO-GO**. Staging tetap dibatasi pada personel tepercaya dan data sintetis. Restore lengkap serta login dari backup tetap ditunda sampai setelah fase lain selesai, dan wajib sebelum GO.

### 23 November 2026 — prioritas CMS dan website publik (lokal)

- **Prioritas:** sesuai arahan pengguna, pekerjaan fase 0–1 ditahan sementara untuk memperbaiki CMS Website dan pengalaman pengunjung. Temuan P0 tidak diturunkan prioritasnya dan tetap harus diselesaikan sebelum produksi.
- **Kandidat dan lingkungan:** perubahan masih lokal di worktree berbasis `8d132d4`, bersama perubahan lain yang belum dirilis; **belum di-commit, di-push, atau di-deploy**. Pemeriksaan browser memakai server loopback, akun dan data sintetis, profil terisolasi, serta tanpa Firebase atau VPS nyata.
- **CMS:** draf aktif dipertahankan saat sinkronisasi; status simpan lokal dibedakan dari konfirmasi server. Publikasi dan penahanan menunggu respons server, dengan peringatan bila hasil tidak pasti. Peran baca saja tidak dapat menyunting atau menerbitkan. Notifikasi unggah media tidak lagi memicu konflik draf palsu pada skenario yang diuji; konflik draf lain tetap ditampilkan.
- **Pengunjung dan RFQ:** permintaan divalidasi dan disimpan server dengan ID pengulangan yang sama untuk mencegah duplikasi pada skenario retry yang diuji; pratinjau tidak mengirim RFQ. Antrean server ditampilkan dalam prospek komersial sesuai akses. Publikasi menggunakan snapshot server sebagai sumber utama, divalidasi sebelum disimpan, dan salinan berkas ditulis setelah penyimpanan server berhasil. Jika tidak ada snapshot inline, cache lokal tidak dirender sebelum pemeriksaan jaringan; status server yang menyatakan belum ada publikasi tidak menggunakan cache lokal lama.
- **Sinkronisasi dan media:** tes dengan Firebase tiruan memeriksa penggabungan RFQ saat pemulihan serta penolakan respons hydrate yang gagal; pembaruan realtime Firebase yang usang tidak langsung menimpa draf, publikasi dan RFQ server. Konfirmasi unggahan yang tidak lengkap mempertahankan media dalam antrean; kegagalan audit atau siaran setelah file tersimpan ditampilkan sebagai peringatan. Kegagalan pencadangan media yang dicoba dari browser dicatat di konsol; kegagalan dan ukuran berlebih pada jalur Firebase Admin dicatat di log server. Belum ada peringatan UI atau antrean ulang untuk pencadangan Firebase. Jalur browser tidak mencoba pencadangan tanpa pengguna Firebase terverifikasi; server memiliki jalur Admin terpisah yang belum diuji dengan Firebase nyata.
- **Verifikasi lokal:** `npm exec vitest run -- tests/domain` lulus **38 file / 420 tes** dan `npm run lint` lulus. Build frontend mode staging dilakukan di direktori terisolasi; halaman statis `/web` dan `/mobile` tersedia. Uji browser sintetis mencakup katalog/RFQ, retry setelah reload, kegagalan clipboard, pratinjau, FAQ, unggah logo dan peringatan audit, simpan dan sinkron draf, publikasi/penahanan realtime, respons tertunda/timeout, konflik, reload, peran baca serta cache lama sebelum dan sesudah 404 otoritatif pada `/` dan `/web/`. Ini bukan uji semua bidang, seluruh kombinasi peran, Firebase sebenarnya, atau Linux staging.
- **Performa lokal:** pada satu uji pengunjung bersih berukuran 390 px, tidak ada overflow horizontal dan resource ERP/Firebase tidak dimuat; first contentful paint sekitar 144 ms pada mesin lokal tanpa simulasi jaringan lambat. Angka ini bukan hasil atau jaminan performa VPS.
- **Risiko tersisa:** backup otomatis dan pemulihan RFQ/media pada Firebase sebenarnya belum dibuktikan; antrean RFQ belum memiliki kebijakan retensi atau batas ukuran. P0-01, P0-02 termasuk konflik bersamaan/offline, risiko P0-05, serta perilaku reset/penghapusan dan fallback snapshot berkas masih terbuka. Data stok/harga operasional dapat berbeda antara browser bercache ERP dan pengunjung bersih; kebijakan publikasinya belum ditetapkan. Pengujian seluruh seksi CMS, kompatibilitas data historis, aksesibilitas, jaringan dan beban nyata masih diperlukan.
- **Langkah berikutnya:** selesaikan risiko P0 dan kebijakan data publik, lalu uji seluruh alur website dan sinkronisasi dengan data sintetis serta Firebase staging pada lingkungan Linux yang disetujui. Restore lengkap dan login dari backup tetap ditunda hingga fase lain selesai dan wajib sebelum GO. Keputusan tetap **NO-GO produksi**; belum ada bukti bahwa website bebas bug.

### 24 November 2026 — deployment staging dan ketahanan loader (lokal)

- **Deployment:** pengguna melaporkan build staging berhasil dan service `ams` aktif pada `0a1c6d0`. Health publik, project dan database Firebase staging, halaman publik, katalog, dan kesesuaian snapshot server diperiksa. Backup terenkripsi pra-deploy disalin ke luar VPS dan hash cocok; ini bukan bukti restore lengkap.
- **Perbaikan lokal P0-01:** loader state dan indeks media menolak berkas yang tidak terbaca, JSON rusak atau struktur tidak valid tanpa menimpanya; startup gagal dengan pesan yang mengarahkan pemulihan dari backup. File baru masih dibuat jika benar-benar belum ada, dan metadata versi tingkat teratas yang tidak ada tetap didukung. Tes sintetis mencakup file tidak valid, pembacaan gagal, state baru, data lama dan kegagalan startup terisolasi.
- **Verifikasi lokal:** 38 file / 436 tes lulus, termasuk startup server terisolasi; TypeScript dan lint rules Firestore lulus. Ini tidak membuktikan kompatibilitas semua data historis atau pemulihan pada VPS.
- **Batasan:** perubahan loader belum di-deploy atau diuji terhadap seluruh data historis pada VPS; sebelum deploy verifikasi kompatibilitas salinan data tanpa membagikan isinya. Kehilangan file sepenuhnya, pemulihan dari file sementara, fallback media tanpa indeks, serta restore lengkap dan login dari backup masih perlu ditangani atau dibuktikan. P0-01 tetap parsial dan produksi tetap **NO-GO**.

### 24 November 2026 — ketahanan unggah media (lokal)

- Perbaikan loader di atas telah dipush sebagai `55c7982`; CI lulus, tetapi belum di-deploy ke VPS.
- Jika penyimpanan indeks gagal saat unggah media, gambar dan metadata sebelumnya dipertahankan pada skenario kegagalan yang diuji; file baru dibatalkan. Jika pemulihan gagal, error dicatat dan salinan `.bak-...` dipertahankan. Kegagalan penyimpanan dikirim sebagai HTTP 500 agar unggahan baru dapat masuk antrean, bukan dianggap kesalahan format.
- Tes lokal memeriksa unggah baru, penggantian format sama/berbeda, percobaan ulang, kegagalan pemulihan, HTTP dan antrean browser. Seluruh **38 file / 442 tes**, TypeScript dan lint rules lulus.
- **Batasan:** perubahan unggah ini masih lokal dan belum di-deploy. Pemadaman mendadak di antara penggantian file dan penyimpanan indeks, pemulihan otomatis file `.bak-...`, akses fallback media tanpa indeks, serta kegagalan dan pemulihan Firebase nyata belum dibuktikan. Jangan menghapus file cadangan tanpa menyelidiki keadaan media.

### 24 November 2026 — pemulihan cache dan draf tertunda (lokal)

- Versi pembaruan server tidak lagi dicatat sebagai diterapkan sebelum cache berhasil disimpan; kegagalan realtime ditampilkan pada status sinkronisasi. Tes lokal memeriksa percobaan ulang melalui delta dan realtime setelah penyimpanan perangkat pulih.
- Tombol pemulihan draf menolak mengganti suntingan saat draf masih dalam antrean, termasuk antrean yang terdeteksi dari tab lain atau tidak dapat dibaca.
- **Verifikasi lokal:** 38 file / 445 tes, TypeScript dan lint rules Firestore lulus. Interaksi tombol belum diuji di browser.
- **Batasan:** perubahan ini belum di-deploy dan tidak menyelesaikan konflik dua editor. Server masih belum memeriksa versi dasar draf; pengiriman offline, publikasi dan tab bersamaan masih berisiko tertimpa. P0-02 tetap terbuka dan produksi tetap **NO-GO**.
- **Penjadwalan:** pada 24 November 2026 pengguna meminta konflik dua editor dicatat untuk ditangani kemudian. Hindari penyuntingan bersamaan sementara ini; perlindungan versi dasar, antrean offline, publikasi, retry dan uji dua editor tetap wajib sebelum P0-02 dapat ditutup.

### 24 November 2026 — batas RFQ pengunjung (lokal)

- Pengunjung menerima petunjuk sebelum mengirim lebih dari 30 produk atau jumlah di luar bilangan bulat 1–1.000.000; batas klien dan server memakai pemeriksaan bersama.
- Tes terarah dan browser lokal dengan data sintetis memeriksa 31 produk dan jumlah pecahan tanpa mengirim POST. Seluruh 38 file / 452 tes, TypeScript dan lint rules lulus.
- **Batasan:** perubahan masih lokal dan belum di-commit atau di-deploy; pengujian ini bukan bukti seluruh alur RFQ, Firebase, atau jaringan staging.

### 24 November 2026 — navigasi formulir RFQ (lokal)

- Sebelum perbaikan, isian hilang saat pengunjung membuka katalog dari formulir dan kembali. Komponen formulir kini tetap hidup namun tersembunyi pada halaman tanpa kontak, sehingga isian, permintaan aktif dan hasilnya tetap ada selama situs tidak dimuat ulang.
- Browser lokal dengan data dan respons sintetis memeriksa navigasi, tombol dinonaktifkan saat pengiriman berlangsung, hasil sukses dan gagal setelah berpindah halaman, serta retry dengan ID yang sama. Isi mentah uji tidak ditemukan di sessionStorage atau localStorage. Tes terarah lulus: 2 file / 18 tes; TypeScript lulus.
- **Batasan:** isian mentah hanya di memori dan tidak dipertahankan setelah refresh, menutup halaman atau komponen situs dilepas. Respons pengiriman disimulasikan, bukan bukti penyimpanan di server atau Firebase; perubahan belum di-commit atau di-deploy.

### 24 November 2026 — audit Customer Portal tahap 1 (lokal)

- **Kondisi:** login karyawan memakai `ServerRbacStore` (`data/rbac-db.json`), scrypt, token HMAC dan cookie `ams_session`; login Google Firebase hanya menerima email terverifikasi yang cocok dengan akun RBAC. Data ERP tersimpan sebagai kunci sinkronisasi JSON; `/api/sync/*` mewajibkan sesi karyawan dan memfilter per peran.
- **Model yang dapat dipakai ulang:** `product_catalog` dan `stok_gudang` untuk katalog/ketersediaan, `sales_pelanggan` untuk pelanggan B2B, `penjualan` untuk Sales Order, `transaksi` untuk status faktur, serta pola RFQ (`sales_website_rfq`) sebagai kunci yang hanya ditulis server lalu ditinjau tim sales.
- **Celah yang harus dirancang:** sales order existing hanya satu baris produk dan belum memiliki identitas akun customer; transaksi keuangan tidak menyimpan ID pelanggan; harga katalog berupa teks; belum ada layanan email, penyimpanan privat bukti bayar, atau notifikasi customer.
- **Risiko:** menyimpan customer di store RBAC dapat mendorong keluar sesi karyawan karena batas 200 sesi, membesarkan sinkronisasi RBAC ke Firebase, dan membuka data customer kepada peran developer melalui sinkronisasi. Cookie internal HTTPS memakai `SameSite=None` tanpa pemeriksaan CSRF/Origin; ini temuan keamanan existing yang perlu ditutup terpisah.
- **Rekomendasi awal:** store, sesi dan cookie customer terpisah; API `/api/customer/*` dengan scoping `customerId` di server; pesanan portal masuk antrean khusus server lalu dikonversi oleh tim sales menjadi Sales Order. Tidak ada kode, data, Firebase atau VPS yang diubah dalam audit ini.

### 24 November 2026 — rancangan Customer Portal tahap 2 (lokal)

- **Keputusan pengguna:** Firebase Email/Password untuk verifikasi dan reset, transfer manual dengan unggah bukti, checkout berbasis penawaran sales, checkout setelah akun ditautkan ke pelanggan B2B, dan URL `/akun`.
- **Rencana kerja:** [customer-portal.md](./customer-portal.md) menjadi dokumen induk berisi status tahap, arsitektur, API, migrasi/rollback, matriks uji, risiko, dan tindakan yang masih diperlukan.
- **Tinjauan rancangan:** 9 temuan blocking dicocokkan dengan kode, lalu dimasukkan ke rancangan. Revisinya mencakup pembatasan provider Firebase wajib, relasi faktur melalui `penjualanId` (bukan nomor faktur yang dapat bentrok), konversi Sales Order idempoten di server, validasi kredit agregat, pelunasan finance otoritatif, guard sync untuk data portal, pemeriksaan Origin pada mutasi staf, sinkron pencabutan sesi Firebase, dan batas pembatalan.
- **Batasan:** hanya dokumentasi. Tidak ada kode, data, Firebase atau VPS yang diubah. Alur retur/refund, pelunasan sebagian, dan jurnal penerimaan otomatis belum didukung ERP dan berada di luar lingkup awal.

### 24 November 2026 — implementasi autentikasi Customer Portal (lokal)

- Store dan sesi customer terpisah dari RBAC, API autentikasi/profil, verifikasi provider Google untuk jalur internal, serta halaman masuk/daftar/verifikasi/lupa sandi telah diimplementasikan. Flag tetap nonaktif secara bawaan.
- Regresi penuh 40 file / 478 tes lulus; tambahan kasus batas server diverifikasi dalam tes terarah 3 file / 40 tes. TypeScript, lint rules dan build lulus. Browser dengan identitas Firebase sintetis memeriksa alur autentikasi, profil tersimpan setelah reload, logout dan responsivitas.
- Bukti, rincian perubahan dan daftar pekerjaan tersisa ada di [riwayat Customer Portal](./customer-portal.md#24-november-2026--implementasi-autentikasi-lokal). Tidak ada aktivasi Firebase, deploy, atau transaksi customer nyata. Dashboard transaksi/integrasi belum tersedia dan produksi tetap **NO-GO**.

### 24 November 2026 — fondasi Customer Dashboard tahap 4 (lokal)

- Ringkasan, navigasi, katalog terbit, pencarian/filter, keranjang server dan alamat pengiriman telah ditambahkan pada portal `/akun`.
- Katalog berasal dari snapshot CMS yang terbit; keranjang dan alamat disimpan terpisah per customer pada store portal versi 2, dengan migrasi aman dari versi 1.
- Validasi terarah `customer-auth.test.ts` lulus 23 tes, termasuk isolasi keranjang/alamat antar-customer. `npm run lint` dan `npm run build` lulus.
- Pengajuan pesanan, penawaran, invoice, bukti bayar, notifikasi transaksi dan keputusan ERP masih terbuka pada Tahap 4/5. Portal tetap default-off dan belum diaktifkan.

### 24 November 2026 — deployment staging Linux

- [x] ✅ **Staging Linux:** commit `fe6b256` di-deploy ke service `ams`; pengguna melaporkan lint, lint rules, 40 file / 481 tes dan build staging lulus.
- [x] ✅ **Pemeriksaan dasar:** health lokal dan publik aktif, Firebase Admin terhubung ke project staging `ams-integrated-system-2b9e2` dan database `(default)`; beranda dan `/web` setelah redirect merespons HTTP 200.
- [x] ✅ **Snapshot lokal:** perubahan `public/website-published.json` dipertahankan dan salinan disimpan sebelum fast-forward.
- [ ] Customer Portal masih nonaktif; Firebase Email/Password nyata, alur portal, login karyawan dan fungsi website setelah deployment belum dibuktikan pada tahap ini. Produksi tetap **NO-GO**.

### 24 November 2026 — penyempurnaan katalog Customer Dashboard (lokal)

- [x] ✅ Detail katalog, pencarian SKU, pemilihan varian eksplisit dan edit alamat ditambahkan. Label stok dan harga tidak mengklaim data live; tetap meminta konfirmasi sales.
- [x] ✅ `customer-auth.test.ts` lulus 24 tes dan TypeScript lulus, termasuk SKU search, detail produk, produk unpublished, edit alamat dan isolasi customer.
- [ ] Perubahan penyempurnaan ini masih lokal, belum commit/push/deploy. Fitur pemesanan/tagihan/notifikasi masih menunggu Tahap 5; portal staging tetap nonaktif.

### 24 November 2026 — API awal integrasi akun ERP Customer Portal (lokal)

- [x] ✅ Endpoint staf `GET /api/erp/portal/customers`, `POST .../:id/tautkan`, dan `POST .../:id/tangguhkan` ditambahkan; sesi karyawan dan `sales-marketing:view/update` diwajibkan. Mutasi juga mewajibkan Origin yang sama.
- [x] ✅ Tautan mengacu pada master B2B `sales_pelanggan` dari store server, menolak ID tidak unik/tidak aktif, email belum diverifikasi, serta pelanggan yang sudah tertaut ke akun lain. Penangguhan mencabut sesi portal; audit mencatat username pelaku tanpa email customer.
- [x] ✅ Tes terarah customer portal lulus 25 tes; regresi penuh lulus 40 file / 483 tes, `npm run lint`, dan `npm run build`.
- [ ] Masih lokal; tidak ada UI staf, aktivasi ulang akun, order/penawaran, Sales Order, invoice/pembayaran, perubahan Firebase atau deploy. Portal tetap nonaktif, P0-02 terbuka, dan produksi tetap **NO-GO**.

### 24 November 2026 — deploy dan aktivasi Customer Portal di staging Linux

- [x] ✅ **Staging Linux:** commit `5b273a2` di-deploy ke service `ams`; pengguna melaporkan `npm ci`, lint, tes staging, dan `build:staging` selesai, service `active`.
- [x] ✅ **Flag portal staging:** `CUSTOMER_PORTAL_ENABLED="true"` di `.env.staging`. Pemeriksaan publik `https://erp.remediams.com/api/customer/status` menunjukkan `enabled: true`, `authAvailable: true`; `/akun` merespons 200 dan `GET /api/erp/portal/customers` tanpa sesi ditolak 401.
- [ ] Registrasi customer masih `false` karena `CUSTOMER_PRIVACY_URL`, `CUSTOMER_TERMS_URL`, dan `CUSTOMER_PRIVACY_VERSION` belum diisi dengan halaman kebijakan yang sah.
- [ ] Belum dibuktikan: login customer nyata (Email/Password Firebase), alur akun/keranjang/alamat di browser, login karyawan setelah deploy, dan rollback flag. Order/invoice/pembayaran belum tersedia; produksi tetap **NO-GO**.

### Format pembaruan berikutnya

Salin format berikut untuk setiap evaluasi baru; jangan menghapus baseline.

```text
Tanggal:
Commit dan lingkungan:
Perubahan / ID temuan:
Status sebelumnya → status baru:
Hasil tes dan bukti aman:
Temuan baru / risiko tersisa:
Penanggung jawab dan persetujuan:
Keputusan GO / NO-GO dan alasan:
```

## 9. Rencana kerja perbaikan menyeluruh

**Disusun:** 23 November 2026. **Status:** fase 0 dan 1 masih parsial setelah deploy staging; hasil dan batasnya dicatat pada riwayat evaluasi.

Prioritas utama adalah memungkinkan administrator membuat dan menyimpan akun pengguna baru dengan peran aktif, sehingga pengguna dapat login dan membantu evaluasi **di staging**. Pada kandidat `5780a4f`, pembuatan akun, pengaturan peran dan login username/kata sandi sudah tersedia dalam kode, tetapi alurnya belum terbukti end-to-end di VPS. Penyimpanan RBAC berada di server; keberhasilan sinkronisasi ke Firebase perlu diverifikasi tersendiri.

### Fase 0 — Pengamanan sebelum pengujian akun

- Cadangkan data staging dan konfigurasi yang diperlukan secara aman; uji pemulihan pada lingkungan terisolasi.
- Pastikan akun administrator yang sudah berfungsi tetap dapat digunakan. Catat commit dan kondisi awal; gunakan akun serta data uji, bukan data produksi.
- Perbaiki terlebih dahulu risiko file RBAC rusak yang dapat digantikan state baru (**P0-01**, bagian RBAC).

**Kriteria selesai:** backup dapat dipulihkan, administrator tetap dapat login, dan file RBAC rusak tidak ditimpa diam-diam.

**Penjadwalan:** atas permintaan pengguna, uji restore lengkap dan login dari backup ditunda sampai setelah fase lain selesai. Fase ini tetap parsial sampai kriteria tersebut terbukti.

### Fase 1 — Akun pengguna dan peran aktif — prioritas utama

1. Telusuri dan uji alur administrator membuat akun, memilih peran, mengaktifkan akun dan menyimpan.
2. Pastikan pengguna baru dapat login dengan username dan kata sandi, mengganti kata sandi, logout dan login kembali.
3. Uji perubahan peran, penonaktifan, reset kata sandi, pencabutan sesi dan perlindungan administrator terakhir.
4. Uji akses setiap peran di antarmuka **dan server**, termasuk penolakan akses yang tidak diizinkan.
5. Uji persistensi akun/peran setelah refresh, penggunaan browser lain dan restart service; tampilkan kesalahan penyimpanan dengan jelas.
6. Verifikasi pemulihan akun dan peran dari backup, serta kejelasan status sinkronisasi Firebase.
7. Tinjau keunikan email dan login Google untuk akun yang didaftarkan. Login Google tidak boleh otomatis memberi hak administrator kepada staf.
8. Tentukan dan terapkan pembatasan hak baca data sinkronisasi di server dan WebSocket, termasuk data self-service (**P0-05**).

**Kriteria selesai:** administrator membuat akun uji untuk beberapa peran; masing-masing berhasil login, hanya memperoleh izin yang ditetapkan, tetap tersedia setelah restart dan tidak dapat login setelah dinonaktifkan. Akun yang gagal disimpan tidak boleh dilaporkan berhasil.

**Hasil yang diharapkan:** pengguna yang ditunjuk dapat mulai membantu evaluasi di staging dengan data sintetis. Penyelesaian fase ini belum berarti aplikasi siap produksi.

### Fase 2 — Integritas data dan sinkronisasi

- Selesaikan perlindungan file state dan indeks media yang rusak (**P0-01**).
- Verifikasi UI dua pengguna/tab dan staging untuk konflik, operasi administratif serta rekonsiliasi draf (**P0-02**).
- Uji dua pengguna, kehilangan jaringan, reconnect, restart dan kegagalan penyimpanan.
- Pastikan kegagalan sinkronisasi terlihat dan perubahan tidak hilang atau tertimpa tanpa peringatan.

**Kriteria selesai:** skenario konflik dan pemulihan lulus dengan bukti; data tidak hilang secara diam-diam.

### Fase 3 — Audit dan keamanan

- Rekam pelaku sebenarnya, perubahan dan waktu pada aktivitas bisnis di server; selesaikan cakupan/ekspor audit portal serta retensi dan verifikasi P0-03.
- Analisis dan tangani advisory dependensi tanpa menggunakan `npm audit fix --force` (**P1-01**).
- Tinjau security headers, CORS, proteksi permintaan lintas situs dan rate limit (**P1-02–03**).
- Verifikasi rules Firebase yang terpasang, daftar administrator dan akses setiap peran (**P1-04**).
- Susun kebijakan data pribadi dan persetujuan terkait (**P1-08**).

**Kriteria selesai:** tes akses dan audit lulus, temuan keamanan diselesaikan atau diterima secara tertulis, serta konfigurasi target diverifikasi.

### Fase 4 — Integrasi internal dan evaluasi modul

- Jalankan smoke test 13 modul pada bagian 6.
- Uji lengkap empat form Pengadaan, termasuk simpan, buka ulang, persetujuan dan PDF.
- Lakukan walkthrough bersama divisi: **penerimaan → QC → stok → penjualan → faktur → jurnal → pembayaran**.
- Catat perpindahan data yang benar-benar otomatis dan langkah yang masih manual.

**Kriteria selesai:** setiap modul memiliki hasil uji dan bukti; kuantitas serta nilai pada walkthrough cocok dan masalah penting ditutup.

### Fase 5 — Data asli, cadangan dan operasional

- Inventarisasi data contoh; rencanakan pembersihan hanya setelah backup dan persetujuan (**P1-05**).
- Latih migrasi data asli dan rekonsiliasi di staging (**P1-06**).
- Uji backup otomatis, rollback, monitoring dan respons insiden (**P0-04, P1-07**). Uji restore lengkap dan login dari backup ditunda sesuai catatan pada riwayat evaluasi.
- Lakukan load test hanya dengan persetujuan: target checklist **50 pengguna, tanpa 5xx, respons < 2 detik** (**P1-09**).

**Kriteria selesai:** restore dan rollback terbukti; rekonsiliasi saldo berselisih nol dan jumlah record memenuhi toleransi checklist; monitoring dan penanggung jawab operasional siap.

### Fase 6 — Persetujuan dan go-live

- PJT, QA, pemilik modul dan IT meninjau bukti serta risiko tersisa.
- Dokumentasikan pengecualian API pemerintah dan SOP manual yang disetujui. Alarm suhu dan notifikasi darurat tetap memerlukan solusi yang andal.
- Setujui cutover, rollback, pelatihan dan hypercare.
- Putuskan GO/NO-GO; lakukan smoke test dan rekonsiliasi ulang setelah cutover.

**Kriteria selesai:** keputusan dan persetujuan tercatat, seluruh prasyarat yang diwajibkan terbukti, dan pemeriksaan pasca-cutover dilakukan. Jika belum terpenuhi, keputusan tetap NO-GO.

### Fase 7 — Integrasi pemerintah

Dikerjakan **setelah integrasi internal optimal**: tentukan kebutuhan, dapatkan akses resmi, uji sandbox dan validasi payload, siapkan monitoring, lalu minta persetujuan sebelum koneksi produksi. Sampai saat itu, jalankan kewajiban melalui prosedur manual yang disetujui.

**Kriteria selesai:** masing-masing integrasi yang dipilih memiliki hasil uji, persetujuan, monitoring dan bukti penggunaan pada lingkungan yang sesuai. Fase ini ditunda dari produksi awal sesuai pengecualian yang disetujui.

## 10. Perbandingan kondisi sebelum dan sesudah

Kolom **sebelum** adalah baseline 23 November 2026 untuk commit `5780a4f`. Kolom **sesudah** memuat hasil yang telah dilaporkan atau diverifikasi, termasuk hasil parsial; perbarui dengan tanggal, commit, lingkungan dan bukti aman di riwayat evaluasi. Catat hasil staging dan produksi secara terpisah. Jika gagal atau baru sebagian, tulis hasil sebenarnya dan risiko tersisa; jangan mengubahnya menjadi lulus.

| Area / fase | Sebelum — baseline | Sesudah — hasil terverifikasi | Langkah berikutnya / bukti |
|---|---|---|---|
| Backup dan RBAC rusak — fase 0 | Restore belum terbukti; file RBAC rusak berisiko ditimpa state baru | **Parsial:** RBAC diperbaiki dan di-deploy; hash arsip Windows cocok dengan VPS, ekstraksi dan integritas empat berkas diuji lokal | Cadangkan Firestore/konfigurasi; restore lengkap dan login terisolasi ditunda sampai fase lain selesai, sebelum GO produksi |
| Pembuatan akun dan login — fase 1 | Kode tersedia dan admin berhasil login; akun baru belum diuji end-to-end di VPS | **Staging, parsial:** pengguna berhasil membuat dan login satu akun uji | Uji beberapa akun/peran serta penanganan kegagalan di staging |
| Peran dan status akun — fase 1 | Pengaturan peran tersedia dalam kode; hak setiap peran dan penonaktifan di VPS belum terbukti | **Staging, parsial:** peran satu akun uji masih sesuai setelah restart; penonaktifan dan penolakan akses diuji lokal | Uji matriks izin dan penonaktifan setiap peran di UI/server VPS |
| Logout dan sesi — fase 1 | Logout developer menghapus cookie tetapi tidak mencabut sesi server; kegagalan logout tidak diberitahukan | **Staging, parsial:** `70463e8` di-deploy; pengguna berhasil logout dan login ulang setelah hard refresh; pencabutan sesi diuji lokal | Uji penolakan token lama serta kondisi kegagalan pada staging secara aman |
| Hak baca dan tulis HRIS — fase 1 | Hak setiap peran di server belum terbukti | **Lokal, parsial:** pembatasan HTTP/WebSocket, proyeksi, identitas, peran, cuti, purge/reset dan media diuji dengan data sintetis; verifikasi lengkap lokal 353 tes lulus. Perubahan lanjutan belum di-deploy; P0-05 tetap terbuka | Tutup akses Firebase/hydrate serta risiko cache/offline, tinjau ekspor dan validasi matriks peran di staging terisolasi |
| Persistensi akun dan Firebase — fase 1 | RBAC disimpan di server; sinkronisasi Firebase dan pemulihan akun belum terbukti end-to-end | **Staging, parsial:** satu akun dan perannya bertahan setelah restart; Firebase Admin dilaporkan terhubung. **Lokal:** dukungan `employeeId` di rules/blueprint dan hydrate diperbaiki, belum diuji pada Firebase | Bandingkan rules target dan uji emulator, sinkronisasi akun serta pemulihan Firebase sebenarnya; restore lengkap tetap ditunda |
| State dan media rusak — fase 2 | Fallback file state dan indeks media dapat menulis state kosong jika file rusak atau tidak valid | **Lokal, parsial:** loader menolak file rusak dan file hilang dengan `.tmp`, indeks hilang dengan unggahan, serta media tanpa metadata; state tidak menimpa `.tmp`. 41 file / 515 tes, TypeScript dan build lulus; belum di-deploy atau diuji terhadap data historis VPS | Verifikasi kompatibilitas dan pemulihan media/backup terisolasi; tangani kehilangan tanpa jejak, `.tmp` indeks saat penulisan, dan pemadaman |
| Sinkronisasi dan konflik — fase 2 | Jalur sync yang diperiksa tidak memeriksa versi yang diharapkan; perubahan bersamaan berisiko tertimpa | **Lokal, parsial:** PUT/DELETE/batch, purge dengan expected versions per key, reset dengan expected global revision dan penanganan cache klien diuji; 40 file / 500 tes, TypeScript dan build lulus. Staging/UI dua editor belum diuji | Lakukan uji UI lintas tab/pengguna dan staging yang disetujui; verifikasi rekonsiliasi draf sebelum menutup P0-02 |
| Audit — fase 3 | Sebagian aktivitas memakai identitas tetap; audit RBAC dibatasi 500 entri | **Lokal, parsial:** RBAC menyimpan seluruh event dengan salinan arsip JSONL bulanan dan ekspor berizin; audit Customer Portal menulis arsip bulanan dan memigrasi file legacy tanpa menghapusnya. 40 file / 506 tes, lint, build lulus. Audit bisnis klien masih dibatasi 100 entri dan memuat aktor/peran statis; staging belum diverifikasi | Pindahkan audit bisnis kritis ke server dengan identitas sesi, lengkapi ekspor/rekonsiliasi, lalu uji retensi dan restore pada staging |
| Keamanan dan dependensi — fase 3 | Audit runtime: 4 high; sejumlah header belum terverifikasi; kontrol akses dan rules target belum seluruhnya diverifikasi | **Parsial:** template proxy memiliki sebagian header, tetapi CSP/konfigurasi aktif belum terbukti | Terapkan header konsisten; CSP Report-Only lalu enforce setelah uji Firebase, API, WebSocket dan media; verifikasi respons target |
| Privasi — fase 3 | Kebijakan, retensi dan persetujuan belum dibuktikan | Belum dijalankan | Selesaikan P1-08 dan catat persetujuan |
| Modul dan alur internal — fase 4 | Tes lokal lulus; walkthrough lintas modul dan smoke test menyeluruh belum terbukti | Belum dijalankan | Jalankan 13 smoke test dan walkthrough; catat hasil per modul |
| Empat form Pengadaan — fase 4 | Empat form tampil; workflow lengkap dan persistensi belum diuji | Belum dijalankan | Uji penyimpanan, buka ulang, persetujuan dan PDF |
| Data dan migrasi — fase 5 | Status data contoh belum dibuktikan; migrasi dan rekonsiliasi belum diuji | **Belum dijalankan:** JSON per koleksi masih menjadi sumber; PostgreSQL belum menjadi driver aplikasi. POC impor saldo awal diputuskan terisolasi di lokal dengan PGlite; menunggu workbook template, belum ada skema/impor/data yang dijalankan | Periksa template dan tetapkan pemetaan/kunci unik; uji preview, duplikasi, validasi baris, audit dan commit atomik. POC tidak menjadi dual-write; integrasi stok kanonis dan operasi PostgreSQL perlu keputusan terpisah |
| Refactor monolit/dialog — fase 4–5 | Tiga file source besar dan pemanggilan dialog browser ditemukan lewat pemeriksaan statis lokal | **Belum dijalankan:** 10 `alert`/`confirm`, 8 file; Modal dasar tersedia | Ekstrak router/service dan komponen per domain dengan tes regresi; perbaiki aksesibilitas Modal dan ganti dialog bertahap |
| Operasional dan performa — fase 5 | Monitoring berkelanjutan, rollback dan load test belum terbukti | Belum dijalankan | Uji alert, restore, rollback dan target beban setelah disetujui |
| Keputusan produksi — fase 6 | **NO-GO** untuk produksi penuh | Belum dievaluasi ulang | Tinjau bukti, risiko dan persetujuan PJT/QA/manajemen |
| API pemerintah — fase 7 | Ditunda; koneksi bukan syarat otomatis produksi awal | Belum dijalankan | Dokumentasikan pengecualian dan SOP manual; tinjau integrasi setelah internal optimal |

### Perbandingan prioritas website

Kolom **sebelum** merujuk perilaku yang ditemukan sebelum perbaikan website di worktree berbasis `8d132d4`, bukan pemeriksaan ulang staging baseline `5780a4f`. Kolom **sesudah** hanya menyatakan hasil lokal pada skenario yang diuji.

| Area website | Sebelum | Sesudah — lokal, parsial | Masih diperlukan |
|---|---|---|---|
| Draf CMS | Sinkronisasi dapat memakai draf tersimpan lama dan mengabaikan suntingan aktif; hasil simpan menyiratkan server sudah tersinkron | Suntingan aktif dipakai, status simpan lokal dijelaskan dan konflik draf ditampilkan; unggah logo tidak memicu konflik palsu pada uji browser | Uji semua seksi, beberapa editor dan kondisi offline/reconnect |
| Publikasi dan hak editor | Status tayang dapat diklaim sebelum server mengonfirmasi; kontrol editor untuk peran baca saja belum memadai | Terbit/tahan menunggu konfirmasi; timeout memberi status tidak pasti; kontrol peran baca dinonaktifkan pada uji browser | Uji matriks peran dan jalur publikasi pada Linux staging |
| RFQ pengunjung | Form mencatat prospek di perangkat pengunjung tanpa bukti diterima server | Server memvalidasi dan menyimpan RFQ; retry skenario yang diuji memakai ID sama dan muncul pada prospek | Uji backup Firebase nyata, retensi, batas ukuran dan alur komersial lengkap |
| Snapshot dan sinkronisasi | Snapshot tidak lengkap dan salinan berkas dapat menyebabkan ketidaksesuaian; cache lama dapat tampil saat publikasi belum ada | Struktur penting divalidasi, server menjadi sumber utama dan salinan diperbarui setelah simpan; tanpa snapshot inline, cache lokal menunggu pemeriksaan jaringan dan 404 otoritatif tidak memakainya | Uji data historis, pemulihan, reset/penghapusan dan fallback berkas |
| Media dan performa | Unggah media dapat menimbulkan konflik palsu; respons tak lengkap dapat dianggap berhasil; kegagalan pencadangan Firebase yang dicoba tidak dilaporkan | Logo terunggah dan tampil ke pengunjung; konfirmasi tidak valid mempertahankan antrean, kegagalan audit setelah simpan diperingatkan, dan kegagalan pencadangan yang dicoba dicatat. Pengunjung bersih tidak memuat bundle ERP/Firebase pada uji mobile | Tambahkan pemulihan/visibilitas kegagalan backup dan ukur performa serta media di jaringan dan VPS nyata |

Setelah setiap fase atau evaluasi, tampilkan perbandingan ini kepada pengguna dan cantumkan:

1. Apa yang berubah, apa yang masih terbuka dan bukti pengujiannya.
2. Perbedaan status staging dan produksi, termasuk perubahan yang belum di-deploy.
3. Risiko atau hambatan baru serta prioritas berikutnya yang disarankan.
4. Keputusan apakah urutan rencana perlu disesuaikan; jangan menurunkan prioritas P0 tanpa alasan dan persetujuan yang terdokumentasi.
