import fs from 'fs';

export function assertNoPendingJsonFile(file: string, label: string): void {
  const pending = `${file}.tmp`;
  try {
    fs.lstatSync(pending);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return;
    throw new Error(`Gagal memeriksa berkas sementara ${label} "${pending}". Berkas tidak diubah.`, { cause: error });
  }
  throw new Error(`${label} "${file}" hilang, tetapi berkas sementara "${pending}" masih ada. Berkas tidak diubah; periksa dan pulihkan dari backup.`);
}

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
