import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/pocketbase', () => ({
  db: {
    getAuditTrail: () => [],
    getConnectionStatus: () => ({ activeDbDriver: 'firebase' }),
    getRingkasanAsalData: () => ({ koleksi: [] }),
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

describe('panduan deployment modul IT', () => {
  it('menampilkan arahan Linux tanpa domain atau perintah infrastruktur lama', () => {
    const html = renderToStaticMarkup(React.createElement(ITModule, { activeTab: 'deployment' }));
    expect(html).toContain('Panduan Deployment Linux');
    expect(html).not.toContain('ams.bejodigitalprint.com');
    expect(html).not.toContain('NSSM');
    expect(html).not.toContain('deploy.ps1');
  });
});
