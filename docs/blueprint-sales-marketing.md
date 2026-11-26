> **Status 25 November 2026: sebagian.** Jalur FEFO memiliki tes domain; state server, cache browser dan data contoh digunakan oleh modul. Tidak ada bukti koneksi live LPSE/e-Katalog, SatuSehat atau DJP. Skema PostgreSQL dan koneksi otomatis di bawah adalah target. Tab saat ini berjumlah 11, termasuk konfigurasi Promosi FOC & Sales Kit. Implementasi FOC yang tercatat di bawah baru diverifikasi di Windows lokal; belum dibuktikan di staging.

# Blueprint - Sales & Marketing / SDAK (Child)

Status: **Blueprint historis; implementasi dan integrasi parsial**

Parent Document: `/docs/system-blueprint.md` (Domain: Commercial, Sales & PMS)  
Sasaran Modul: `src/components/modules/commercial/SalesModule.tsx` (beserta 7 sub-modul komersial di `src/components/modules/commercial/sales/`)  
Kerangka Regulasi: Permenkes Etika Promosi Alkes, CDAKB Permenkes RI 4/2014, Perpres Pengadaan Barang/Jasa Pemerintah (e-Katalog LKPP), ALCOA+ Data Integrity.
Coded by Langgo Bramandityo

---

## 0. Ringkasan Eksekutif & Karakteristik Industri Alkes
Sistem ERP komersial untuk manufaktur dan distribusi alat kesehatan (PT Anugrahmitra Selaras / REMEDI) memiliki karakteristik unik:
1. **Validasi Kepatuhan Medis (CDAKB Validator):** Sales Order (SO) tidak dapat diproses jika nomor izin edar (NIE) alkes kedaluwarsa atau fasyankes tujuan tidak memiliki izin operasional yang sah.
2. **Keterikatan dengan e-Katalog LKPP & LPSE:** Sebagian besar volume penjualan institusi pemerintah dikelola melalui kontrak harga e-Katalog dengan manajemen margin dan pagu kredit (*Credit Limit & TOP*) yang ketat.
3. **Eksekusi FEFO Sadar-Kunci:** Transaksi penjualan langsung terintegrasi dengan mesin alokasi stok gudang FIFO/FEFO untuk memastikan batch kedaluwarsa terdekat atau batch terkarantina tidak pernah terpilih.

---

## 1. Peta Fitur & Tab Sales Saat Ini

| # | Sub-Modul Komersial | Berkas Utama | Fitur & Aturan Bisnis Aktual di Aplikasi |
| --- | --- | --- | --- |
| 1 | **CRM & Management Prospek** | `CrmProspekModule.tsx` | - Pemetaan B2B Customer Profiling (RS Pemerintah/Swasta, Klinik, Apotek, Dinkes).<br>- Pelacakan lead & opportunity pipeline dari perkenalan hingga negosiasi.<br>- Pemetaan area wilayah kerja MedRep (Sales Territory Mapping). |
| 2 | **Manajemen Tender & Kontrak** | `TenderKontrakModule.tsx` | - LPSE Scraper & Alert System untuk tender aktif.<br>- Contract & Pricing Agreement untuk mengunci harga tender jangka panjang.<br>- Margin Calculator untuk kalkulasi profitabilitas bersih. |
| 3 | **Otomasi Sales Force (SFA)** | `SalesForceModule.tsx` | - Visit Planner & Geo-Tagging untuk absensi kunjungan fasyankes berbasis GPS.<br>- Product Knowledge & Digital Brosur (akses spek teknis & NIE).<br>- Mobile Order Taking (Pre-Order langsung dari lapangan). |
| 4 | **Manajemen Order & Penjualan** | `SalesOrderModule.tsx` | - Izin Edar & Compliance Validator (penolakan otomatis jika NIE kedaluwarsa).<br>- Multi-Level Pricing & Discount Engine.<br>- Credit Limit & TOP Control.<br>- Pilihan promosi FOC yang layak berdasarkan SKU pemicu, minimum, tanggal, kanal, dan pelanggan; snapshot kit disimpan pada SO.<br>- Eksekusi alokasi FEFO sadar-kunci untuk produk utama dan komponen kit secara atomik. |
| 5 | **Marketing, Promo & Campaign** | `KampanyeMarketingModule.tsx` | - Event & Simposium Manager (seminar kedokteran & pameran alkes).<br>- Sample & Demo Unit Tracking (peminjaman unit alat ke RS untuk uji coba).<br>- Loyalty & Rebate Program (bonus akhir tahun fasyankes pencapai target). |
| 6 | **Newsletter & Mailing List** | `ListmonkModule.tsx` | - Kampanye email pemasaran, buletin regulasi Kemenkes, dan pengumuman pembaruan e-Katalog kepada mitra fasyankes. |
| 7 | **Analitik & Dashboard (BI)** | `AnalitikSalesModule.tsx` | - Sales Performance Dashboard (analisis per sales, per produk, per wilayah).<br>- Demand Forecasting prediktif untuk mencegah stockout/overstock di gudang/pabrik. |
| 8 | **Promosi FOC & Sales Kit** | `PromosiFocModule.tsx` | - Konfigurasi manual SKU pemicu, minimum pembelian, pilihan kit dan komponen, batas kit/pesanan, periode, kanal, dan pelanggan sasaran.<br>- Kit tampil sebagai baris Rp0 tanpa PPN pada faktur; rincian komponen dan batch FEFO tampil pada Surat Jalan.<br>- Draf biaya promosi 5240 dibuat di Finance hanya dari valuasi batch `ASLI`; jurnal tidak dibuat otomatis atau diposting. |

