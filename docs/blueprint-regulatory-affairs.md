> **Status 25 November 2026: sebagian.** UI NIE/PJT dan data contoh tersedia; state server disinkronkan dengan cache browser. Koneksi atau validasi langsung ke OSS RBA/Kemenkes/e-Watch belum terbukti. Alur lintas modul di bawah adalah target, bukan bukti koneksi regulator.

# Blueprint - Regulatory Affairs & PJT Management (Child)

Status: **Blueprint historis; implementasi parsial**

Parent Document: `/docs/system-blueprint.md` (Domain: Regulatory & Quality Compliance)  
Sasaran: `src/components/modules/regulatory/RegulatoryModule.tsx`
Coded by Langgo Bramandityo

---

## 1. STACK TEKNOLOGI MODUL
- **Frontend Stack**: React 19, TypeScript, Tailwind CSS v4, Lucide React, Modal Dialogs & Table Grids.
- **State & Data Layer**: state sinkronisasi Express dan cache browser; koleksi PocketBase tersebut bukan skema aktif.
- **Engine / Logika**: NIE Expiry Alert Validator, PJT Credential & SKP Verification Engine.

---

## 2. KONEKSI LINTAS MODUL (TARGET)
- **Hubungan dengan Parent (`system-blueprint.md`):** Merupakan fondasi legalitas dan regulasi Kemenkes RI yang mengamankan seluruh operasional perusahaan di bawah Root Parent.
- **Koneksi ke Child Modul Lain:**
  - *Procurement & Sales*: Menyediakan validasi nomor izin edar (NIE) aktif sebelum PO atau Sales Order diterbitkan.
  - *WMS Gudang*: Mencegah penerimaan atau pengeluaran alkes yang izin edarnya kedaluwarsa.
