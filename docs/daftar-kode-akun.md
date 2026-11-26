# Daftar Kode Akun Akuntansi

**Chart of Accounts (COA) | Referensi perusahaan dagang, distribusi, dan jasa**

Sumber: PDF `Daftar_Kode_Akun_Akuntansi_Lengkap.pdf` yang diberikan pengguna, 8 halaman. Disalin ke Markdown pada 26 November 2026; tabel yang terpisah oleh pergantian halaman digabungkan, tanpa mengubah kode dan nama akun sumber.

## Status penggunaan dalam AMS

Dokumen ini merupakan **referensi**, bukan daftar akun aktif AMS dan bukan instruksi migrasi. Penyimpanan dokumen tidak mengganti CoA, jurnal, saldo, atau pemetaan laporan aplikasi.

Kode sumber berbeda dari kode yang digunakan mesin akuntansi AMS. Contoh: `1110` dalam PDF adalah Kendaraan, sedangkan konstanta AMS menggunakannya untuk Kas; `1120` dalam PDF adalah Mesin dan Peralatan, sedangkan AMS menggunakannya untuk Persediaan Alkes. AMS juga menggunakan `5240` untuk Beban Promosi FOC, yang tidak tercantum dalam PDF. Jangan mengimpor atau mengganti kode berdasarkan kesamaan nomor saja.

Penerapan memerlukan pemetaan berdasarkan makna akun, persetujuan Finance, serta rencana migrasi dan rekonsiliasi yang mempertahankan riwayat jurnal. Referensi kode aplikasi: [akuntansi.ts](../src/utils/akuntansi.ts); definisi CoA awal: [seedKeuangan.ts](../src/data/seedKeuangan.ts).

### Penggunaan submenu Daftar Kode Akun

- Buka **Finance & Accounting → 8. Daftar Kode Akun**. Daftar awal memuat 180 akun utama dari tabel dokumen ini; panduan struktur, pedoman, contoh sub-akun, disclaimer dan catatan AMS tersedia pada **Dokumen Acuan Awal Lengkap**.
- Gunakan pencarian berdasarkan kode, nama atau kelompok. **Tambah Kode Akun** berada di kanan judul; **Ubah** berada di kolom Aksi setiap baris. Keduanya hanya tersedia bagi sesi dengan izin **update Finance & Accounting**, yang juga diwajibkan server untuk menulis koleksi referensi.
- Isi kode, nama dan kelompok, lalu **Simpan**. Kode empat angka dapat memakai sub-akun seperti `1003.01`. Kode harus unik; perubahan kode tetap mempertahankan identitas internal akun. Draf yang berubah sejak dibuka ditolak; salin isian dan buka kembali data terbaru.
- Perubahan disimpan di perangkat dan dikirim melalui antrean sinkronisasi AMS pada koleksi `keuangan_referensi_akun`. Status antrean bukan konfirmasi server: periksa indikator sinkronisasi, termasuk kondisi offline, penolakan akses dan konflik versi. Kegagalan penyimpanan dilaporkan; jangan menghapus cache ketika masih ada draf tertunda.
- Koleksi ini terpisah dari `keuangan_coa`. Tambah/edit tidak mengganti kode jurnal, pemetaan HPP/FOC/pajak, saldo atau laporan. Data pengguna dipertahankan pada pembersihan data dummy. Dokumen sumber ini tetap sebagai baseline historis, bukan daftar hasil edit pengguna.

## Tujuan dokumen

Daftar ini merupakan kerangka kode akun yang komprehensif untuk membantu penyusunan pembukuan, jurnal, buku besar, neraca saldo, laporan laba rugi, dan neraca. Struktur dibuat fleksibel agar dapat disesuaikan untuk perusahaan perdagangan/distribusi, termasuk distribusi alat kesehatan, serta perusahaan jasa.

**Catatan penting:** Tidak ada satu daftar kode akun yang wajib dan seragam untuk seluruh perusahaan. Perusahaan perlu menyesuaikan akun dengan kegiatan usaha, materialitas transaksi, kebijakan akuntansi, kebutuhan pajak, serta standar akuntansi yang berlaku. Akun yang tidak relevan dapat dinonaktifkan; akun baru dapat ditambahkan sebagai sub-akun.

## Panduan struktur kode

| Rentang kode | Kelompok akun | Saldo normal (umum) |
| --- | --- | --- |
| 1000-1999 | Aset | Debit |
| 2000-2999 | Liabilitas | Kredit |
| 3000-3999 | Ekuitas | Kredit |
| 4000-4999 | Pendapatan | Kredit |
| 5000-5999 | Harga Pokok Penjualan | Debit |
| 6000-6999 | Beban operasional | Debit |
| 7000-7999 | Pendapatan/beban nonoperasional | Kredit / Debit |
| 8000-8999 | Pajak penghasilan | Debit / Kredit |
| 9000-9999 | Akun penutup/kontrol (opsional) | Tergantung fungsi |

