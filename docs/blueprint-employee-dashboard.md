# Blueprint Pengembangan Employee Dashboard ERP

**Sistem Manajemen Karyawan Terintegrasi untuk Perusahaan Alat Kesehatan**

| Metadata | Keterangan |
| --- | --- |
| Dokumen | Functional & Technical Product Blueprint |
| Platform | Web-Based ERP Application |
| Modul | Human Resources & Employee Self-Service (ESS) |
| Industri | Medical Devices / Alat Kesehatan |
| Pengguna | Karyawan, Supervisor, Manager, HRD, Finance, dan Direksi |
| Sumber | Materi pengguna "Pasted text #1", diterima 26 November 2026 |
| Status | Rancangan pengembangan; bukan bukti implementasi lengkap atau kesiapan produksi |
| Dokumen terkait | [System Blueprint](./system-blueprint.md), [Blueprint HRIS](./blueprint-hris.md), [Evaluasi Staging](./evaluasi-staging.md) |

## Catatan pemeriksaan terhadap AMS saat ini

Bagian 1–27 merupakan materi sumber yang dirapikan menjadi Markdown. Artefak Microsoft Word/VML/CSS, baris kosong berlebih dan HTML entities dihapus atau dinormalisasi. Daftar dan tabel dipulihkan; penomoran bagian dan maksud kebutuhan dipertahankan. Catatan pemeriksaan ini merupakan tambahan, bukan klaim dari materi sumber.

| Aspek | Hasil pemeriksaan terbatas pada repository |
| --- | --- |
| HRIS desktop | [HRDModule.tsx](../src/components/modules/supporting/HRDModule.tsx) memiliki 7 tab: Core HR, Attendance, Payroll, Recruitment, Learning, Performance dan HSE. Struktur 15 menu ESS di bawah adalah target pengembangan, bukan navigasi desktop yang sudah tersedia. |
| Self-service mobile | [MobileApp.tsx](../src/components/mobile/MobileApp.tsx) memiliki profil, absensi, shift/cuti dan fitur slip gaji dengan pembatasan capability. Kondisi saat ini membatasi tab slip gaji kepada pengguna dengan `canViewAllEmployees`; akses slip pribadi untuk semua karyawan masih merupakan kebutuhan blueprint. |
| Identitas dan scope data | [dataSyncStore.ts](../server/dataSyncStore.ts) memfilter data personal berdasarkan `employeeId`: master karyawan memakai `id`, koleksi terkait memakai `karyawanId`. Self-service tulis saat ini terbatas pada absensi/cuti untuk role yang diizinkan, bukan izin mengedit seluruh profil/payroll. |
| Approval dan akses tim | Persetujuan bertingkat, delegasi dan akses berbasis tim pada dokumen ini adalah target. Jangan menganggap jabatan Supervisor/Manager otomatis memperoleh akses semua data HRIS; perlu pemetaan ke permission dan scope organisasi yang diverifikasi server. |
| Penyimpanan | Baseline yang dilaporkan berjalan adalah Linux staging, Firebase dan server sync dengan cache browser. Daftar entitas bagian 22 merupakan model konseptual, bukan tabel PostgreSQL aktif atau keputusan migrasi. |
| Integrasi dan kepatuhan | Geofencing, reminder terjadwal, payroll resmi, BPJS/DJP, aset, reimbursement, helpdesk dan integrasi KPI lintas modul tidak dinyatakan lengkap hanya karena UI/kalkulator tersedia. [Blueprint HRIS](./blueprint-hris.md) dan [evaluasi staging](./evaluasi-staging.md) mencatat batas implementasi/verifikasi. |

Hal yang perlu diselaraskan sebelum implementasi:

1. **Urutan menu:** bagian 2 menempatkan Training & Certification setelah My Assets, sedangkan uraian modul menempatkannya sebagai Modul 03. Ini perbedaan urutan presentasi, bukan modul tambahan. Tentukan urutan final saat desain UX.
2. **Single source of truth:** dashboard harus membaca data milik modul sumber melalui identitas stabil, bukan membuat master karyawan, payroll atau stok tandingan.
3. **Akses:** Administrator teknis biasa tidak otomatis memperoleh data sensitif. Developer khusus AMS bukan karyawan dan tidak disamakan dengan role staf IT; aksesnya tetap mengikuti mekanisme Developer yang sudah ada, tanpa membuat role Developer baru melalui modul karyawan.
4. **Privasi:** NIK identitas, rekening, payroll, dokumen, GPS/selfie dan informasi kesehatan memerlukan minimisasi data, akses server per objek/field, retensi dan perlindungan yang disetujui. Jangan memasukkan data personal nyata atau kredensial ke blueprint.
5. **Transaksi:** offline/antrean tidak berarti approved/paid atau sudah tersimpan server. Approval, saldo cuti, pembayaran, pinjaman dan aset memerlukan validasi server, pencegahan duplikasi dan penanganan konflik.
6. **Perhitungan:** formula pajak, lembur, komisi, saldo cuti, SLA dan KPI harus ditetapkan pemilik proses sebelum diintegrasikan. Audit perhitungan AMS belum selesai; blueprint tidak mengubah kebijakan atau formula yang berlaku.
7. **Target performa:** batas 3 detik perlu diuji pada perangkat, jaringan, volume data dan beban yang disepakati. Target belum merupakan hasil pengukuran.
8. **Roadmap:** semua fase dan acceptance criteria di bawah tetap target sampai ada bukti terukur. Penyimpanan dokumen ini tidak menambahkan menu, endpoint, koleksi atau fitur aplikasi.

