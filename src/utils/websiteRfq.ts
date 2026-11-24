const KUNCI_PERMINTAAN_SESI = 'ams_web_rfq_request_v1';
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const MAKS_PRODUK_RFQ = 30;
export const MAKS_JUMLAH_RFQ = 1_000_000;

export function jumlahRfqValid(jumlah: unknown): jumlah is number {
  return typeof jumlah === 'number' && Number.isSafeInteger(jumlah) && jumlah >= 1 && jumlah <= MAKS_JUMLAH_RFQ;
}

export function validasiBatasProdukRfq(produk: readonly { jumlah: unknown }[]): string | null {
  if (produk.length > MAKS_PRODUK_RFQ) {
    return 'Maksimal 30 produk per permintaan. Hapus produk yang berlebih atau kirim permintaan terpisah.';
  }
  if (produk.some((item) => !jumlahRfqValid(item.jumlah))) {
    return 'Jumlah setiap produk harus berupa bilangan bulat antara 1 dan 1.000.000. Ubah jumlah atau hapus dan tambahkan kembali produk.';
  }
  return null;
}

export interface PermintaanRfqSesi {
  isi: string;
  id: string;
  tersimpanDiSesi: boolean;
}

export async function siapkanPermintaanRfq(
  isi: string,
  sebelumnya: PermintaanRfqSesi | null
): Promise<PermintaanRfqSesi> {
  if (sebelumnya?.isi === isi) return sebelumnya;
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(isi));
  const sidik = Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, '0')).join('');
  let id: string = crypto.randomUUID();

  try {
    const raw = sessionStorage.getItem(KUNCI_PERMINTAAN_SESI);
    if (raw) {
      try {
        const lama = JSON.parse(raw) as { sidik?: unknown; id?: unknown };
        if (lama.sidik === sidik && typeof lama.id === 'string' && UUID_V4.test(lama.id)) {
          id = lama.id;
        }
      } catch (error) {
        console.warn('Identitas RFQ sesi sebelumnya tidak valid dan akan diganti.', error);
      }
    }
    sessionStorage.setItem(KUNCI_PERMINTAAN_SESI, JSON.stringify({ sidik, id }));
    return { isi, id, tersimpanDiSesi: true };
  } catch (error) {
    console.warn('Identitas RFQ tidak dapat disimpan di sesi browser.', error);
    return { isi, id, tersimpanDiSesi: false };
  }
}
