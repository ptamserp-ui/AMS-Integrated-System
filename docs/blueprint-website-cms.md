> **Status 25 November 2026: sebagian.** CMS dan snapshot Express tersedia; draf dan snapshot memakai state sinkronisasi dengan cache browser, serta salinan snapshot pada disk. Penerbitan memerlukan izin server atau token valid. Ketersediaan lintas perangkat bergantung pada konfigurasi dan hasil sinkronisasi; lihat [SRS CMS](./srs-cms-website.md).

# Blueprint - Situs Web Publik & Portal Remedi (Child)

Status: **Blueprint historis; implementasi parsial**

Parent Document: `/docs/system-blueprint.md` (Domain: Situs Web Publik & CMS)  
Sasaran: `src/components/modules/website/WebsiteModule.tsx`
Coded by Langgo Bramandityo

---

## 1. STACK TEKNOLOGI MODUL
- **Frontend Stack**: React SPA, TypeScript, Tailwind CSS v4, Lucide React, MedanEditor & SectionsEditor UI components.
- **State & Data Layer**: state sinkronisasi Express, cache browser, salinan snapshot dan JSON rujukan (`websiteRujukan.ts`).
- **Engine / Logika**: Dynamic Section Rendering Engine, Live CMS Preview & Layout Builder.

---

## 2. KONEKSI LINTAS MODUL (PARENT-CHILD INTEGRATION)
- **Hubungan dengan Parent (`system-blueprint.md`):** Modul ini merepresentasikan Domain Situs Web Publik pada arsitektur Modular Monolith REMEDI, menyediakan antarmuka eksternal bagi fasyankes/publik.
- **Koneksi ke Child Modul Lain:**
  - *Regulatory & Sales*: Menyusun katalog dari data aplikasi; status NIE dan harga harus diverifikasi terhadap sumber resmi, bukan dianggap terhubung ke LKPP.