## Daftar akun

### 1. Aset

#### 10 - Aset lancar

| Kode akun | Nama akun |
| --- | --- |
| 1001 | Kas Kecil |
| 1002 | Kas Besar |
| 1003 | Bank - Rekening Operasional |
| 1004 | Bank - Rekening Payroll |
| 1005 | Deposito Jangka Pendek |
| 1010 | Piutang Usaha |
| 1011 | Cadangan Kerugian Piutang |
| 1012 | Piutang Karyawan |
| 1013 | Piutang Pemegang Saham |
| 1014 | Piutang Lain-lain |
| 1020 | Persediaan Barang Dagang |
| 1021 | Persediaan Barang Dalam Perjalanan |
| 1022 | Persediaan Barang Konsinyasi |
| 1023 | Persediaan Bahan Habis Pakai |
| 1024 | Persediaan Suku Cadang |
| 1025 | Persediaan Barang Rusak/Kedaluwarsa |
| 1030 | Uang Muka Pembelian |
| 1031 | Uang Muka Operasional |
| 1032 | Uang Muka Perjalanan Dinas |
| 1033 | Uang Muka Pajak - PPh |
| 1034 | Pajak Dibayar di Muka - PPN Masukan |
| 1040 | Biaya Dibayar di Muka |
| 1041 | Sewa Dibayar di Muka |
| 1042 | Asuransi Dibayar di Muka |
| 1043 | Langganan dan Lisensi Dibayar di Muka |
| 1090 | Aset Lancar Lainnya |

#### 11 - Aset tidak lancar

| Kode akun | Nama akun |
| --- | --- |
| 1101 | Tanah |
| 1102 | Bangunan |
| 1103 | Akumulasi Penyusutan Bangunan |
| 1104 | Renovasi Bangunan |
| 1105 | Akumulasi Penyusutan Renovasi |
| 1110 | Kendaraan |
| 1111 | Akumulasi Penyusutan Kendaraan |
| 1120 | Mesin dan Peralatan |
| 1121 | Akumulasi Penyusutan Mesin dan Peralatan |
| 1122 | Peralatan Medis untuk Operasional/Demo |
| 1123 | Akumulasi Penyusutan Peralatan Medis |
| 1130 | Peralatan Kantor |
| 1131 | Akumulasi Penyusutan Peralatan Kantor |
| 1132 | Komputer dan Perangkat IT |
| 1133 | Akumulasi Penyusutan Komputer dan IT |
| 1140 | Furniture dan Perlengkapan |
| 1141 | Akumulasi Penyusutan Furniture |
| 1150 | Aset Hak Guna |
| 1151 | Akumulasi Penyusutan Aset Hak Guna |
| 1160 | Aset Takberwujud - Software |
| 1161 | Akumulasi Amortisasi Software |
| 1162 | Merek dan Hak Kekayaan Intelektual |
| 1170 | Investasi Jangka Panjang |
| 1180 | Aset Pajak Tangguhan |
| 1190 | Aset Tidak Lancar Lainnya |

### 2. Liabilitas

#### 20 - Liabilitas jangka pendek

| Kode akun | Nama akun |
| --- | --- |
| 2001 | Utang Usaha - Pemasok Dalam Negeri |
| 2002 | Utang Usaha - Pemasok Luar Negeri |
| 2003 | Utang Pembelian Aset |
| 2010 | Utang Gaji dan Upah |
| 2011 | Utang Insentif/Komisi |
| 2012 | Utang THR dan Bonus |
| 2013 | Utang BPJS Kesehatan |
| 2014 | Utang BPJS Ketenagakerjaan |
| 2020 | Utang Pajak - PPN Keluaran |
| 2021 | Utang Pajak - PPh 21 |
| 2022 | Utang Pajak - PPh 23 |
| 2023 | Utang Pajak - PPh 4(2) |
| 2024 | Utang Pajak - PPh 25/29 |
| 2025 | Utang Pajak - PPh 22 Impor |
| 2026 | Utang Pajak Lainnya |
| 2030 | Uang Muka Pelanggan |
| 2031 | Pendapatan Diterima di Muka |
| 2040 | Biaya yang Masih Harus Dibayar |
| 2041 | Utang Utilitas |
| 2042 | Utang Bunga |
| 2043 | Utang Sewa Jangka Pendek |
| 2050 | Pinjaman Bank Jangka Pendek |
| 2051 | Bagian Lancar Pinjaman Jangka Panjang |
| 2060 | Utang Lancar Lainnya |

#### 21 - Liabilitas jangka panjang

