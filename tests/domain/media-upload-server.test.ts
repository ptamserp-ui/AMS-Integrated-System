import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  MAX_MEDIA_FILE_BYTES,
  ServerMediaStore,
  detectImageMagicFormat,
  encodeImageDataUrl
} from '../../server/mediaStore';
import {
  canDeleteMedia,
  canUploadMedia,
  containsMediaReference,
  mergeCatalogIntoPublishedSnapshot
} from '../../server/dataSyncStore';
import type { RoleDefinition, RolePermissionMatrix } from '../../src/types/index';

const createdDirs: string[] = [];

function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ams-media-store-test-'));
  createdDirs.push(dir);
  return dir;
}

function makeFakePng(): Buffer {
  // Valid PNG magic header + minimal IHDR-like trailing padding (>= 12 bytes)
  return Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52
  ]);
}

function makeFakeJpeg(): Buffer {
  return Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
    0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0xff, 0xd9
  ]);
}

function makeFakeWebp(): Buffer {
  return Buffer.from([
    0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00,
    0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20
  ]);
}

function makeRole(id: string, permissions: Record<string, string[]>): RoleDefinition {
  return {
    id,
    name: id,
    description: id,
    isSystem: true,
    permissions: permissions as RolePermissionMatrix,
    updatedAt: '2026-01-01T00:00:00.000Z'
  };
}

