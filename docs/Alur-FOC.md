# Alur Kerja Promosi Free of Charge (FOC)

Dokumen ini menjelaskan konfigurasi dan alur promosi Free of Charge (FOC) dari Sales Order sampai pencatatan biaya di Finance. FOC adalah barang yang diberikan tanpa nilai tagihan, tetapi tetap dialokasikan dan dicatat sebagai barang keluar.

## Ringkasan alur

1. Sales membuat konfigurasi promosi dan pilihan Sales Kit.
2. Sales memilih promosi yang memenuhi syarat saat membuat Sales Order.
3. Warehouse mengalokasikan produk utama dan komponen kit dengan FEFO.
4. Jika seluruh kebutuhan stok lolos, sistem menerbitkan Surat Jalan dan faktur; jika tidak, pengiriman ditolak tanpa mutasi stok.
5. Faktur menampilkan kit sebagai baris Rp0 tanpa PPN.
6. Finance menyusun draf jurnal biaya promosi dari valuasi asli batch yang benar-benar dikirim, lalu meninjau dan mem-posting jurnal secara terpisah.

## 1. Konfigurasi promosi oleh Sales

**Lokasi:** `Sales & Marketing` → tab **Promosi FOC & Sales Kit**.

Di panel **Konfigurasi Promosi FOC & Sales Kit**, pengguna dengan izin pembaruan Sales & Marketing dapat mengisi:

- Nama promosi dan SKU produk pemicu.
- Minimum pembelian dan maksimum kit per pesanan.
- Periode berlaku.
- Kanal penjualan dan pelanggan sasaran. Pilihan kanal atau pelanggan yang kosong berarti berlaku untuk semua.
- Satu atau lebih pilihan kit, masing-masing berisi produk komponen, kuantitas per kit, dan satuan.

SKU dipilih dari produk yang tersedia pada katalog, izin edar, atau kartu stok. Sistem tidak menerima SKU komponen kosong atau placeholder. Tombol **Tambah pilihan kit** membuat opsi paket baru; **Tambah komponen** menambah baris produk pada paket. Setelah data lengkap, klik **Simpan promosi**. Daftar **Promosi FOC Terdaftar** di bawah form menyediakan tombol **Ubah**, **Nonaktifkan**, atau **Aktifkan**.

Konfigurasi divalidasi sebelum disimpan, termasuk periode, angka positif, pilihan paket dan komponen, serta keunikan ID dan SKU komponen dalam satu kit. Promosi dinonaktifkan tetap tersimpan agar tidak mengubah riwayat pesanan.

## 2. Pemilihan promosi pada Sales Order

**Lokasi:** `Sales & Marketing` → **Manajemen Order & Penjualan** → tombol **Input Pesanan Fasyankes Baru** di kanan atas panel.

Pada form pesanan, isi pelanggan, kanal, tanggal, produk utama, dan kuantitas seperti biasa. Bagian **Promosi Free of Charge (opsional)** berada setelah isian produk/batch FEFO/jumlah dan sebelum metode pembayaran/TOP.

1. Pilih promosi yang ditawarkan sistem. Hanya konfigurasi yang aktif dan lolos pemeriksaan SKU pemicu, minimum pembelian, tanggal, kanal, serta pelanggan yang tersedia.
2. Pilih salah satu opsi pada **Pilihan Sales Kit**.
3. Periksa jumlah kit dan rincian komponen yang ditampilkan, lalu simpan pesanan.

Jumlah kit dihitung sebagai nilai terkecil dari jumlah pesanan dibagi minimum pembelian (dibulatkan ke bawah) dan batas maksimum kit per pesanan:

`jumlah kit = min(floor(jumlah pesanan / minimum pembelian), maksimum kit per pesanan)`

Contoh: minimum pembelian 2, pesanan 5 unit, maksimum 2 kit menghasilkan 2 kit. Jika setiap kit berisi 1 unit komponen C dan 2 unit komponen D, kebutuhan kirimnya menjadi C sebanyak 2 unit dan D sebanyak 4 unit.

Pilihan promosi, paket, komposisi, dan jumlah kit disalin ke snapshot Sales Order. Perubahan atau penonaktifan konfigurasi setelah pesanan dibuat tidak mengubah snapshot pesanan tersebut. Nilai penjualan tetap berasal dari produk utama; kit tidak menambah nilai pesanan.

## 3. Alokasi Warehouse dan penerbitan Surat Jalan

**Lokasi:** `Warehouse` → tab **Pengiriman (Outbound)** → panel **Antrean Pesanan Penjualan Siap Eksekusi FEFO Sadar-Kunci**.