---

## Riwayat adaptasi mobile

- [x] ✅ **26 November 2026 — lokal Windows:** visual referensi Employee ERP diterapkan pada AMS Mobile yang sudah ada: header biru, profil berinisial, kartu absensi, grid pintasan modul, kartu cuti/slip, panel lokasi, ringkasan catatan absensi bulan berjalan dan navigasi bawah 4/5 item sesuai capability. Aksen tetap palet AMS `#2a6199`; ukuran teks ditingkatkan hanya pada wrapper mobile, tombol dapat difokuskan dan perubahan halaman kembali ke bagian atas.
- [x] ✅ **Validasi lokal:** 13 tes mobile, type-check dan build lulus; browser dengan sesi/API/data sintetis memverifikasi lebar CSS 320/390/768 px tanpa overflow horizontal, navigasi Absensi/Cuti/Profil, pembukaan formulir cuti, navigasi slip/rincian untuk Payroll dan penyembunyian slip pada karyawan reguler. Tidak ada transaksi nyata, GPS nyata atau penyimpanan server yang diuji melalui fixture visual.
- **Batas lingkup:** endpoint, RBAC, pembatasan slip dan formula payroll/cuti yang ada tidak diganti. Tombol absensi beranda membuka halaman verifikasi GPS, bukan langsung mencatat absensi. Ringkasan menghitung catatan absensi pengguna pada bulan berjalan, bukan hari kerja/saldo cuti; shift beranda hanya berasal dari tim pengguna dengan rentang tanggal aktif. Selfie, peta interaktif, reimbursement, KPI/tugas baru, pesan dan unduhan PDF dari referensi tidak ditampilkan sebagai fitur aktif.
- [ ] Deployment dan UAT mobile pada perangkat nyata di staging Linux; acceptance criteria 15 modul ESS serta fase roadmap tetap terbuka.

---

## 1. Latar belakang dan tujuan pengembangan

### 1.1 Latar belakang

Employee Dashboard merupakan pusat informasi, administrasi, komunikasi dan pengelolaan aktivitas seluruh karyawan dalam ekosistem ERP. Perusahaan distribusi/perdagangan alat kesehatan memiliki kebutuhan khusus:

- Kompetensi dan sertifikasi tenaga kerja.
- Pemenuhan standar distribusi alat kesehatan.
- Aktivitas lapangan di rumah sakit, klinik, laboratorium dan fasilitas kesehatan lainnya.
- Pengelolaan sales, teknisi, product specialist, logistik dan staf administratif.
- Pengelolaan perangkat kerja, kendaraan, peralatan teknis dan unit demo.
- Dokumentasi dan audit aktivitas karyawan.
- Insentif, komisi dan kompensasi berdasarkan pencapaian pekerjaan.

Dashboard harus menjadi Employee Self-Service Portal, bukan hanya halaman informasi: karyawan mengelola kebutuhan administratif dan memantau pekerjaan sesuai kewenangannya.

### 1.2 Tujuan pengembangan

- Satu pusat informasi personal dan profesional setiap karyawan.
- Administrasi SDM digital.
- Transparansi kehadiran, penggajian, insentif dan penilaian kinerja.
- Pemantauan kompetensi, sertifikasi dan legalitas tenaga kerja.
- Koordinasi aktivitas lapangan.
- Integrasi aktivitas karyawan dengan modul ERP.
- Akuntabilitas penggunaan aset dan fasilitas.
- Persetujuan administratif digital.
- Dokumentasi aktivitas yang dapat ditelusuri untuk audit internal/eksternal.
- Pengurangan ketergantungan pada administrasi manual.

### 1.3 Prinsip dasar

| Prinsip | Kebutuhan |
| --- | --- |
| Single Source of Truth | Satu sumber master data karyawan di ERP. |
| Employee Self-Service | Akses dan pengelolaan administrasi sesuai kewenangan. |
| Role-Based Access Control | Informasi/fitur sesuai jabatan, divisi dan hak akses. |
| Real-Time Information | Pembaruan langsung atau sinkronisasi terjadwal sesuai kebutuhan. |
| Auditability | Perubahan data dan tindakan penting tercatat. |
| Mobile Responsive | Fungsi penting dapat digunakan pada desktop, tablet dan smartphone. |
| Integrated Workflow | Modul terhubung dengan ERP lainnya. |

## 2. Struktur utama Employee Dashboard

Dashboard dirancang sebagai halaman utama setelah karyawan login. Navigasi yang direkomendasikan:

1. Overview / My Dashboard.
2. My Profile.
3. Attendance & Working Time.
4. Leave & Permission.
5. Field Operations.
6. Performance & KPI.
7. Payroll & Benefits.
8. Claims & Reimbursement.
9. My Assets.
10. Training & Certification.
11. Documents & Company Resources.
12. Approval Center.
13. Internal Communication.
14. Helpdesk & Employee Support.
15. Settings.

Menu menyesuaikan role dan kewenangan. Approval Center hanya tersedia bagi pengguna yang memiliki kewenangan persetujuan.

## 3. Modul 01 — Overview / My Dashboard

### 3.1 Deskripsi

