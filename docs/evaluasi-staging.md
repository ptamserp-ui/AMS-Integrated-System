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

Jangan menyimpan kata sandi, token, isi environment, service-account JSON, data pribadi, atau log berisi rahasia dalam dokumen atau bukti yang dirujuk.

## 1. Lingkup dan kesimpulan awal

API pihak pemerintah tidak langsung dihubungkan pada fase produksi awal. Integrasi dilakukan setelah integrasi internal optimal. Penundaan API pemerintah **bukan alasan NO-GO** pada evaluasi ini, tetapi tidak menghapus kewajiban operasional dan pelaporan yang berlaku.

Alasan NO-GO adalah risiko integritas data dan jejak audit yang ditemukan pada kode, hasil audit dependensi, serta belum adanya bukti yang memadai untuk backup/restore, migrasi, pengujian lintas modul, keamanan dan persetujuan operasional. Keputusan produksi harus ditinjau kembali berdasarkan bukti terbaru oleh manajemen, PJT, QA dan penanggung jawab teknis.

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

Temuan kode berikut mengacu pada commit `5780a4f`. Tautan source di bawah menunjuk path dalam repository; saat evaluasi berikutnya periksa commit yang tepat karena isi worktree dapat berubah.

### P0 — harus ditangani sebelum produksi

| ID | Temuan awal | Status | Kriteria penyelesaian |
|---|---|---|---|
| P0-01 | **File rusak dapat ditimpa state kosong.** Loader state, RBAC dan indeks media pada baseline menggunakan fallback baru saat file tidak terbaca atau bentuknya tidak valid. Ini temuan kode, bukan bukti bahwa file VPS rusak. Lihat [dataSyncStore.ts](../server/dataSyncStore.ts), [rbacStore.ts](../server/rbacStore.ts) dan [mediaStore.ts](../server/mediaStore.ts). | Dalam pengerjaan: perbaikan RBAC diuji lokal dan di-deploy ke staging; state dan media masih terbuka. | Sistem gagal secara jelas, mempertahankan file bermasalah dan mendukung pemulihan aman; tes mencakup file rusak, file tidak valid dan file baru. |
| P0-02 | **Perubahan bersamaan berisiko tertimpa.** Pada jalur sync yang diperiksa, nilai koleksi dikirim dan diganti tanpa pemeriksaan versi yang diharapkan. Versi dicatat tetapi belum mencegah konflik. Lihat [pocketbase.ts](../src/services/pocketbase.ts) dan [dataSyncStore.ts](../server/dataSyncStore.ts). | Terbuka | Mekanisme konflik yang aman dan uji dua pengguna, termasuk offline/reconnect, membuktikan tidak ada perubahan hilang atau tertimpa tanpa peringatan. |
| P0-03 | **Identitas pada sebagian audit bisnis tidak dapat dipercaya.** Contoh pencatatan faktur dan perubahan CoA menggunakan identitas/role tetap, bukan selalu identitas pelaku login. Audit RBAC server dibatasi 500 entri. Lihat [pocketbase.ts](../src/services/pocketbase.ts) dan [rbacStore.ts](../server/rbacStore.ts). | Terbuka | Pelaku sebenarnya, waktu dan perubahan tercatat; cakupan aksi, retensi dan pemulihan audit diuji serta disetujui. |
| P0-04 | **Backup dan restore belum terbukti.** Data tidak hanya berada di Firebase: ada state server, RBAC, indeks dan file media, konfigurasi/identitas terkait, serta kemungkinan antrean browser. | Terbuka | Backup konsisten, terenkripsi dan tersimpan di luar VPS; restore lengkap diuji pada lingkungan terisolasi, termasuk rekonsiliasi data dan akses. |
| P0-05 | **Data sinkronisasi belum dibatasi berdasarkan hak baca peran.** Pada kandidat `d862ef7`, `GET /api/sync/state` mengembalikan seluruh state kepada pengguna yang terautentikasi, dan broadcast WebSocket mengirim pembaruan lengkap kepada klien terautentikasi tanpa memeriksa hak baca peran. Ini temuan kode, bukan bukti akses atau kebocoran aktual. | Dalam pengerjaan, parsial: perbaikan server telah diuji lokal, tetapi jalur Firebase, cache dan staging masih terbuka. | Tetapkan kebijakan akses per koleksi dan data pribadi; terapkan dan uji pembatasan pada HTTP dan WebSocket, termasuk perubahan peran/sesi serta kebutuhan self-service. |

