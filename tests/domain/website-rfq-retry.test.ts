import { afterEach, describe, expect, it, vi } from 'vitest';
import { siapkanPermintaanRfq } from '../../src/utils/websiteRfq';

describe('identitas pengulangan RFQ', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('menggunakan ID yang sama setelah muat ulang tanpa menyimpan isi formulir', async () => {
    const data = new Map<string, string>();
    vi.stubGlobal('sessionStorage', {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value)
    });
    const isi = JSON.stringify({ instansi: 'Klinik Sintetis', kontak: 'uji@example.invalid' });
    const awal = await siapkanPermintaanRfq(isi, null);
    const setelahMuatUlang = await siapkanPermintaanRfq(isi, null);
    const berubah = await siapkanPermintaanRfq(`${isi} baru`, setelahMuatUlang);

    expect(setelahMuatUlang.id).toBe(awal.id);
    expect(setelahMuatUlang.tersimpanDiSesi).toBe(true);
    expect(berubah.id).not.toBe(awal.id);
    expect([...data.values()].join('')).not.toContain('uji@example.invalid');
  });

  it('mempertahankan ID dalam memori dan menandai keterbatasan saat penyimpanan sesi gagal', async () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => { throw new Error('storage blocked'); }
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const awal = await siapkanPermintaanRfq('isi sintetis', null);
    const ulang = await siapkanPermintaanRfq('isi sintetis', awal);

    expect(awal.tersimpanDiSesi).toBe(false);
    expect(ulang.id).toBe(awal.id);
  });
});