Ringkasan informasi penting tentang pekerjaan, aktivitas harian, administrasi dan notifikasi yang memerlukan perhatian. Tampilan berbeda berdasarkan jabatan/divisi.

### 3.2 Komponen dashboard

| Komponen | Informasi yang ditampilkan |
| --- | --- |
| A. Personal Greeting & Employee Summary | Foto, nama lengkap, Employee ID/NIK, jabatan, divisi/departemen, lokasi, atasan langsung, masa kerja dan status kepegawaian (tetap, kontrak, probation, internship dan lainnya). |
| B. Attendance Overview | Status hari ini, clock-in/out, total jam kerja, keterlambatan, lembur dan ringkasan bulan berjalan. |
| C. My Tasks & Activities | Kunjungan pelanggan, tugas atasan, instalasi, maintenance, tugas administrasi dan pengingat laporan. |
| D. Leave Balance | Kuota tahunan, cuti terpakai, sisa, pengajuan diproses dan riwayat cuti. |
| E. Performance Snapshot — Sales | Target/realisasi penjualan, persentase pencapaian, jumlah kunjungan dan pelanggan baru. |
| E. Performance Snapshot — Technical | Tiket, instalasi/maintenance selesai, outstanding service ticket dan SLA achievement. |
| E. Performance Snapshot — Warehouse | Produktivitas, transaksi diproses, akurasi picking/packing dan penyelesaian stock opname. |
| E. Performance Snapshot — Administrative | Penyelesaian tugas, ketepatan waktu dan target administrasi. |
| F. Pending Requests | Cuti, izin, lembur, reimbursement, cash advance, perjalanan dinas dan penggunaan aset yang menunggu persetujuan. |
| G. Notification & Reminders | Sertifikat/kontrak mendekati kedaluwarsa, pelatihan, timesheet, laporan, slip gaji tersedia, pengumuman dan pembaruan dokumen. |

### 3.3 Dashboard berdasarkan role

| Role | Informasi prioritas |
| --- | --- |
| Sales | Target penjualan, kunjungan, pipeline, komisi. |
| Technical / Engineer | Jadwal servis, tiket, instalasi, SLA. |
| Warehouse | Shift, tugas gudang, produktivitas, inventaris. |
| Finance | Tugas keuangan, reimbursement, approval. |
| HRD | Data karyawan, absensi, cuti, kontrak. |
| Supervisor | KPI tim, kehadiran tim, approval. |
| Manager | Kinerja departemen, target, produktivitas. |
| Direksi | Performa organisasi dan indikator strategis. |

## 4. Modul 02 — My Profile & Employee Information

### 4.1 Deskripsi

Pusat identitas dan administrasi karyawan, terintegrasi dengan master HR perusahaan.

### 4.2 Personal Information

Employee ID, nama lengkap, NIK KTP, tempat/tanggal lahir, alamat domisili, telepon, email pribadi/perusahaan, kontak darurat, foto dan status pernikahan jika diperlukan untuk administrasi.

### 4.3 Employment Information

Nomor induk karyawan, jabatan, divisi, departemen, atasan langsung, tanggal bergabung, masa kerja, status kepegawaian, jenis kontrak, awal/akhir kontrak, penempatan, status aktif/nonaktif, riwayat jabatan, mutasi dan promosi.

### 4.4 Bank & Tax Information

Nama bank, rekening, pemilik rekening, NPWP, NIK perpajakan sesuai ketentuan, status perpajakan dan administrasi penggajian. Data sensitif hanya dapat diakses karyawan bersangkutan dan pihak berwenang.

### 4.5 Profile Update Request

Pengajuan perubahan telepon, alamat, kontak darurat, rekening dan informasi keluarga yang relevan. Data resmi memerlukan verifikasi/persetujuan HRD. Identitas resmi, jabatan, gaji, status kepegawaian dan organisasi tidak dapat diubah langsung oleh karyawan.

## 5. Modul 03 — Training, Certification & Legal Compliance

### 5.1 Deskripsi

Pemantauan kompetensi, sertifikasi, pelatihan dan legalitas; fitur khusus perusahaan alat kesehatan.

### 5.2 Certification Management

- Data: nama/nomor sertifikat, kategori, penerbit, tanggal terbit/kedaluwarsa, status, file digital dan verifikasi HRD.
- Kategori: CDAKB, CPAKB jika relevan, mutu/distribusi, teknisi, kompetensi produk, profesi tenaga kesehatan dan sertifikasi sesuai jabatan.

### 5.3 STR / SIP Monitoring

Untuk jabatan yang memerlukan izin profesi: nomor STR/SIP jika relevan, jenis izin, penerbit, masa berlaku/kedaluwarsa, upload, validasi dan pengingat perpanjangan.

### 5.4 Expiration Alert

Pengingat pada H-90, H-60, H-30, H-7 dan tanggal kedaluwarsa. Penerima dapat meliputi karyawan, atasan, HRD dan penanggung jawab kepatuhan sesuai konfigurasi.

### 5.5 Product Knowledge Management

Nama produk, brand/principal, kategori, model/tipe, materi, tanggal pelatihan, trainer, nilai evaluasi, kelulusan dan sertifikat jika tersedia.

Contoh produk: Hematology Analyzer, Clinical Chemistry Analyzer, Immunoassay Analyzer, PCR System, Blood Gas Analyzer, Medical Imaging Equipment dan Laboratory Consumables.

### 5.6 Training Calendar