Jangan melakukan purge, reset, migrasi atau cutover data tanpa backup yang tervalidasi, rencana pemulihan dan persetujuan yang diperlukan.

### P1 — harus ditutup atau diterima secara tertulis sebelum go-live

| ID | Temuan awal | Status | Kriteria penyelesaian |
|---|---|---|---|
| P1-01 | **Dependensi runtime:** dua advisory gRPC, [GHSA-m9gg-hp2v-232j](https://github.com/advisories/GHSA-m9gg-hp2v-232j) dan [GHSA-f596-whhp-79r4](https://github.com/advisories/GHSA-f596-whhp-79r4), muncul pada rantai Firebase dan dihitung sebagai 4 temuan high. Dampak aktual belum dipastikan. | Terbuka | Analisis keterpaparan dan pembaruan kompatibel atau penerimaan risiko tertulis; jalankan audit dan tes ulang. Jangan gunakan `npm audit fix --force`: npm mengusulkan perubahan Firebase yang breaking. |
| P1-02 | **Security headers** yang tercantum di atas tidak terlihat pada respons publik yang diperiksa. Redirect HTTP ke HTTPS sudah teramati. | Terbuka | Konfigurasi dan uji header pada target, termasuk kompatibilitas CSP dengan Firebase dan seluruh fitur. |
| P1-03 | **Perlindungan akses:** rate limit login tersedia dalam kode, tetapi rate limit endpoint lain, CORS, proteksi permintaan lintas situs dan hak semua peran pada VPS belum terbukti. Cookie HTTPS memakai `SameSite=None; Secure`. | Terbuka | Tinjau konfigurasi proxy dan cookie sesuai penggunaan; uji rate limit, akses tidak sah, peran dan perlindungan permintaan lintas situs. |
| P1-04 | **Rules dan admin Firebase:** rules staging pernah disesuaikan manual; [firestore.rules](../firestore.rules) pada kandidat masih memuat bootstrap lama. Pembatasan admin melalui environment tidak otomatis mencabut akun RBAC atau admin Firebase lain. | Terbuka | Verifikasi project target, rules yang benar-benar terpasang, daftar admin, RBAC dan perilaku akses. Jangan menimpa rules tanpa memastikan target. |
| P1-05 | **Data contoh:** mekanisme seed dan purge tersedia, tetapi status data staging/produksi belum dibuktikan. Nilai contoh tidak boleh menjadi dasar laporan resmi. | Terbuka | Inventaris dan verifikasi data; lakukan pembersihan hanya dengan persetujuan, backup dan rencana pemulihan; buktikan pemisahan data contoh dan nyata. |
| P1-06 | **Migrasi, rekonsiliasi dan cutover** data asli belum diuji dan ditandatangani. | Terbuka | Latihan migrasi di staging, freeze sumber saat cutover dan rekonsiliasi yang memenuhi toleransi pada bagian 7. |
| P1-07 | **Monitoring, rollback dan operasional** belum terbukti end-to-end. | Terbuka | Uji uptime/error alert, retensi log, latihan rollback/restore, penanggung jawab insiden, pelatihan dan hypercare. |
| P1-08 | **Privasi dan persetujuan** belum dibuktikan. | Terbuka | Inventaris data pribadi, dasar pemrosesan, hak subjek data, retensi, kebijakan privasi dan persetujuan PJT/QA sesuai kebutuhan organisasi. |
| P1-09 | **Alur internal dan performa** belum dibuktikan di lingkungan target. | Terbuka | Lulus smoke test 13 modul, walkthrough lintas divisi, tes konflik dan target beban dengan data sintetis serta persetujuan jadwal. |

## 4. Checklist fase A–K

| Fase | Status awal | Hal yang masih diperlukan |
|---|---|---|
| A — fondasi dan data demo | Parsial | Inventaris seed, backup, rencana dan verifikasi pembersihan |
| B — keamanan | Parsial | Rules/admin, hak peran, header, rate limit, privasi dan MFA |
| C — monitoring | Belum diverifikasi | Uptime/error alert, retensi log, prosedur alarm suhu dan recall |
| D — staging | Parsial | Ulang tes di VPS, E2E, load test dan latihan rollback |
| E — domain dan TLS | Parsial | HTTPS dan redirect aktif; HSTS dan pembaruan sertifikat otomatis belum terbukti |
| F — database dan backup | Belum diverifikasi | Pisahkan target produksi, backup otomatis, uji restore dan disaster recovery |
| G — API pemerintah | Ditunda dengan pengecualian | Persetujuan tertulis atas G1/G2 dan proses manual; G3 tidak otomatis dikecualikan |
| H — migrasi | Belum diverifikasi | Data asli, cut-off, rekonsiliasi dan persetujuan; H-IT2 ditunda |
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

1. **Tim teknis:** perbaiki risiko file rusak, konflik sync dan identitas audit; tangani temuan keamanan.
2. **IT:** buat backup terenkripsi di luar VPS dan buktikan restore lengkap di lingkungan terisolasi.
3. **Pemilik modul dan Finance:** inventaris seed, siapkan data asli dan latihan migrasi. Rekonsiliasi checklist mensyaratkan **selisih saldo nol** dan selisih jumlah record maksimal **0,01%**, dengan penjelasan tertulis.
4. **PJT, QA dan pemilik modul:** lakukan smoke test dan walkthrough, validasi SOP manual serta tandatangani hasil.
5. **Manajemen dan IT:** setujui target produksi, rencana cutover, rollback, monitoring dan hypercare. Go-live hanya setelah bukti yang diwajibkan lengkap dan pengecualian disetujui.

## 8. Riwayat evaluasi

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
- Tangani konflik perubahan bersamaan dan transaksi offline (**P0-02**).
- Uji dua pengguna, kehilangan jaringan, reconnect, restart dan kegagalan penyimpanan.
- Pastikan kegagalan sinkronisasi terlihat dan perubahan tidak hilang atau tertimpa tanpa peringatan.

**Kriteria selesai:** skenario konflik dan pemulihan lulus dengan bukti; data tidak hilang secara diam-diam.

### Fase 3 — Audit dan keamanan

- Rekam pelaku sebenarnya, perubahan dan waktu pada aktivitas bisnis; tetapkan retensi audit (**P0-03**).
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
| State dan media rusak — fase 2 | Fallback file state dan indeks media dapat menulis state kosong jika file rusak atau tidak valid | Belum dijalankan | Perbaiki P0-01 dan uji file rusak/tidak valid tanpa menimpanya |
| Sinkronisasi dan konflik — fase 2 | Jalur sync yang diperiksa tidak memeriksa versi yang diharapkan; perubahan bersamaan berisiko tertimpa | Belum dijalankan | Perbaiki P0-02 dan uji dua pengguna serta offline/reconnect |
| Audit — fase 3 | Sebagian aktivitas memakai identitas tetap; audit RBAC dibatasi 500 entri | Belum dijalankan | Perbaiki P0-03 dan buktikan pelaku, perubahan serta retensi |
| Keamanan dan dependensi — fase 3 | Audit runtime: 4 high; header yang diperiksa tidak ditemukan; kontrol akses dan rules target belum seluruhnya diverifikasi | Belum dijalankan | Tangani P1-01–04 dan uji target; catat risiko tersisa |
| Privasi — fase 3 | Kebijakan, retensi dan persetujuan belum dibuktikan | Belum dijalankan | Selesaikan P1-08 dan catat persetujuan |
| Modul dan alur internal — fase 4 | Tes lokal lulus; walkthrough lintas modul dan smoke test menyeluruh belum terbukti | Belum dijalankan | Jalankan 13 smoke test dan walkthrough; catat hasil per modul |
| Empat form Pengadaan — fase 4 | Empat form tampil; workflow lengkap dan persistensi belum diuji | Belum dijalankan | Uji penyimpanan, buka ulang, persetujuan dan PDF |
| Data dan migrasi — fase 5 | Status data contoh belum dibuktikan; migrasi dan rekonsiliasi belum diuji | Belum dijalankan | Inventaris seed, latihan migrasi dan rekonsiliasi dengan backup |
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