| Kode akun | Nama akun |
| --- | --- |
| 2101 | Pinjaman Bank Jangka Panjang |
| 2102 | Utang Pembiayaan Kendaraan |
| 2103 | Utang Sewa Jangka Panjang |
| 2110 | Utang kepada Pemegang Saham |
| 2120 | Liabilitas Imbalan Kerja |
| 2130 | Liabilitas Pajak Tangguhan |
| 2190 | Liabilitas Jangka Panjang Lainnya |

### 3. Ekuitas

| Kode akun | Nama akun |
| --- | --- |
| 3001 | Modal Disetor |
| 3002 | Tambahan Modal Disetor |
| 3003 | Agio Saham |
| 3010 | Prive/Penarikan Pemilik |
| 3020 | Saldo Laba |
| 3021 | Laba Ditahan |
| 3022 | Laba Tahun Berjalan |
| 3023 | Dividen |
| 3030 | Cadangan Umum |
| 3040 | Komponen Ekuitas Lainnya |

### 4. Pendapatan

| Kode akun | Nama akun |
| --- | --- |
| 4001 | Penjualan Barang Dagang |
| 4002 | Penjualan Alat Kesehatan |
| 4003 | Penjualan Bahan Habis Pakai Medis |
| 4004 | Penjualan Suku Cadang dan Aksesori |
| 4010 | Pendapatan Jasa Instalasi |
| 4011 | Pendapatan Jasa Pemeliharaan |
| 4012 | Pendapatan Jasa Perbaikan |
| 4013 | Pendapatan Pelatihan dan Demonstrasi |
| 4014 | Pendapatan Konsultasi/Teknis |
| 4020 | Pendapatan Sewa Peralatan |
| 4030 | Retur Penjualan |
| 4031 | Diskon dan Potongan Penjualan |
| 4040 | Pendapatan Pengiriman yang Ditagihkan |
| 4090 | Pendapatan Operasional Lainnya |

### 5. Harga Pokok Penjualan (HPP)

| Kode akun | Nama akun |
| --- | --- |
| 5001 | Harga Pokok Barang Terjual |
| 5002 | Pembelian Barang Dagang |
| 5003 | Pembelian Alat Kesehatan |
| 5004 | Pembelian Bahan Habis Pakai Medis |
| 5005 | Pembelian Suku Cadang dan Aksesori |
| 5010 | Ongkos Angkut Pembelian |
| 5011 | Bea Masuk dan Pajak Impor yang Dikapitalisasi |
| 5012 | Biaya Clearance dan Forwarder |
| 5013 | Biaya Asuransi Pengiriman Pembelian |
| 5020 | Retur Pembelian |
| 5021 | Diskon Pembelian |
| 5030 | Biaya Instalasi Langsung |
| 5031 | Biaya Tenaga Kerja Langsung |
| 5032 | Biaya Garansi Produk |
| 5040 | Penyesuaian Persediaan |
| 5041 | Kerugian Persediaan Rusak/Kedaluwarsa |
| 5090 | HPP Lainnya |

### 6. Beban operasional

#### 60 - Beban penjualan dan pemasaran

| Kode akun | Nama akun |
| --- | --- |
| 6001 | Gaji Tim Penjualan |
| 6002 | Komisi dan Insentif Penjualan |
| 6003 | Iklan dan Promosi |
| 6004 | Pameran, Seminar, dan Product Demo |
| 6005 | Sampel dan Barang Promosi |
| 6006 | Perjalanan Dinas Penjualan |
| 6007 | Jamuan dan Representasi |
| 6008 | Pengiriman kepada Pelanggan |
| 6009 | Biaya Marketplace dan Platform |
| 6010 | Biaya Tender dan Administrasi Penawaran |
| 6011 | Biaya Registrasi/Perizinan Produk |
| 6012 | Biaya Hubungan Pelanggan |

#### 61 - Beban umum dan administrasi

| Kode akun | Nama akun |
| --- | --- |
| 6101 | Gaji dan Tunjangan Karyawan |
| 6102 | THR dan Bonus |
| 6103 | BPJS Perusahaan |
| 6104 | Rekrutmen dan Pelatihan Karyawan |
| 6105 | Sewa Kantor dan Gudang |
| 6106 | Listrik, Air, dan Gas |
| 6107 | Telepon dan Internet |
| 6108 | ATK dan Percetakan |
| 6109 | Perlengkapan Kantor |
| 6110 | Perjalanan Dinas Umum |
| 6111 | Transportasi dan Parkir |
| 6112 | BBM dan Tol |
| 6113 | Perawatan Kendaraan |
| 6114 | Perawatan Gedung dan Kantor |
| 6115 | Perawatan Komputer dan IT |
| 6116 | Jasa Profesional dan Konsultan |
| 6117 | Jasa Hukum dan Notaris |
| 6118 | Audit dan Akuntansi |
| 6119 | Perizinan dan Keanggotaan |
| 6120 | Asuransi |
| 6121 | Keamanan dan Kebersihan |
| 6122 | Penyusutan Aset Tetap |
| 6123 | Amortisasi Aset Takberwujud |
| 6124 | Biaya Software dan Cloud |
| 6125 | Biaya Bank dan Administrasi |
| 6126 | Pajak dan Retribusi |
| 6127 | Donasi dan Sumbangan |
| 6128 | Kerugian Piutang |
| 6129 | Biaya Umum Lainnya |