Pelatihan internal/principal, product demonstration, teknis, regulasi dan keselamatan; histori pelatihan serta pengembangan kompetensi.

## 6. Modul 04 — Attendance & Working Time

### 6.1 Deskripsi

Kehadiran dan waktu kerja untuk karyawan kantor maupun lapangan.

### 6.2 Digital Attendance

- Clock-in, clock-out, break start/end, histori dan pengajuan koreksi.
- Setiap transaksi: tanggal, waktu, GPS, alamat, selfie jika diwajibkan, perangkat dan status.

### 6.3 GPS & Geofencing

Area kantor pusat/cabang, gudang, proyek dan penugasan lapangan. Clock-in lapangan dapat mengikuti lokasi kunjungan/penugasan yang disetujui.

Radius dapat dikonfigurasi; lokasi/waktu dicatat bersama; ketidaksesuaian lokasi dideteksi. Absensi manual memerlukan alasan/persetujuan. Offline opsional harus disinkronkan dan divalidasi saat koneksi pulih.

### 6.4 Attendance Monitoring

Hadir, terlambat, tidak hadir, izin, sakit, cuti, dinas luar, kerja dari rumah, half-day dan jam kerja tidak lengkap.

### 6.5 Work Schedule & Shift Management

Kalender personal, shift, jadwal mingguan, libur nasional/perusahaan, perubahan jadwal, shift swapping dengan persetujuan dan pengingat.

### 6.6 Overtime Management

Tanggal, waktu mulai/selesai, durasi, alasan, deskripsi pekerjaan, lampiran dan atasan pemberi persetujuan.

Contoh: instalasi rumah sakit, perbaikan darurat, stock opname, pengiriman mendesak dan persiapan event/demo. Perhitungan mengikuti kebijakan perusahaan dan ketentuan ketenagakerjaan.

## 7. Modul 05 — Leave, Permission & Business Travel

### 7.1 Deskripsi

Cuti, izin dan perjalanan dinas.

### 7.2 Leave Management

- Jenis: tahunan, sakit, melahirkan, khusus, menikah, keluarga, tanpa tanggungan dan jenis lain sesuai kebijakan.
- Informasi: saldo, terpakai, tersedia, tanggal pengajuan/cuti, durasi, alasan, lampiran dan status.

### 7.3 Leave Workflow

1. Karyawan mengajukan.
2. Sistem memeriksa saldo/aturan.
3. Pengajuan dikirim ke atasan langsung.
4. Atasan menyetujui/menolak.
5. HRD memverifikasi jika diperlukan.
6. Saldo diperbarui otomatis.
7. Kalender kerja diperbarui.
8. Karyawan menerima hasil.

### 7.4 Permission Management

Izin terlambat, pulang awal, meninggalkan kantor, tidak masuk, keperluan keluarga dan izin lain.

### 7.5 Business Travel Management

Tujuan/lokasi, tanggal berangkat/kembali, tujuan pekerjaan, pelanggan/fasilitas kesehatan, estimasi biaya, transportasi, akomodasi dan surat tugas jika diperlukan.

Fitur tambahan: approval, digital travel assignment, itinerary, laporan, dokumentasi aktivitas dan pertanggungjawaban biaya.

## 8. Modul 06 — Field Operations & Sales Activities

### 8.1 Deskripsi

Untuk Sales, Product Specialist, Application Specialist dan Technical Engineer. Terhubung ke CRM, Sales Management, Customer Database dan Service Management.

### 8.2 Call Plan / Visit Planning

Tujuan kunjungan: rumah sakit, klinik, laboratorium, puskesmas, dinas kesehatan, distributor, mitra dan institusi lain.

Data: fasilitas kesehatan, alamat, kontak, PIC, tujuan, jenis aktivitas, jadwal, produk dan estimasi hasil.

### 8.3 Visit Check-in & Check-out

Check-in/out pelanggan, GPS tracking, timestamp, foto, catatan dan digital signature jika diperlukan.

Jenis: sales visit, presentasi/demo produk, follow-up quotation, negosiasi, technical visit, instalasi, preventive/corrective maintenance.

### 8.4 Visit Report

Tujuan, hasil pembahasan, kebutuhan pelanggan, produk diminati, potensi transaksi, masalah, tindak lanjut dan jadwal berikutnya; laporan wajib sesuai jenis aktivitas.

### 8.5 Sales Performance

Monthly sales target, sales achievement, revenue realization, order quantity, active customers, new customer acquisition, pipeline value, quotation follow-up dan conversion rate.

Grafik harian, mingguan, bulanan, kuartalan dan tahunan.

### 8.6 Technical Service Performance

Tiket, instalasi selesai, preventive/corrective maintenance, outstanding ticket, response/resolution time, SLA achievement dan customer satisfaction.

### 8.7 Field Activity Calendar

Kunjungan, demo, instalasi, training pelanggan, maintenance, business trip dan event.

## 9. Modul 07 — Performance Management & KPI

### 9.1 Deskripsi

Kinerja individu/tim berdasarkan target perusahaan; KPI berbeda per divisi.

### 9.2 Individual KPI

