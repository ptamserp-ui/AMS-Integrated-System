import { describe, expect, it } from 'vitest';
import {
  executeRoleScopedSearch,
  PESAN_AKSES_PENCARIAN_DITOLAK
} from '../../src/utils/globalSearch';

const SAMPLE_COLLECTIONS: Record<string, unknown[]> = {
  izin_edar: [
    {
      id: 'IE-01',
      namaAlkes: 'Patient Monitor Multiparameter',
      nomorIzinEdar: 'KEMENKES RI AKL 20901234567',
      produsen: 'Avner Medical'
    }
  ],
  transaksi: [
    {
      id: 'TRX-01',
      nomorFaktur: 'INV-2026-889',
      fasyankes: 'RSUP Dr. Sardjito',
      keterangan: 'Pembayaran pengadaan monitor pasien'
    }
  ],
  hris_karyawan: [
    {
      id: 'EMP-01',
      namaLengkap: 'Rina Kusuma',
      departemen: 'Quality Assurance',
      jabatan: 'Staff QA'
    }
  ],
  audit_trail: [
    {
      id: 'LOG-01',
      modul: 'Finance & Accounting',
      aktivitas: 'Posting jurnal rahasia periode tutup buku',
      nomorReferensi: 'JRN-2026-099',
      hash: 'secret_hash_abcdef123456',
      dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=='
    }
  ]
};

describe('Pencarian teks global berbasis akses role (RBAC)', () => {
  it('mengembalikan seluruh data cocok untuk pengguna dengan akses penuh tanpa notifikasi penolakan', () => {
    const hasil = executeRoleScopedSearch({
      query: 'Monitor',
      collections: SAMPLE_COLLECTIONS,
      aksesAktif: {
        aksesPenuh: true,
        modulDiizinkan: ['ra-pjt', 'finance-akuntansi', 'hrd-pelatihan', 'it-traceability']
      }
    });

    expect(hasil.totalAllowedMatches).toBe(2);
    expect(hasil.results.map((r) => r.collectionKey)).toEqual(['izin_edar', 'transaksi']);
    expect(hasil.hasRestrictedMatches).toBe(false);
    expect(hasil.restrictedMatchCount).toBe(0);
    expect(hasil.notificationMessage).toBeNull();
  });

  it('memblokir data di modul tanpa izin dan memunculkan notifikasi kredensial supervisor', () => {
    const hasil = executeRoleScopedSearch({
      query: 'INV-2026-889',
      collections: SAMPLE_COLLECTIONS,
      aksesAktif: {
        aksesPenuh: false,
        modulDiizinkan: ['hrd-pelatihan']
      },
      sesi: {
        permissions: {
          'hrd-pelatihan': ['view']
        }
      }
    });

    expect(hasil.results).toHaveLength(0);
    expect(hasil.totalAllowedMatches).toBe(0);
    expect(hasil.hasRestrictedMatches).toBe(true);
    expect(hasil.restrictedMatchCount).toBe(1);
    expect(hasil.notificationMessage).toBe(PESAN_AKSES_PENCARIAN_DITOLAK);
  });

  it('hanya menampilkan hasil modul yang diizinkan saat keyword juga muncul di modul terbatas', () => {
    const hasil = executeRoleScopedSearch({
      query: 'Monitor',
      collections: SAMPLE_COLLECTIONS,
      aksesAktif: {
        aksesPenuh: false,
        modulDiizinkan: ['ra-pjt']
      },
      sesi: {
        permissions: {
          'ra-pjt': ['view']
        }
      }
    });

    expect(hasil.totalAllowedMatches).toBe(1);
    expect(hasil.results).toHaveLength(1);
    expect(hasil.results[0]?.moduleId).toBe('ra-pjt');
    expect(hasil.hasRestrictedMatches).toBe(true);
    expect(hasil.restrictedMatchCount).toBe(1);
    expect(hasil.notificationMessage).toBe(PESAN_AKSES_PENCARIAN_DITOLAK);
  });

  it('tidak menampilkan audit_trail jika peran tidak memiliki izin audit-trail:view', () => {
    const hasil = executeRoleScopedSearch({
      query: 'JRN-2026-099',
      collections: SAMPLE_COLLECTIONS,
      aksesAktif: {
        aksesPenuh: false,
        modulDiizinkan: ['it-traceability']
      },
      sesi: {
        permissions: {
          'it-traceability': ['view']
        }
      }
    });

    expect(hasil.results).toHaveLength(0);
    expect(hasil.hasRestrictedMatches).toBe(true);
    expect(hasil.notificationMessage).toBe(PESAN_AKSES_PENCARIAN_DITOLAK);
  });

  it('mengabaikan field hash teknis dan payload base64 gambar serta tidak memicu notifikasi bila data memang tidak ada', () => {
    const hasilHash = executeRoleScopedSearch({
      query: 'secret_hash_abcdef',
      collections: SAMPLE_COLLECTIONS,
      aksesAktif: { aksesPenuh: true, modulDiizinkan: ['it-traceability'] }
    });
    const hasilBase64 = executeRoleScopedSearch({
      query: 'iVBORw0KGgo',
      collections: SAMPLE_COLLECTIONS,
      aksesAktif: { aksesPenuh: true, modulDiizinkan: ['it-traceability'] }
    });

    expect(hasilHash.results).toHaveLength(0);
    expect(hasilHash.hasRestrictedMatches).toBe(false);
    expect(hasilHash.notificationMessage).toBeNull();
    expect(hasilBase64.results).toHaveLength(0);
  });
});
