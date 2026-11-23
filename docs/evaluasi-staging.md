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
| P0-01 | **File rusak dapat ditimpa state kosong.** Loader state, RBAC dan indeks media pada baseline menggunakan fallback baru saat file tidak terbaca atau bentuknya tidak valid. Ini temuan kode, bukan bukti bahwa file VPS rusak. Lihat [dataSyncStore.ts](../server/dataSyncStore.ts), [rbacStore.ts](../server/rbacStore.ts) dan [mediaStore.ts](../server/mediaStore.ts). | Dalam pengerjaan: RBAC diperbaiki dan diuji lokal pada worktree rilis; belum di-deploy. State dan media masih terbuka. | Sistem gagal secara jelas, mempertahankan file bermasalah dan mendukung pemulihan aman; tes mencakup file rusak, file tidak valid dan file baru. |
| P0-02 | **Perubahan bersamaan berisiko tertimpa.** Pada jalur sync yang diperiksa, nilai koleksi dikirim dan diganti tanpa pemeriksaan versi yang diharapkan. Versi dicatat tetapi belum mencegah konflik. Lihat [pocketbase.ts](../src/services/pocketbase.ts) dan [dataSyncStore.ts](../server/dataSyncStore.ts). | Terbuka | Mekanisme konflik yang aman dan uji dua pengguna, termasuk offline/reconnect, membuktikan tidak ada perubahan hilang atau tertimpa tanpa peringatan. |
| P0-03 | **Identitas pada sebagian audit bisnis tidak dapat dipercaya.** Contoh pencatatan faktur dan perubahan CoA menggunakan identitas/role tetap, bukan selalu identitas pelaku login. Audit RBAC server dibatasi 500 entri. Lihat [pocketbase.ts](../src/services/pocketbase.ts) dan [rbacStore.ts](../server/rbacStore.ts). | Terbuka | Pelaku sebenarnya, waktu dan perubahan tercatat; cakupan aksi, retensi dan pemulihan audit diuji serta disetujui. |
| P0-04 | **Backup dan restore belum terbukti.** Data tidak hanya berada di Firebase: ada state server, RBAC, indeks dan file media, konfigurasi/identitas terkait, serta kemungkinan antrean browser. | Terbuka | Backup konsisten, terenkripsi dan tersimpan di luar VPS; restore lengkap diuji pada lingkungan terisolasi, termasuk rekonsiliasi data dan akses. |

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

**Disusun:** 23 November 2026. **Status:** fase 0 dan 1 dimulai secara lokal; hasil dan batasnya dicatat pada riwayat evaluasi.

Prioritas utama adalah memungkinkan administrator membuat dan menyimpan akun pengguna baru dengan peran aktif, sehingga pengguna dapat login dan membantu evaluasi **di staging**. Pada kandidat `5780a4f`, pembuatan akun, pengaturan peran dan login username/kata sandi sudah tersedia dalam kode, tetapi alurnya belum terbukti end-to-end di VPS. Penyimpanan RBAC berada di server; keberhasilan sinkronisasi ke Firebase perlu diverifikasi tersendiri.

### Fase 0 — Pengamanan sebelum pengujian akun

- Cadangkan data staging dan konfigurasi yang diperlukan secara aman; uji pemulihan pada lingkungan terisolasi.
- Pastikan akun administrator yang sudah berfungsi tetap dapat digunakan. Catat commit dan kondisi awal; gunakan akun serta data uji, bukan data produksi.
- Perbaiki terlebih dahulu risiko file RBAC rusak yang dapat digantikan state baru (**P0-01**, bagian RBAC).

**Kriteria selesai:** backup dapat dipulihkan, administrator tetap dapat login, dan file RBAC rusak tidak ditimpa diam-diam.

### Fase 1 — Akun pengguna dan peran aktif — prioritas utama

1. Telusuri dan uji alur administrator membuat akun, memilih peran, mengaktifkan akun dan menyimpan.
2. Pastikan pengguna baru dapat login dengan username dan kata sandi, mengganti kata sandi, logout dan login kembali.
3. Uji perubahan peran, penonaktifan, reset kata sandi, pencabutan sesi dan perlindungan administrator terakhir.
4. Uji akses setiap peran di antarmuka **dan server**, termasuk penolakan akses yang tidak diizinkan.
5. Uji persistensi akun/peran setelah refresh, penggunaan browser lain dan restart service; tampilkan kesalahan penyimpanan dengan jelas.
6. Verifikasi pemulihan akun dan peran dari backup, serta kejelasan status sinkronisasi Firebase.
7. Tinjau keunikan email dan login Google untuk akun yang didaftarkan. Login Google tidak boleh otomatis memberi hak administrator kepada staf.

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
- Uji backup otomatis, restore lengkap, rollback, monitoring dan respons insiden (**P0-04, P1-07**).
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

Kolom **sebelum** adalah baseline 23 November 2026 untuk commit `5780a4f`. Kolom **sesudah** belum merupakan hasil: perbarui setiap kali pekerjaan selesai dan diverifikasi, dengan tanggal, commit, lingkungan dan bukti aman. Catat hasil staging dan produksi secara terpisah. Jika gagal atau baru sebagian, tulis hasil sebenarnya dan risiko tersisa; jangan mengubahnya menjadi lulus. Simpan riwayat evaluasi pada bagian 8.

| Area / fase | Sebelum — baseline | Sesudah — hasil terverifikasi | Langkah berikutnya / bukti |
|---|---|---|---|
| Backup dan RBAC rusak — fase 0 | Restore belum terbukti; file RBAC rusak berisiko ditimpa state baru | **Parsial:** RBAC diperbaiki dan salinan sintetis diuji lokal; arsip data terenkripsi VPS terbaca, service aktif dan pengguna melaporkan salinan di Windows | Verifikasi hash salinan, cadangkan Firestore/konfigurasi dan uji restore lengkap terisolasi |
| Pembuatan akun dan login — fase 1 | Kode tersedia dan admin berhasil login; akun baru belum diuji end-to-end di VPS | **Lokal, parsial:** uji API membuat akun dan login lulus; perubahan belum di-deploy | Uji antarmuka, beberapa akun/peran dan kegagalan di staging setelah deployment disetujui |
| Peran dan status akun — fase 1 | Pengaturan peran tersedia dalam kode; hak setiap peran dan penonaktifan di VPS belum terbukti | **Lokal, parsial:** role uji, penolakan akses, penonaktifan dan pencabutan sesi lulus | Uji matriks izin setiap peran di UI/server dan restart pada VPS |
| Persistensi akun dan Firebase — fase 1 | RBAC disimpan di server; sinkronisasi Firebase dan pemulihan akun belum terbukti end-to-end | **Lokal, parsial:** salinan data sintetis terbaca setelah restart; status pengiriman Firebase diperjelas dalam kode | Uji browser lain, restart VPS, restore lengkap dan sinkronisasi Firebase sebenarnya |
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

Setelah setiap fase atau evaluasi, tampilkan perbandingan ini kepada pengguna dan cantumkan:

1. Apa yang berubah, apa yang masih terbuka dan bukti pengujiannya.
2. Perbedaan status staging dan produksi, termasuk perubahan yang belum di-deploy.
3. Risiko atau hambatan baru serta prioritas berikutnya yang disarankan.
4. Keputusan apakah urutan rencana perlu disesuaikan; jangan menurunkan prioritas P0 tanpa alasan dan persetujuan yang terdokumentasi.