| Divisi | Contoh KPI |
| --- | --- |
| Sales | Revenue, kunjungan, pelanggan baru, closing ratio, outstanding quotation dan collection performance jika menjadi tanggung jawabnya. |
| Technical | Tiket selesai, ketepatan penyelesaian, SLA, first-time fix rate, customer satisfaction dan kelengkapan dokumentasi. |
| Warehouse | Picking/packing accuracy, stock discrepancy, order fulfillment dan ketepatan pengiriman. |
| Administrative | Ketepatan laporan, akurasi dokumen, penyelesaian tugas dan kepatuhan SOP. |

### 9.3 KPI Dashboard

Target, realisasi, pencapaian, periode, tren, perbandingan periode sebelumnya dan catatan atasan.

### 9.4 Performance Appraisal

Evaluasi bulanan, kuartalan, semesteran dan tahunan. Komponen: target, kualitas, produktivitas, disiplin, kompetensi, kerja sama, inisiatif dan kepatuhan SOP.

### 9.5 Individual Development Plan (IDP)

Karyawan/atasan menentukan kompetensi yang ditingkatkan, target, program pelatihan, tenggat, penanggung jawab, progres dan evaluasi.

## 10. Modul 08 — Payroll, Compensation & Benefits

### 10.1 Deskripsi

Transparansi penghasilan/benefit, terintegrasi dengan Payroll & Finance ERP.

### 10.2 E-Payslip

Gaji pokok; tunjangan jabatan, transportasi, makan, komunikasi dan lainnya; insentif, bonus, lembur, potongan, BPJS, PPh 21 dan take-home pay.

Histori slip, download PDF, verifikasi identitas sebelum akses dan proteksi data.

### 10.3 Commission & Incentive

Target/realisasi, dasar komisi, persentase, nilai, periode, status validasi/pembayaran. Tim teknis dapat memiliki insentif instalasi, maintenance, penyelesaian pekerjaan dan SLA jika berlaku.

Formula ditetapkan perusahaan; karyawan tidak dapat mengubahnya langsung.

### 10.4 Tax Information

NPWP/NIK perpajakan, status, ringkasan/riwayat PPh 21, bukti potong 1721-A1 atau penggantinya sesuai ketentuan, serta download dokumen.

### 10.5 BPJS Information

BPJS Kesehatan/Ketenagakerjaan, nomor/status kepesertaan, program dan administrasi.

### 10.6 Employee Loan & Cash Advance

Pengajuan kasbon/pinjaman, nominal, alasan, jadwal pembayaran, total cicilan, sisa, riwayat dan approval. Kasbon operasional dipisahkan dari pinjaman pribadi agar akuntansi/pertanggungjawaban tidak tercampur.

## 11. Modul 09 — Claims & Reimbursement

### 11.1 Deskripsi

Klaim biaya tugas perusahaan.

### 11.2 Jenis klaim

BBM, tol, parkir, transportasi, hotel, tiket perjalanan, konsumsi, representasi, pengiriman, operasional lapangan, teknis, pendukung instalasi dan biaya lain yang diizinkan.

### 11.3 Claim Submission

Tanggal transaksi, kategori, deskripsi, nominal, metode pembayaran, proyek/aktivitas, nomor perjalanan dinas jika ada, struk/kwitansi dan catatan.

### 11.4 Approval & Verification

Karyawan mengajukan → atasan memverifikasi aktivitas → Finance memeriksa bukti → disetujui/ditolak → daftar pembayaran → status pembayaran diperbarui.

### 11.5 Claim History

Total diajukan/disetujui/ditolak/dibayar, klaim menunggu dan histori. Pencegahan klaim ganda mempertimbangkan nomor transaksi, tanggal, nominal dan bukti pembayaran.

## 12. Modul 10 — Company Assets & Inventory

### 12.1 Deskripsi

Aset yang ditanggung/digunakan karyawan, terintegrasi dengan Asset Management dan Inventory Management.

### 12.2 My Assigned Assets

Laptop, desktop, monitor, smartphone, tablet, printer, kendaraan, peralatan teknisi, tools kit, peralatan kerja, demo unit alkes dan perangkat pendukung lain.

### 12.3 Asset Information

Asset ID, nama, kategori, brand, model, serial number, tanggal penyerahan, kondisi awal, lokasi, status kepemilikan/penggunaan, penanggung jawab, foto dan dokumen serah terima.

### 12.4 Asset Condition Reporting

Kerusakan, kehilangan, penurunan kondisi, kebutuhan perbaikan/penggantian dan pengembalian; dilengkapi foto/deskripsi.

### 12.5 Asset Handover

Digital handover/signature, berita acara, konfirmasi penerimaan, riwayat perpindahan dan konfirmasi pengembalian.

### 12.6 Demo Unit Tracking

Unit yang dipakai, serial number, lokasi terakhir, fasilitas tujuan, tanggal pinjam/kembali, kondisi, histori demo, kalibrasi/pemeriksaan jika relevan dan ketersediaan.

Terhubung dengan inventaris/peminjaman untuk mencegah benturan jadwal dan kehilangan jejak.

## 13. Modul 11 — Document Center & Company Knowledge Base

### 13.1 Deskripsi

Dokumen/informasi perusahaan berdasarkan hak akses.

### 13.2 Document Library

| Kategori | Isi |
| --- | --- |
| A. Company Policy | Peraturan, kebijakan internal, tata tertib dan kepegawaian. |
| B. SOP & Quality Management | SOP operasional/distribusi/penyimpanan/penanganan produk, kebijakan mutu, formulir dan instruksi kerja. |
| C. Regulatory & Compliance | Dokumen kepatuhan, CDAKB, CPAKB jika relevan, keselamatan dan regulasi terkait. |
| D. Operational Documents | Formulir kunjungan, instalasi, maintenance, serah terima dan perjalanan dinas. |