afterEach(() => {
  while (createdDirs.length > 0) {
    const dir = createdDirs.pop()!;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('ServerMediaStore — Penyimpanan Foto Real-Time di Server', () => {
  it.each([
    '{invalid json',
    'null',
    '{"items":[]}',
    '{"items":{"logo":null}}',
    '{"items":{"logo":{"id":"logo","ext":"png"}}}'
  ])('menolak indeks media rusak tanpa menimpa berkas: %s', (content) => {
    const dataDir = createTempDir();
    const file = path.join(dataDir, 'media-index.json');
    fs.writeFileSync(file, content);
    expect(() => new ServerMediaStore(dataDir)).toThrow(/(rusak|tidak valid)/);
    expect(fs.readFileSync(file, 'utf8')).toBe(content);
    expect(fs.existsSync(`${file}.tmp`)).toBe(false);
  });

  it('menolak indeks yang tidak dapat dibaca tanpa menggantinya', () => {
    const dataDir = createTempDir();
    const file = path.join(dataDir, 'media-index.json');
    fs.mkdirSync(file);
    expect(() => new ServerMediaStore(dataDir)).toThrow(/Gagal membaca Indeks media/);
    expect(fs.statSync(file).isDirectory()).toBe(true);
  });

  it('membaca indeks lama tanpa version dan mempertahankan akses media', () => {
    const dataDir = createTempDir();
    const store = new ServerMediaStore(dataDir);
    const meta = store.saveFromBuffer({ id: 'legacy-logo', bytes: makeFakePng(), visibility: 'internal' });
    fs.writeFileSync(path.join(dataDir, 'media-index.json'), JSON.stringify({ items: { [meta.id]: meta } }));
    const loaded = new ServerMediaStore(dataDir).getMedia(meta.id);
    expect(loaded?.meta.visibility).toBe('internal');
    expect(loaded?.bytes.equals(makeFakePng())).toBe(true);
  });

  it('menyimpan berkas PNG, JPEG, dan WebP asli ke disk uploads/ dan persisten lintas restart instance', () => {
    const dataDir = createTempDir();
    const store = new ServerMediaStore(dataDir);

    const pngMeta = store.saveFromBuffer({
      id: 'produk-01',
      bytes: makeFakePng(),
      filename: 'Alkes PNG Logo!!.png',
      visibility: 'public',
      scope: 'product-catalog',
      uploadedBy: 'admin.produk'
    });
    expect(pngMeta.contentType).toBe('image/png');
    expect(pngMeta.ext).toBe('png');
    expect(fs.existsSync(path.join(dataDir, 'uploads', 'produk-01.png'))).toBe(true);

    const jpegMeta = store.saveFromBuffer({
      id: 'banner-01',
      bytes: makeFakeJpeg(),
      filename: 'banner.jpg',
      visibility: 'public',
      scope: 'website'
    });
    expect(jpegMeta.contentType).toBe('image/jpeg');
    expect(fs.existsSync(path.join(dataDir, 'uploads', 'banner-01.jpg'))).toBe(true);

    const webpMeta = store.saveFromBuffer({
      id: 'kop-01',
      bytes: makeFakeWebp(),
      filename: 'kop.webp',
      visibility: 'internal',
      scope: 'dokumen-internal'
    });
    expect(webpMeta.contentType).toBe('image/webp');
    expect(fs.existsSync(path.join(dataDir, 'uploads', 'kop-01.webp'))).toBe(true);

    // Instance baru membaca media-index.json + file biner dari disk
    const reloaded = new ServerMediaStore(dataDir);
    const loadedPng = reloaded.getMedia('produk-01');
    expect(loadedPng).not.toBeNull();
    expect(loadedPng?.bytes.equals(makeFakePng())).toBe(true);
    expect(loadedPng?.meta.uploadedBy).toBe('admin.produk');
    expect(reloaded.listMeta({ visibility: 'internal' }).map((m) => m.id)).toEqual(['kop-01']);
  });

  it('menghapus ekstensi lama saat ID sama ditimpa dengan format baru dan mendukung deleteMedia', () => {
    const dataDir = createTempDir();
    const store = new ServerMediaStore(dataDir);

    store.saveFromBuffer({ id: 'foto-dinamis', bytes: makeFakePng(), filename: 'v1.png' });
    expect(fs.existsSync(path.join(dataDir, 'uploads', 'foto-dinamis.png'))).toBe(true);

    store.saveFromBuffer({ id: 'foto-dinamis', bytes: makeFakeJpeg(), filename: 'v2.jpg' });
    expect(fs.existsSync(path.join(dataDir, 'uploads', 'foto-dinamis.png'))).toBe(false);
    expect(fs.existsSync(path.join(dataDir, 'uploads', 'foto-dinamis.jpg'))).toBe(true);

    expect(store.deleteMedia('foto-dinamis')).toBe(true);
    expect(fs.existsSync(path.join(dataDir, 'uploads', 'foto-dinamis.jpg'))).toBe(false);
    expect(store.getMedia('foto-dinamis')).toBeNull();
  });

  it('menolak payload bukan gambar asli (magic bytes palsu), path traversal ID, dan berkas > 8 MB', () => {
    const dataDir = createTempDir();
    const store = new ServerMediaStore(dataDir);

    expect(detectImageMagicFormat(Buffer.from('<script>alert(1)</script>'))).toBeNull();
    expect(() =>
      store.saveFromBuffer({
        id: 'spoofed-1',
        bytes: Buffer.from('<svg onload=alert(1)></svg>')
      })
    ).toThrow(/Format gambar tidak valid/);

    expect(() =>
      store.saveFromDataUrl({
        id: 'spoofed-dataurl',
        dataUrl: `data:image/png;base64,${Buffer.from('not-a-real-png-binary').toString('base64')}`
      })
    ).toThrow(/Format gambar tidak valid/);

    expect(() =>
      store.saveFromBuffer({
        id: '../etc/passwd',
        bytes: makeFakePng()
      })
    ).toThrow(/ID media hanya boleh/);

    const oversized = Buffer.alloc(MAX_MEDIA_FILE_BYTES + 1, 0);
    makeFakePng().copy(oversized);
    expect(() => store.saveFromBuffer({ id: 'too-big', bytes: oversized })).toThrow(/8 MB/);
  });

  it('memigrasikan entri website_media_v1 lama menjadi file nyata di disk', () => {
    const dataDir = createTempDir();
    const store = new ServerMediaStore(dataDir);

    const pngDataUrl = encodeImageDataUrl('image/png', makeFakePng());
    const count = store.migrateLegacyMediaEntries([
      { id: 'legacy-1', nama: 'logo.png', dataUrl: pngDataUrl },
      { id: 'legacy-corrupt', nama: 'bad.png', dataUrl: 'data:text/plain;base64,SGVsbG8=' }
    ]);

    expect(count).toBe(1);
    const loaded = store.getMedia('legacy-1');
    expect(loaded).not.toBeNull();
    expect(loaded?.bytes.equals(makeFakePng())).toBe(true);

    // Migrasi ulang idempoten
    expect(store.migrateLegacyMediaEntries([{ id: 'legacy-1', nama: 'logo.png', dataUrl: pngDataUrl }])).toBe(0);
  });
});

describe('Media RBAC & Live Website Published Catalog Sync Helpers', () => {
  it('memvalidasi hak unggah dan hapus media berdasarkan peran RBAC', () => {
    const developer = makeRole('developer', {});
    const viewerOnly = makeRole('viewer', { 'product-catalog': ['view'], website: ['view'] });
    const catalogCreator = makeRole('staff_katalog', { 'product-catalog': ['view', 'create'] });
    const websiteAdmin = makeRole('admin_web', { website: ['view', 'create', 'update', 'delete'] });

    expect(canUploadMedia(developer)).toBe(true);
    expect(canDeleteMedia(developer)).toBe(true);

    expect(canUploadMedia(viewerOnly)).toBe(false);
    expect(canDeleteMedia(viewerOnly)).toBe(false);

    expect(canUploadMedia(catalogCreator)).toBe(true);
    expect(canDeleteMedia(catalogCreator)).toBe(false);

    expect(canUploadMedia(websiteAdmin)).toBe(true);
    expect(canDeleteMedia(websiteAdmin)).toBe(true);
  });

  it('mendeteksi referensi media bersarang dan menyelaraskan foto katalog ke website_published dengan tetap menjaga status isActive', () => {
    expect(
      containsMediaReference(
        { produk: { item: [{ id: 'p1', imageUrls: ['media:img-abc'] }] } },
        'img-abc'
      )
    ).toBe(true);
    expect(containsMediaReference({ produk: { item: [] } }, 'img-abc')).toBe(false);

    const draftSnapshot = { isPublished: false, produk: { item: [] } };
    expect(mergeCatalogIntoPublishedSnapshot(draftSnapshot, [{ id: 'p1', nama: 'Alkes' }])).toBeNull();

    const publishedSnapshot = {
      isPublished: true,
      lastModifiedAt: 100,
      produk: {
        item: [
          { id: 'p1', nama: 'Ventilator Lama', imageUrl: 'media:old-1', isActive: true },
          { id: 'p2', nama: 'ECG Draft', imageUrl: 'media:old-2', isActive: false }
        ]
      }
    };

    const next = mergeCatalogIntoPublishedSnapshot(publishedSnapshot, [
      { id: 'p1', nama: 'Ventilator Baru', imageUrl: 'media:new-1', imageUrls: ['media:new-1', 'media:new-2'] },
      { id: 'p2', nama: 'ECG Baru', imageUrl: 'media:new-ecg' },
      { id: 'p3', nama: 'Infusion Pump Baru', imageUrl: 'media:new-pump' }
    ]);

    expect(next).not.toBeNull();
    const items = (next?.produk as { item: Array<Record<string, unknown>> }).item;
    expect(items).toHaveLength(3);
    expect(items[0].imageUrl).toBe('media:new-1');
    expect(items[0].imageUrls).toEqual(['media:new-1', 'media:new-2']);
    expect(items[0].isActive).toBe(true);
    expect(items[1].isActive).toBe(false);
    expect(items[2].isActive).toBe(false);
  });
});
