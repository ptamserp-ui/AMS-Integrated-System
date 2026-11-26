import dokumen from '../../docs/daftar-kode-akun.md?raw';
import { akunDariMarkdown } from '../utils/daftarKodeAkun';

export const DOKUMEN_REFERENSI_AKUN = dokumen;
export const INITIAL_REFERENSI_KODE_AKUN = akunDariMarkdown(dokumen);