### 13.3 Document Control

Document ID, judul, kategori, revisi, tanggal berlaku/revisi, pemilik, status dan hak akses.

### 13.4 Read & Acknowledgment

Dokumen tertentu mewajibkan membuka/membaca, konfirmasi pemahaman dan kuis/evaluasi jika diperlukan. HRD/QA memantau status pembacaan.

Dokumen kedaluwarsa atau digantikan tidak boleh tampil sebagai versi aktif.

## 14. Modul 12 — Approval Center

### 14.1 Deskripsi

Pusat pengajuan bagi Supervisor, Manager, HRD, Finance dan Direksi sesuai kewenangan.

### 14.2 Approval Categories

Leave, permission, overtime, business travel, reimbursement, cash advance, employee loan, asset request/return, visit plan, training request, attendance correction dan document approval.

### 14.3 Approval Dashboard

Total pending, approval terbaru, kategori, pengajuan melewati tenggat, histori dan pengajuan dikembalikan untuk revisi.

### 14.4 Approval Detail

Pemohon, Employee ID, divisi, tanggal, jenis, detail, lampiran, histori approval dan catatan.

### 14.5 Approval Actions

Approve, Reject, Request Revision, Delegate Approval jika diizinkan dan Add Comment. Keputusan memiliki timestamp dan identitas pemberi persetujuan.

### 14.6 Multi-Level Approval

Contoh: Karyawan → Supervisor → Manager → HRD/Finance → Final Approval.

Konfigurasi berdasarkan jenis transaksi, nominal, jabatan, divisi, lokasi dan kebijakan. Approval tidak hanya mengandalkan jabatan statis karena struktur/kewenangan berubah.

## 15. Modul 13 — Internal Communication & Announcement

### 15.1 Deskripsi

Komunikasi untuk seluruh karyawan atau kelompok tertentu.

### 15.2 Announcement Center

Informasi perusahaan, HRD, operasional, kegiatan, pelatihan, produk, kebijakan baru, libur dan informasi penting lainnya.

### 15.3 Internal Calendar

Agenda, meeting, training/demo produk, event, audit, stock opname, gathering dan libur.

### 15.4 Notification Center

Kategori personal, approval, operasional, HR, compliance, payroll dan announcement. Read/unread, mark as read, filter, histori dan link halaman terkait.

Dashboard/email sebagai kanal; push notification atau WhatsApp merupakan integrasi tambahan sesuai kebijakan.

## 16. Modul 14 — Helpdesk & Employee Support

### 16.1 Deskripsi

Bantuan internal karyawan.

### 16.2 Support Categories

| Kategori | Kebutuhan |
| --- | --- |
| HR Support | Koreksi data, absensi, cuti, payroll dan BPJS. |
| IT Support | Login, reset akses, gangguan perangkat/ERP dan permintaan perangkat. |
| General Affairs | Fasilitas, kendaraan, peralatan kerja dan kebutuhan kantor. |

### 16.3 Ticket Management

Ticket ID, kategori, prioritas, judul, deskripsi, lampiran, tanggal, PIC, SLA, status dan histori komunikasi.

Status: Open → Assigned → In Progress; Waiting for User bila diperlukan; Resolved → Closed.

## 17. Modul 15 — Settings & Account Security

### 17.1 Account Settings

Update password, foto profil, preferensi notifikasi/bahasa/tampilan dan manajemen sesi.

### 17.2 Security

MFA jika diaktifkan, histori login/perangkat, session timeout, password policy, pemantauan login attempt, account lockout dan RBAC.

### 17.3 Privacy

Karyawan hanya mengakses informasi pribadi yang menjadi haknya. Gaji, rekening, NPWP, NIK, identitas dan informasi kepegawaian rahasia dilindungi dengan pembatasan akses, enkripsi dan autentikasi sesuai kebutuhan.

## 18. Role & Permission Management

| Bagian / Role | Kewenangan yang direncanakan |
| --- | --- |
| 18.1 Employee | Dashboard/pengajuan pribadi, absensi sendiri, slip sendiri, KPI sendiri, aset digunakan dan dokumen diizinkan. |
| 18.2 Supervisor | Dashboard/absensi/KPI anggota tim, approval sesuai kewenangan, tugas tim dan aktivitas lapangan. |
| 18.3 Manager | Kinerja/laporan departemen, approval manajerial, target dan produktivitas tim. |
| 18.4 HRD | Karyawan, kontrak, absensi, cuti, sertifikasi, pelatihan, evaluasi dan administrasi SDM. |
| 18.5 Finance | Payroll sesuai kewenangan, reimbursement, cash advance, pembayaran, perpajakan dan benefit sesuai scope. |
| 18.6 Quality Assurance / Compliance | Dokumen kepatuhan, sertifikasi pekerjaan, pelatihan wajib, dokumentasi dan audit relevan. |
| 18.7 Administrator | Konfigurasi, role, permission, workflow dan master data. |

Administrator teknis tidak otomatis memperoleh seluruh data HR/payroll sensitif.

## 19. Integrasi dengan modul ERP lainnya

Employee Dashboard adalah antarmuka lintas modul, bukan sumber master baru.

