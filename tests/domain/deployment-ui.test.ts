import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/pocketbase', () => ({
  db: {
    getAuditTrail: () => [],
    getConnectionStatus: () => ({ activeDbDriver: 'firebase' }),
    getRingkasanAsalData: () => ({
      koleksi: [],
      manifest: { dummyDihapus: false },
      totalDummy: 0,
      totalUserBaru: 0,
      totalUserDiedit: 0,
      totalMasterSistem: 0,
      totalKonfigurasiUser: 0
    }),
    getJejakPergerakan: () => [],
    periksaRantaiJurnal: () => ({})
  }
}));
vi.mock('../../src/hooks/useDbSync', () => ({ useDbTick: () => 0 }));
vi.mock('../../src/utils/autentikasi', () => ({
  bacaSesi: () => null,
  punyaIzin: () => false,
  authFetch: vi.fn(),
  hubungkanGoogleFirebaseUntukSync: vi.fn()
}));

import ITModule from '../../src/components/modules/supporting/ITModule';

describe('navigasi modul IT tanpa panduan deployment', () => {
  it.each(['traceability', 'audit'] as const)('mempertahankan navigasi operasional tanpa panduan pada tab %s', (activeTab) => {
    const html = renderToStaticMarkup(React.createElement(ITModule, { activeTab }));
    expect(html).toContain('Penyimpanan &amp; Sinkronisasi');
    expect(html).toContain('Jejak Audit Trail Digital');
    expect(html).not.toContain('Panduan Deployment Linux');
    expect(html).not.toContain('panduan deployment');
    expect(html).not.toContain('deploy-linux.ps1');
    expect(html).not.toContain('ams.bejodigitalprint.com');
    expect(html).not.toContain('NSSM');
    expect(html).not.toContain('deploy.ps1');
  });
});
