import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AMSDatabaseManager } from '../../src/services/pocketbase';
import {
  attachFirestoreRealtimeSync,
  authFirebase,
  hydrateCloudStateOnServer,
  pullAllCloudStateFromFirestore,
  pushRbacSnapshotToFirestore,
  pushSyncEntryToFirestore,
  subscribeFirebaseAuthState
} from '../../src/services/firebase';

vi.mock('../../src/services/firebase', () => ({
  authFirebase: { currentUser: { emailVerified: true, getIdToken: vi.fn().mockResolvedValue('firebase-token-uji') } },
  attachFirestoreRealtimeSync: vi.fn(),
  deleteSyncEntryFromFirestore: vi.fn(),
  fetchPublicSiteFromFirestore: vi.fn(),
  getFirebaseProjectInfo: vi.fn(() => ({})),
  hydrateCloudStateOnServer: vi.fn(),
  pullAllCloudStateFromFirestore: vi.fn(),
  pushArchiveConfigToFirestore: vi.fn(),
  pushPublicSiteToFirestore: vi.fn(),
  pushRbacSnapshotToFirestore: vi.fn(),
  pushSyncEntryToFirestore: vi.fn(),
  subscribeFirebaseAuthState: vi.fn()
}));

describe('sinkronisasi Firebase untuk RFQ website', () => {
  const cloudRfq = [{ id: 'RFQ-CLOUD' }];
  const serverRfq = [...cloudRfq, { id: 'RFQ-SERVER' }];
  const cloud = {
    entries: {
      sales_website_rfq: {
        value: cloudRfq, version: 5, updatedAt: '2099-01-01T00:00:00.000Z', updatedBy: 'cloud-uji'
      }
    },
    roles: [],
    users: []
  };
  let manager: AMSDatabaseManager;

  beforeEach(() => {
    const storage = new Map<string, string>();
    storage.set('ams_alkes_sesi_login_v2', JSON.stringify({ token: 'server-token-uji' }));
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
      key: (index: number) => [...storage.keys()][index] ?? null,
      get length() { return storage.size; }
    });
    vi.mocked(pullAllCloudStateFromFirestore).mockResolvedValue(cloud);
    vi.mocked(hydrateCloudStateOnServer).mockResolvedValue();
    vi.mocked(pushSyncEntryToFirestore).mockResolvedValue();
    vi.mocked(pushRbacSnapshotToFirestore).mockResolvedValue({ rolesPushed: 0, usersPushed: 0 });
    manager = new AMSDatabaseManager();
    vi.spyOn(manager, 'syncFromServer').mockResolvedValue([]);
    vi.spyOn(manager, 'archivePocketBaseSettingsToCloud').mockResolvedValue();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('menghentikan unggahan dan melaporkan kegagalan jika server menolak pemulihan RFQ', async () => {
    vi.mocked(hydrateCloudStateOnServer).mockRejectedValueOnce(new Error('Konflik RFQ sintetis.'));
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const hasil = await manager.syncWithFirebaseCloud();
    expect(hasil.ok).toBe(false);
    expect(hasil.pesan).toContain('Konflik RFQ sintetis');
    expect(manager.getConnectionStatus().firebaseSyncError).toContain('Konflik RFQ sintetis');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(pushSyncEntryToFirestore).not.toHaveBeenCalled();
  });

  it('mencadangkan gabungan RFQ meskipun jam snapshot cloud lebih baru', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url === '/api/sync/state'
      ? Response.json({ entries: { sales_website_rfq: {
        value: serverRfq, version: 6, updatedAt: '2026-01-01T00:00:00.000Z', updatedBy: 'server-uji'
      } } })
      : Response.json({ roles: [], users: [] })));

    const hasil = await manager.syncWithFirebaseCloud();
    expect(hasil.ok).toBe(true);
    expect(pushSyncEntryToFirestore).toHaveBeenCalledWith('sales_website_rfq', serverRfq, 6, 'server-uji');
  });

  it.each([
    ['/api/sync/state', 500],
    ['/api/firebase/rbac-snapshot', 403]
  ])('tidak melaporkan sukses atau mengunggah saat %s gagal', async (gagal, status) => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => url === gagal
      ? Response.json({ pesan: 'Gagal sintetis' }, { status })
      : Response.json(url === '/api/sync/state' ? { entries: {} } : { roles: [], users: [] })));

    const hasil = await manager.syncWithFirebaseCloud();
    expect(hasil.ok).toBe(false);
    expect(hasil.pesan).toContain(`HTTP ${status}`);
    expect(pushSyncEntryToFirestore).not.toHaveBeenCalled();
  });

  it('tidak menimpa atau menghapus draf, publikasi, dan RFQ server dari realtime Firebase yang usang', async () => {
    localStorage.setItem('ams_alkes_website_draft', JSON.stringify({ judul: 'Draf server' }));
    localStorage.setItem('ams_alkes_website_published', JSON.stringify({ judul: 'Tayang server' }));
    localStorage.setItem('ams_alkes_sales_website_rfq', JSON.stringify(serverRfq));
    vi.stubGlobal('window', Object.assign(new EventTarget(), {
      location: { protocol: 'https:', host: 'ams.test', origin: 'https://ams.test' }
    }));
    vi.stubGlobal('BroadcastChannel', undefined);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ activeDriver: 'firebase' })));
    vi.mocked(attachFirestoreRealtimeSync).mockReturnValue(() => {});
    vi.mocked(subscribeFirebaseAuthState).mockImplementation((callback) => {
      callback(authFirebase.currentUser);
      return () => {};
    });
    const realtimeManager = new AMSDatabaseManager();
    const bacaServer = vi.spyOn(realtimeManager, 'syncFromServer').mockResolvedValue([]);
    await vi.waitFor(() => expect(attachFirestoreRealtimeSync).toHaveBeenCalled());
    const callbacks = vi.mocked(attachFirestoreRealtimeSync).mock.calls.at(-1)?.[0];
    if (!callbacks) throw new Error('Pendengar Firebase tidak terpasang.');
    const entriLama = { value: [], version: 1, updatedAt: '2020-01-01', updatedBy: 'cloud-uji' };
    callbacks.onEntriesChanged({
      website_draft: entriLama,
      website_published: entriLama,
      sales_website_rfq: entriLama
    });
    callbacks.onEntriesRemoved?.(['website_draft', 'website_published', 'sales_website_rfq']);

    expect(JSON.parse(localStorage.getItem('ams_alkes_website_draft')!)).toEqual({ judul: 'Draf server' });
    expect(JSON.parse(localStorage.getItem('ams_alkes_website_published')!)).toEqual({ judul: 'Tayang server' });
    expect(JSON.parse(localStorage.getItem('ams_alkes_sales_website_rfq')!)).toEqual(serverRfq);
    expect(bacaServer).toHaveBeenCalledTimes(2);
  });
});