| Modul ERP | Bentuk integrasi |
| --- | --- |
| HR Management | Personal, jabatan, kontrak. |
| Attendance | Absensi, jam kerja, shift. |
| CRM | Pelanggan dan kunjungan. |
| Sales Management | Target, penjualan, komisi. |
| Service Management | Tiket, instalasi, maintenance. |
| Inventory | Stok dan peminjaman barang. |
| Asset Management | Aset perusahaan. |
| Accounting | Biaya, reimbursement, kasbon. |
| Finance | Payroll dan pembayaran. |
| Document Management | SOP, kebijakan, sertifikat. |
| Project Management | Tugas dan proyek. |
| Notification System | Pengingat/pemberitahuan. |

Prinsip: master konsisten, hindari input ganda, ID/referensi unik, status tersinkronisasi, validasi dan kegagalan tercatat, serta API/mekanisme internal terstandarisasi.

## 20. Workflow utama sistem

| Bagian | Alur |
| --- | --- |
| 20.1 Employee Leave | Employee → Submit Leave → Supervisor Approval → HR Verification jika perlu → Leave Balance Update → Notification. |
| 20.2 Reimbursement | Employee → Submit Claim → Supervisor Verification → Finance Verification → Payment Processing → Paid. |
| 20.3 Attendance | Employee → Clock In → GPS Validation → Attendance Recording → Clock Out → Working Hours Calculation → HR Monitoring. |
| 20.4 Certification | Upload → HR Verification → Approved/Rejected → Expiration Monitoring → Renewal Reminder. |
| 20.5 Asset | Assignment → Employee Confirmation → Monitoring → Damage Report/Return Request → Verification → Asset Status Update. |
| 20.6 Sales Activity | Call Plan → Supervisor Review jika perlu → Visit → Check-in/out → Report → CRM Update → KPI Update. |
| 20.7 Technical Service | Assignment → Task Received → On-site Check-in → Execution → Documentation → Customer Confirmation → Ticket Closure → KPI Update. |

## 21. System Requirements & Non-Functional Requirements

### 21.1 Platform

Web-based, desktop responsif, tablet, mobile-first untuk lapangan, browser modern dan navigasi konsisten.

### 21.2 Performance

Target dashboard utama maksimal **3 detik** pada jaringan/beban normal; feedback transaksi langsung; cache tanpa mengorbankan konsistensi data penting; mampu tumbuh bersama jumlah karyawan/transaksi.

### 21.3 Data Security

HTTPS, enkripsi data sensitif, RBAC, audit, manajemen sesi, backup, proteksi dokumen dan scope departemen/organisasi.

### 21.4 Audit Trail

Wajib mencatat login/logout, perubahan karyawan/dokumen, pengajuan, approve/reject, perubahan akses/payroll/aset dan penghapusan/pembatalan.

Minimal: User ID, waktu, jenis aktivitas, nilai sebelum/sesudah bila relevan, referensi transaksi dan sumber aktivitas. Log penting terlindungi dari perubahan oleh pengguna biasa.

## 22. Rekomendasi struktur database / master data

| Entitas konseptual | Fungsi |
| --- | --- |
| `employees` | Master karyawan. |
| `departments` | Departemen. |
| `positions` | Jabatan. |
| `organizational_units` | Struktur organisasi. |
| `employment_contracts` | Kontrak. |
| `employee_documents` | Dokumen karyawan. |
| `employee_certifications` | Sertifikasi. |
| `employee_trainings` | Riwayat pelatihan. |
| `attendance_records` | Absensi. |
| `work_schedules` | Jadwal. |
| `leave_requests` | Pengajuan cuti. |
| `leave_balances` | Saldo cuti. |
| `overtime_requests` | Lembur. |
| `business_trips` | Perjalanan dinas. |
| `visit_plans` | Rencana kunjungan. |
| `visit_reports` | Laporan kunjungan. |
| `performance_kpis` | KPI. |
| `performance_reviews` | Penilaian. |
| `payroll_records` | Penggajian. |
| `payslips` | Slip. |
| `reimbursement_claims` | Klaim biaya. |
| `employee_loans` | Pinjaman. |
| `employee_assets` | Aset digunakan. |
| `asset_handover_records` | Serah terima. |
| `approval_requests` | Pengajuan approval. |
| `approval_logs` | Histori approval. |
| `company_documents` | Dokumen perusahaan. |
| `announcements` | Pengumuman. |
| `notifications` | Notifikasi. |
| `support_tickets` | Bantuan. |
| `audit_logs` | Aktivitas. |

Ini rancangan konseptual, bukan keputusan skema final. Relasi, normalisasi, indeks dan integritas ditetapkan pada System Analysis/Database Design.

## 23. Rekomendasi UI/UX Design

### 23.1 Design Philosophy

Modern enterprise, clean/professional, minimalist, information-driven, hierarki konsisten, navigasi mudah dan responsif.

### 23.2 Layout Structure

| Area | Isi |
| --- | --- |
| A. Sidebar Navigation | Logo, menu/submenu sesuai role dan shortcut profil. |
| B. Top Navigation | Global search, notifikasi, help, quick action dan profile dropdown. |
| C. Main Content | Judul, breadcrumb, welcome, summary cards, charts, activity tables dan pending tasks. |
| D. Right Panel (opsional) | Jadwal mendatang, pending approval, pengumuman dan pengingat. |

### 23.3 UI Component Standards