### 7. Pendapatan dan beban nonoperasional

| Kode akun | Nama akun |
| --- | --- |
| 7001 | Pendapatan Bunga Bank |
| 7002 | Keuntungan Selisih Kurs |
| 7003 | Keuntungan Penjualan Aset Tetap |
| 7004 | Pendapatan Nonoperasional Lainnya |
| 7101 | Beban Bunga Pinjaman |
| 7102 | Kerugian Selisih Kurs |
| 7103 | Kerugian Penjualan/Pelepasan Aset |
| 7104 | Denda dan Sanksi |
| 7105 | Beban Nonoperasional Lainnya |

### 8. Pajak penghasilan

| Kode akun | Nama akun |
| --- | --- |
| 8001 | Beban Pajak Penghasilan Kini |
| 8002 | Beban Pajak Tangguhan |
| 8003 | Manfaat Pajak Tangguhan |

### 9. Akun penutup / kontrol (opsional)

| Kode akun | Nama akun |
| --- | --- |
| 9001 | Ikhtisar Laba Rugi |
| 9002 | Laba/Rugi Periode Berjalan - Kontrol |
| 9003 | Selisih Pembulatan |
| 9004 | Akun Suspense / Transaksi Belum Teridentifikasi |

## Pedoman penerapan

1. **Gunakan akun induk dan sub-akun.** Contoh: 1003 Bank - Rekening Operasional dapat dipecah menjadi 1003.01 Bank BCA, 1003.02 Bank Mandiri, dan seterusnya. Terapkan pola yang konsisten dan hindari penggunaan satu akun untuk transaksi yang berbeda sifat.
2. **Pisahkan akun neraca dan laba rugi.** Aset, liabilitas, dan ekuitas disajikan dalam neraca. Pendapatan, HPP, dan beban disajikan dalam laporan laba rugi. Akun kontra seperti akumulasi penyusutan, cadangan kerugian piutang, retur, dan diskon mengurangi akun terkait.
3. **Kelola pajak secara terpisah.** Pisahkan PPN Masukan, PPN Keluaran, serta akun utang/pajak penghasilan sesuai jenis dan kewajiban perusahaan. Perlakuan pajak perlu dikonfirmasi dengan ketentuan perpajakan yang berlaku dan penasihat pajak perusahaan.
4. **Persediaan dan HPP.** Untuk perusahaan distribusi, tentukan metode pencatatan persediaan (perpetual atau periodik), kelompok produk, lokasi gudang, serta perlakuan biaya impor, pengiriman, clearance, retur, barang rusak, dan kedaluwarsa. Jangan mencatat aset demo sebagai persediaan jual jika secara substansi digunakan sebagai aset operasional.
5. **Dimensi analitik.** Selain kode akun, pertimbangkan penggunaan kode cabang, departemen, proyek, salesman, pelanggan, pemasok, gudang, dan kategori produk. Dimensi ini membantu analisis tanpa membuat daftar akun menjadi terlalu panjang.
6. **Tutup periode secara teratur.** Lakukan rekonsiliasi kas/bank, piutang, utang, persediaan, aset tetap, pajak, dan saldo antar-entitas. Akun 9xxx bersifat opsional dan umumnya hanya dipakai jika sistem akuntansi memerlukannya.

## Contoh pola penomoran sub-akun

| Kode | Nama akun | Keterangan |
| --- | --- | --- |
| 1003 | Bank - Rekening Operasional | Akun induk |
| 1003.01 | Bank BCA - Operasional | Sub-akun berdasarkan rekening |
| 1003.02 | Bank Mandiri - Operasional | Sub-akun berdasarkan rekening |
| 1020.01 | Persediaan - Produk A | Sub-akun berdasarkan kelompok produk |
| 1020.02 | Persediaan - Produk B | Sub-akun berdasarkan kelompok produk |
| 4002.01 | Penjualan Alat Kesehatan - Produk A | Sub-akun pendapatan per lini produk |

## Disclaimer sumber

Dokumen ini adalah referensi operasional, bukan daftar akun resmi yang diwajibkan regulator dan bukan pengganti kebijakan akuntansi perusahaan. Penetapan akun, pengakuan, pengukuran, penyajian, dan pengungkapan harus mengikuti standar akuntansi yang berlaku di Indonesia serta kondisi transaksi sebenarnya.