Klik **Eksekusi FEFO & Terbitkan SJ** pada pesanan yang akan dikirim. Sistem mengalokasikan produk utama, lalu setiap komponen FOC berdasarkan SKU dan kuantitas pada snapshot pesanan. Kebutuhan dialokasikan pada salinan simulasi stok terlebih dahulu.

- **Jika stok komponen tidak lengkap atau alokasinya tidak lolos gerbang gudang:** pengiriman ditolak dan stok fisik tidak dimutasi. Pesanan tetap menunggu alokasi; alasan penolakan dicatat.
- **Jika seluruh alokasi lolos:** stok produk utama dan komponen dikurangi, pergerakan barang dicatat, lalu Surat Jalan dan transaksi/faktur diterbitkan.

Alokasi mengambil stok bebas setelah dikurangi kuota yang sudah dipesan dan tidak melepas kuota tersebut. Jika produk utama dan komponen memakai SKU yang sama, keduanya memakai saldo bebas yang sama dalam simulasi. Ini adalah pemeriksaan lokal sebelum mutasi, bukan bukti transaksi atomik lintas koleksi atau perlindungan terhadap pengiriman bersamaan pada server.

Pada daftar Surat Jalan, kartu **Free of Charge** menampilkan nama promosi/paket, jumlah kit, nama dan SKU komponen, total kuantitas, serta batch dan bin hasil alokasi. Rute picking yang tersusun saat ini mengikuti alokasi produk utama; rincian lokasi komponen FOC ditampilkan terpisah pada kartu FOC.

## 4. Tampilan faktur dan piutang

**Lokasi:** `Finance & Accounting` → tab **Faktur & Piutang**.

Transaksi penjualan tetap memakai nilai produk utama. Baris tambahan Free of Charge ditampilkan di bawah transaksi sebagai kit dengan subtotal **Rp0**, tarif PPN **0%**, dan keterangan bahwa baris promo tidak menambah omzet. Dengan demikian, barang gratis terlacak pada faktur tanpa menjadi pendapatan atau menambah tagihan pelanggan.

## 5. Penyusunan jurnal biaya promosi

**Lokasi:** `Finance & Accounting` → tab **Valuasi & Write-Off** → panel **Beban Promosi Free of Charge (FOC)**, di bawah panel **HPP atas Pengiriman**.

Panel ini menampilkan Surat Jalan yang memiliki FOC, status pengiriman, jumlah kit, dan batch komponen. Setelah status Surat Jalan **Terkirim** atau **Diterima Penerima**, klik **Susun Draf FOC**.

Sistem mengambil kuantitas komponen dan batch yang benar-benar dialokasikan, lalu mencocokkannya dengan valuasi batch:

- Debit akun **5240 — Beban Promosi Free of Charge (FOC)**.
- Kredit akun persediaan untuk setiap batch komponen.
- Nilai dihitung dari kuantitas yang keluar dikali nilai per unit valuasi batch.

Jurnal hanya dapat dirancang jika dasar biaya yang cocok tersedia dan berstatus `ASLI`; sistem tidak mengarang biaya dari valuasi dummy atau data yang tidak cocok. Referensi Surat Jalan yang sama tidak dapat dijurnal dua kali. Tombol menyimpan jurnal sebagai **draf**, bukan mem-postingnya otomatis. Finance perlu meninjau dan mem-posting jurnal melalui tab **Jurnal & Buku Besar**.

## Integrasi data antarmodul

| Tahap | Data yang diteruskan |
| --- | --- |
| Sales → konfigurasi | Promosi disimpan pada koleksi `sales_promosi_foc`; SKU merujuk ke data produk yang tersedia. |
| Sales Order | Snapshot promosi, paket, komponen, dan jumlah kit disimpan pada pesanan. |
| Warehouse | Snapshot dipakai untuk alokasi FEFO, mutasi stok, pergerakan barang, dan rincian komponen Surat Jalan. |
| Finance — Faktur & Piutang | Transaksi mempertahankan nilai produk utama dan menyimpan detail baris FOC Rp0 tanpa PPN. |
| Finance — Persediaan/Jurnal | Surat Jalan dan batch alokasi menjadi sumber draf jurnal beban promosi; referensi Surat Jalan mencegah duplikasi. |

## Batasan dan kesiapan

- SKU dan konfigurasi promosi untuk produk aktual harus dibuat oleh Sales sebelum dapat dipilih pada Sales Order.
- Implementasi ini telah diverifikasi di lingkungan lokal; sinkronisasi koleksi, alur lengkap, dan tampilan di staging belum diverifikasi atau di-deploy.
- Rincian komponen FOC tersedia pada tampilan Surat Jalan Outbound. Template cetak generik belum ditautkan ke Surat Jalan atau faktur FOC tertentu.
- Draf jurnal tidak mengubah laporan akuntansi sampai Finance mem-postingnya.
