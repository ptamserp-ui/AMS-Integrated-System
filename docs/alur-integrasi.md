# Alur integrasi website publik dan ERP

## Snapshot katalog

CMS Website menyusun draf dari data dan konfigurasi aplikasi, lalu penerbit yang memiliki izin dapat menerbitkan snapshot. `/web` membaca `GET /api/website/published`; snapshot server dan salinan statis bukan tampilan stok live. Perubahan `product_catalog` dapat diselaraskan server ke draf dan snapshot terbit; perubahan operasional lain tidak boleh diasumsikan langsung tayang. Tinjau konten publik setelah perubahan.

`src/utils/website.ts` membangun produk dari sumber katalog, izin edar dan stok. Penyaringan stok yang ditampilkan tidak boleh dianggap bukti reservasi, validasi regulator atau ketersediaan aktual; lihat alur penjualan dan FEFO untuk transaksi.

## RFQ publik

Form website mengirim `POST /api/website/rfq`. Server memvalidasi permintaan, menyimpannya pada antrean `sales_website_rfq` dan menyiarkan perubahan; ID permintaan mendukung retry idempoten. Tim sales memproses antrean di ERP. Kegagalan siaran tidak berarti data yang sudah tersimpan hilang. Tautan email dan WhatsApp adalah kanal tambahan, bukan gateway terintegrasi.

RFQ publik berbeda dari permintaan penawaran Customer Portal: portal memakai akun dan keranjang server tersendiri. Penetapan harga, konversi otomatis dan pembayaran portal belum lengkap; lihat [Customer Portal](./customer-portal.md).

## Batas integrasi

Tidak ada bukti koneksi live ke LPSE/e-Katalog, SatuSehat atau database pemerintah dari alur ini. Antrean, seed dan pratinjau payload bukan bukti pengiriman. Lihat [SRS CMS](./srs-cms-website.md), [catatan pengembang](./developer-notes.md) dan [evaluasi staging](./evaluasi-staging.md).
