import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import {
  bacaIdentitasVisualRingan,
  selesaikanGambar,
  terapkanFaviconAplikasi,
  type IdentitasVisualRingan
} from '../../utils/websitePrimitives';

export type IdentitasVisualAplikasi = IdentitasVisualRingan;

/**
 * Ambil identitas visual (logo & favicon) secara dinamis dari konfigurasi CMS Website
 * dan penyimpanan media aplikasi — tanpa menyeret database ERP maupun data benih statis.
 */
export function bacaIdentitasVisualAplikasi(): IdentitasVisualAplikasi {
  return bacaIdentitasVisualRingan();
}

/** Hook reaktif agar perubahan logo di CMS Website / Media langsung memperbarui seluruh aplikasi. */
export function useIdentitasVisualAplikasi(): IdentitasVisualAplikasi {
  const [identitas, setIdentitas] = useState<IdentitasVisualAplikasi>(() =>
    bacaIdentitasVisualAplikasi()
  );

  useEffect(() => {
    const segarkan = () => {
      const baru = bacaIdentitasVisualAplikasi();
      setIdentitas((lama) =>
        lama.nama === baru.nama &&
        lama.logoUrl === baru.logoUrl &&
        lama.faviconUrl === baru.faviconUrl
          ? lama
          : baru
      );
    };
    const padaStorage = (e: StorageEvent) => {
      if (!e.key || e.key.includes('website')) segarkan();
    };
    const padaTulisLokal = (e: Event) => {
      const detail = (e as CustomEvent<{ key?: string }>).detail;
      if (!detail?.key || detail.key.includes('website')) segarkan();
    };
    window.addEventListener('storage', padaStorage);
    window.addEventListener('ams:local-setting-write', padaTulisLokal);
    window.addEventListener('ams:public-identity-update', segarkan);
    return () => {
      window.removeEventListener('storage', padaStorage);
      window.removeEventListener('ams:local-setting-write', padaTulisLokal);
      window.removeEventListener('ams:public-identity-update', segarkan);
    };
  }, []);

  return identitas;
}

export { terapkanFaviconAplikasi };

/**
 * Komponen logo standar aplikasi. Membaca URL gambar dari CMS/Media secara dinamis
 * (atau lewat prop `overrideUrl`), dengan fallback ikon hanya bila gambar belum tersedia.
 */
export default function LogoAplikasi({
  overrideUrl,
  alt,
  ukuran = 'md',
  className = ''
}: {
  overrideUrl?: string;
  alt?: string;
  ukuran?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const identitas = useIdentitasVisualAplikasi();
  const sumberMentah = overrideUrl !== undefined ? overrideUrl : identitas.logoUrl;
  const resolvedUrl = selesaikanGambar(sumberMentah);
  const [gagalMuat, setGagalMuat] = useState(false);

  useEffect(() => {
    setGagalMuat(false);
  }, [resolvedUrl]);

  const dimensi =
    ukuran === 'sm'
      ? 'w-8 h-8 rounded-lg'
      : ukuran === 'lg'
        ? 'w-11 h-11 rounded-xl'
        : 'w-9 h-9 rounded-xl';

  if (resolvedUrl && !gagalMuat) {
    return (
      <div
        className={`${dimensi} bg-white border border-slate-200 flex items-center justify-center overflow-hidden shadow-xs shrink-0 p-1 ${className}`}
      >
        <img
          src={resolvedUrl}
          alt={alt || identitas.nama || 'Logo Perusahaan'}
          onError={() => setGagalMuat(true)}
          className="w-full h-full object-contain"
        />
      </div>
    );
  }

  return (
    <div
      className={`${dimensi} bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white shadow-xs shrink-0 ring-2 ring-blue-500/20 ${className}`}
    >
      <ShieldCheck className={ukuran === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} />
    </div>
  );
}
