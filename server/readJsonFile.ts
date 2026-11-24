import fs from 'fs';

export function readJsonFileIfPresent(file: string, label: string): unknown | undefined {
  let raw: string;
  try {
    raw = fs.readFileSync(file, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      try {
        fs.lstatSync(file);
      } catch (statError) {
        if (statError instanceof Error && 'code' in statError && statError.code === 'ENOENT') {
          return undefined;
        }
        throw new Error(`Gagal memeriksa ${label} "${file}". Berkas tidak diubah.`, { cause: statError });
      }
    }
    throw new Error(`Gagal membaca ${label} "${file}". Berkas tidak diubah.`, { cause: error });
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch (error) {
    throw new Error(`${label} "${file}" rusak. Berkas tidak diubah; pulihkan dari backup.`, { cause: error });
  }
}
