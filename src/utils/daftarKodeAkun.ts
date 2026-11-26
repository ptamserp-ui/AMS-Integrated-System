export interface ReferensiKodeAkun {
  id: string;
  kode: string;
  nama: string;
  kelompok: string;
}

export function akunDariMarkdown(markdown: string): ReferensiKodeAkun[] {
  const isi = markdown.split('## Daftar akun')[1]?.split('## Pedoman penerapan')[0];
  if (!isi) throw new Error('Bagian daftar akun pada dokumen sumber tidak ditemukan.');
  let kelompok = '';
  const akun: ReferensiKodeAkun[] = [];
  for (const line of isi.split(/\r?\n/)) {
    if (line.startsWith('### ')) kelompok = line.slice(4).trim();
    const row = /^\| (\d{4}) \| (.+?) \|$/.exec(line);
    if (row) akun.push({ id: `REF-${row[1]}`, kode: row[1], nama: row[2], kelompok });
  }
  if (!akun.length || new Set(akun.map((item) => item.kode)).size !== akun.length)
    throw new Error('Daftar akun sumber kosong atau memiliki kode duplikat.');
  return akun;
}

export function validasiReferensiKodeAkun(akun: readonly ReferensiKodeAkun[]): void {
  const ids = new Set<string>();
  const codes = new Set<string>();
  for (const item of akun) {
    if (!item || typeof item.id !== 'string' || !item.id.trim() || ids.has(item.id))
      throw new Error('Identitas akun kosong atau duplikat.');
    if (typeof item.kode !== 'string' || !/^\d{4}(?:\.\d{2})*$/.test(item.kode))
      throw new Error('Kode harus berupa empat angka, dengan sub-akun opsional seperti 1003.01.');
    if (codes.has(item.kode)) throw new Error(`Kode ${item.kode} sudah digunakan.`);
    if (typeof item.nama !== 'string' || !item.nama.trim() ||
        typeof item.kelompok !== 'string' || !item.kelompok.trim())
      throw new Error('Nama dan kelompok akun wajib diisi.');
    ids.add(item.id);
    codes.add(item.kode);
  }
}