Summary cards, data tables, search/filter, date picker, badges, progress bars, charts, modal/confirmation dialogs, upload, timeline, activity logs, approval buttons, empty/loading/error states.

### 23.4 Status Standardization

Draft, Submitted, Pending Approval, Approved, Rejected, Revision Required, In Progress, Completed, Cancelled, Expired dan Overdue. Arti status konsisten lintas modul.

## 24. Tahapan implementasi / Development Roadmap

Semua fase berikut merupakan rencana; belum ditandai selesai oleh penyimpanan blueprint.

| Fase | Prioritas | Fitur | Output target |
| --- | --- | --- | --- |
| Phase 1 — Core Employee Self-Service | Sangat tinggi | Overview, My Profile, Employee Information, Attendance, Leave & Permission, Digital Approval Center, Notification Center, Company Announcement, Role & Permission Management. | Login personal, informasi pribadi, absensi, cuti dan approval digital. |
| Phase 2 — HR & Administration | Tinggi | Training & Certification, STR/SIP jika relevan, kontrak, Payroll/E-Payslip, BPJS/Tax, Employee Loan, Reimbursement, Business Travel dan Document Center. | Administrasi SDM dan kebutuhan finansial mulai terintegrasi. |
| Phase 3 — Operational Integration | Tinggi | Call Plan, Visit Log, GPS Check-in, Visit Report, Technical Service, Installation/Maintenance, Sales/Technical KPI, Asset Management dan Demo Unit Tracking. | Aktivitas lapangan terhubung ERP. |
| Phase 4 — Advanced Performance & Automation | Menengah–tinggi | Advanced KPI, Appraisal, IDP, automated certification reminder, advanced approval, productivity analytics, helpdesk dan management reporting. | Pengelolaan SDM serta produktivitas terintegrasi. |

## 25. Acceptance Criteria / Indikator keberhasilan

Kriteria berikut harus dibuktikan sebelum dinyatakan siap digunakan; belum merupakan hasil pengujian AMS:

- [ ] **Employee Access:** akun individual, akses sesuai kewenangan dan dashboard sesuai role.
- [ ] **HR Administration:** master terpusat, upload/verifikasi dokumen, pengingat sertifikasi dan histori perubahan.
- [ ] **Attendance:** clock-in/out, validasi lokasi, histori dan approval koreksi.
- [ ] **Approval:** submit, notifikasi atasan, keputusan tercatat dan status diperbarui otomatis.
- [ ] **Payroll:** slip hanya untuk pihak berwenang, karyawan dapat melihat slip sendiri dan insentif dapat ditelusuri.
- [ ] **Field Operations:** jadwal kunjungan, lokasi/waktu, upload laporan dan hubungan aktivitas dengan KPI.
- [ ] **Asset Management:** ID unik, penanggung jawab terlacak, serah terima dan pelaporan kerusakan.
- [ ] **Security:** tidak ada akses lintas karyawan tanpa kewenangan, audit aktivitas penting, dokumen terlindungi serta backup/pemulihan.

## 26. Fitur tambahan yang direkomendasikan

### 26.1 Employee Digital ID

Foto, nama, Employee ID, jabatan, divisi, QR Code dan status aktif. QR untuk verifikasi internal/akses yang diizinkan.

### 26.2 Employee Task Management

Assignment, deadline, priority, progress, attachment, comment dan history.

### 26.3 Employee Recognition

Employee of the Month, Best Sales Achievement, Best Technical Performance, Outstanding Employee dan Achievement Badges.

### 26.4 Employee Survey

Satisfaction, internal feedback, training evaluation, culture survey dan operational improvement suggestions.

### 26.5 AI Employee Assistant

Mencari SOP/kebijakan/pelatihan, menjelaskan cuti/reimbursement, membantu laporan kunjungan dan menjawab prosedur operasional.

AI hanya boleh memakai informasi sesuai hak akses pengguna dan tidak mengambil keputusan resmi payroll, approval atau kepatuhan secara mandiri.

## 27. Kesimpulan & arah pengembangan

Employee Dashboard merupakan pusat aktivitas dan administrasi terintegrasi, bukan hanya absensi, cuti dan slip. Data personal harus terhubung dengan aktivitas operasional, target, kompetensi, aset dan produktivitas.

Tiga perhatian utama perusahaan alat kesehatan:

1. **Regulatory & Compliance Readiness:** kompetensi, sertifikasi, legalitas dan dokumentasi yang relevan bagi distribusi/pelayanan alkes.
2. **Operational Accountability:** dokumentasi kunjungan, demo, instalasi, maintenance dan aset yang dapat ditelusuri.
3. **Performance Transparency:** akses pencapaian, target, kompensasi dan evaluasi sesuai tanggung jawab/hak akses.

Arah pengembangan adalah **Integrated Employee Management & Productivity Platform** untuk efisiensi operasional, transparansi manajemen, kepatuhan dan pertumbuhan bisnis.

## Riwayat dokumen

| Tanggal | Perubahan | Batas verifikasi |
| --- | --- | --- |
| 26 November 2026 | Materi pengguna 27 bagian dirapikan menjadi Markdown; ditambahkan catatan keselarasan HRIS, scope akses, penyimpanan, roadmap dan acceptance criteria. | Dokumentasi dan pemeriksaan source terbatas; tidak ada implementasi fitur, migrasi, perubahan perhitungan, commit/push atau deployment melalui pekerjaan ini. |
