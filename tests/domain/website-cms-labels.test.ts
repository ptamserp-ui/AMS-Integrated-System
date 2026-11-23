import { describe, expect, it } from 'vitest';
import { BAGIAN_WEBSITE } from '../../src/components/modules/website/skema';
import { LABEL_HALAMAN } from '../../src/components/modules/website/editor/medanEditor';
import { translateWebsiteUi } from '../../src/components/modules/website/site/WebsiteLanguage';
import { SEKSI_BERANDA_LABEL } from '../../src/utils/tampilan';
import { bangunKontenDefault } from '../../src/utils/website';

describe('CMS Website — Kategori Produk & daftar segmen halaman', () => {
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
