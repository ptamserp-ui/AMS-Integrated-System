import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { BAGIAN_WEBSITE, type Medan } from '../../src/components/modules/website/skema';
import { LABEL_HALAMAN, MedanEditor } from '../../src/components/modules/website/editor/medanEditor';
import WebsiteModule, { nilaiPembaruanDraf } from '../../src/components/modules/website/WebsiteModule';
import { translateWebsiteUi } from '../../src/components/modules/website/site/WebsiteLanguage';
import type { SesiLogin } from '../../src/utils/autentikasi';
import { SEKSI_BERANDA_LABEL } from '../../src/utils/tampilan';
import { bangunKontenDefault } from '../../src/utils/website';

describe('CMS Website — Kategori Produk & daftar segmen halaman', () => {
  it('membedakan notifikasi media dari konflik draf dan penerimaan perubahan pengguna lain', () => {
    const tersimpan = 'draf tersimpan';
    const suntingan = 'draf disunting';
    const penggunaLain = 'draf pengguna lain';
    expect(nilaiPembaruanDraf(tersimpan, suntingan, tersimpan)).toBe('abaikan');
    expect(nilaiPembaruanDraf(tersimpan, suntingan, penggunaLain)).toBe('konflik');
    expect(nilaiPembaruanDraf(tersimpan, tersimpan, penggunaLain)).toBe('terapkan');
    expect(nilaiPembaruanDraf(tersimpan, suntingan, suntingan)).toBe('sama');
  });

  it('membatasi editor untuk peran baca saja dan mengizinkannya untuk peran pembuat draf', () => {
    const sesi: SesiLogin = {
      userId: 'USR-UJI', namaPengguna: 'pengguna-uji', namaLengkap: 'Pengguna Uji', email: '',
      departemen: '', peran: 'karyawan', namaPeran: 'Pembaca', permissions: { website: ['view'] },
      masukPada: '', expiresAt: '', token: 'token-uji'
    };
    const baca = renderToStaticMarkup(createElement(WebsiteModule, { currentRole: sesi.peran, sesi }));
    expect(baca).toContain('<fieldset disabled=""');
    expect(baca).toContain('hanya dapat melihat konten website');

    const pembuat: SesiLogin = { ...sesi, permissions: { website: ['view', 'create'] } };
    const sunting = renderToStaticMarkup(createElement(WebsiteModule, {
      currentRole: sesi.peran,
      sesi: pembuat
    }));
    expect(sunting).not.toContain('<fieldset disabled=""');
    expect(sunting).toContain('dapat menyunting draf');
  });

  it('menghubungkan label ke setiap bidang editor sederhana dengan ID yang unik', () => {
    const medan: Medan[] = [
      { kind: 'teks', key: 'nama', label: 'Nama' },
      { kind: 'textarea', key: 'deskripsi', label: 'Deskripsi' },
      { kind: 'daftarTeks', key: 'daftar', label: 'Daftar' },
      { kind: 'angka', key: 'jumlah', label: 'Jumlah' },
      { kind: 'pilihan', key: 'pilihan', label: 'Pilihan', opsi: ['Satu'] }
    ];
    const html = renderToStaticMarkup(createElement('div', null, ...medan.map((item) =>
      createElement(MedanEditor, { key: item.key, medan: item, nilai: '', onChange: () => {} })
    )));
    const labels = [...html.matchAll(/<label\b[^>]*\bfor="([^"]+)"/g)].map((match) => match[1]);
    const controls = [...html.matchAll(/<(?:input|textarea|select)\b[^>]*\bid="([^"]+)"/g)].map((match) => match[1]);

    expect(labels).toHaveLength(medan.length);
    expect(controls).toEqual(labels);
    expect(new Set(controls).size).toBe(medan.length);
  });

  it('mengubah label Solusi per Kategori menjadi Kategori Produk pada skema & susunan beranda', () => {
    const bagianSolusi = BAGIAN_WEBSITE.find((b) => b.kunci === 'solusi');
    expect(bagianSolusi?.label).toBe('Kategori Produk');
    expect(SEKSI_BERANDA_LABEL.solusi).toBe('Kategori Produk');
  });

  it('menyediakan segmen halaman yang dapat dipilih sesuai daftar resmi', () => {
    const segmen = (['beranda', 'produk', 'solusi', 'layanan', 'sumber-daya', 'tentang', 'kontak'] as const).map(
      (k) => LABEL_HALAMAN[k]
    );
    expect(segmen).toEqual([
      'Beranda',
      'Produk',
      'Kategori Produk',
      'Layanan',
      'Sumber Daya',
      'Tentang Kami',
      'Kontak'
    ]);
  });

  it('menggunakan label Kategori Produk pada menu bawaan, tautan footer, dan terjemahan UI', () => {
    const cfg = bangunKontenDefault({
      izinEdar: [],
      sertifikat: [],
      pemasok: [],
      pelanggan: [],
      kampanye: [],
      teritorial: [],
      stok: [],
      pengetahuanProduk: [],
      skemaHarga: [],
      rebate: [],
      garansi: [],
      produkKatalog: []
    });

    const menuSolusi = cfg.menu.find((m) => m.id === 'menu-solusi');
    expect(menuSolusi?.label).toBe('Kategori Produk');
    expect(cfg.solusi.kepala.teksTautan).toBe('Semua Kategori Produk');

    const footerNav = cfg.footerKolom.find((k) => k.id === 'footer-navigasi');
    const footerSolusi = footerNav?.tautan.find((t) => t.id === 'footer-solusi');
    expect(footerSolusi?.label).toBe('Kategori Produk');
    expect(translateWebsiteUi('Kategori Produk', 'en')).toBe('Product Categories');
  });
});