---

## 2. Core Architecture & Database Strategy (target)
- **Arsitektur:** Modular Monolith siap scale-out, di mana modul Sales terintegrasi erat dengan *Inventory (WMS)* dan *Procurement*.
- **Database Partitioning & Master-Slave:** PostgreSQL dengan partisi tabel berdasarkan wilayah distribusi dan rentang waktu transaksi.
- **Audit Trail (ALCOA+):** Setiap perubahan harga, diskon, pagu kredit, dan status SO wajib mencatat log (User, Timestamp, Old Value, New Value).

---

## 3. Stack Teknologi Modul Sales
- **Frontend Stack**: React 19, TypeScript, Tailwind CSS v4, Lucide React, SFA interactive maps/geo-tagging UI, modal form builders.
- **State & Data Layer**: state sinkronisasi Express, cache browser dan Firebase sesuai konfigurasi; bukan koleksi PocketBase yang direncanakan semula.
- **Engine / Logika**: e-Katalog Pricing Engine, CDAKB Compliance Validator, FEFO Order Allocation, Landed Margin Calculator.

---

## 4. Koneksi Lintas Modul (target, kecuali jalur FEFO yang diuji)

```mermaid
graph TD
    Parent[System Blueprint - Root Parent] --> Com[Commercial, Sales & PMS Module]

    Com --> CRM[CRM & Prospek]
    Com --> SFA[Sales Force Automation]
    Com --> SO[Sales Order Processing]
    Com --> BI[Analitik & BI]

    %% Cross-Module Data Flows
    Promo[Promosi FOC & Sales Kit] --> SO[Sales Order Processing]
    SO -->|Produk utama + komponen kit FEFO atomik| WMS[WMS Warehouse Operations]
    WMS -->|Faktur/piutang; baris FOC Rp0| Finance[Finance & Accounting]
    WMS -->|Alokasi batch komponen| FOCJournal[Draf Beban Promosi 5240]
    SO -->|Product Recall / Quarantined Batch check| PMS[PMS & Vigilance Module]
    CRM -->|Approved Customer & NIE Verification| Reg[Regulatory Affairs Module]
```

1. **Sales Order ke WMS Gudang:** Eksekusi pengiriman mengalokasikan FEFO untuk produk utama dan seluruh komponen FOC sebelum mutasi stok; kekurangan satu komponen menolak seluruh pengiriman.
2. **Sales Order ke Finance & Accounting:** Eksekusi pengiriman membuat transaksi faktur/piutang untuk nilai pesanan utama. Kit dicatat sebagai baris tambahan Rp0 tanpa PPN dan tidak menambah omzet. Draf beban promosi 5240 disusun terpisah di Finance dari batch yang dialokasikan dan hanya jika semua valuasi berstatus `ASLI`; pengguna Finance tetap meninjau dan mem-posting draf.
3. **Sales ke Regulatory Affairs:** Validasi nomor izin edar (NIE) terhubung langsung dengan master data registrasi Kemenkes di modul RA.
4. **Sales ke PMS & Vigilance:** Riwayat pembelian fasyankes pada Sales Order menjadi acuan penarikan produk (*product recall*) jika terjadi insiden di lapangan.

---

## 5. Changelog & Versioning

| Versi | Tanggal | Deskripsi Perubahan |
|:--- |:--- |:--- |
| **v1.0.0** | 2026-11-05 | Inisialisasi cetak biru komprehensif modul Sales & Marketing / SDAK mencakup 7 sub-modul, regulasi etika promosi alkes, CDAKB validator, dan integrasi Parent-Child System. |
| **v1.1.0** | 2026-11-25 | Implementasi awal lokal Promosi FOC & Sales Kit: konfigurasi Sales, snapshot SO, alokasi FEFO komponen atomik, baris faktur Rp0, dan draf beban promosi berbasis valuasi ASLI. Belum diverifikasi di staging. |

---
*Blueprint Sales & Marketing ini adalah spesifikasi baku yang mengikat seluruh pengembangan komersial pada AMS Integrated System (REMEDI).*
