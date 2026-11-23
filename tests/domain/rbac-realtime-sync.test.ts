import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getFirebaseBootstrapAdmins, ServerRbacStore } from '../../server/rbacStore';
import { ServerDataSyncStore, canWriteSyncKey } from '../../server/dataSyncStore';

const createdDirs: string[] = [];

function createTempDataDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ams-rbac-sync-test-'));
  createdDirs.push(dir);
  return dir;
}

afterEach(() => {
  vi.unstubAllEnvs();
  while (createdDirs.length > 0) {
    const dir = createdDirs.pop()!;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('ServerRbacStore & ServerDataSyncStore — Sinkronisasi Multi-User & Login Internet Real-Time', () => {
  it('tidak menimpa secret sesi RBAC yang sudah ada tetapi tidak valid', () => {
    const dataDir = createTempDataDir();
    const file = path.join(dataDir, '.session-secret');
    const previous = process.env.SESSION_SECRET;
    delete process.env.SESSION_SECRET;
    try {
      fs.writeFileSync(file, 'invalid');
      expect(() => new ServerRbacStore(dataDir)).toThrow(/Secret sesi RBAC tidak valid/);
      expect(fs.readFileSync(file, 'utf8')).toBe('invalid');
      expect(fs.existsSync(path.join(dataDir, 'rbac-db.json'))).toBe(false);
    } finally {
      if (previous === undefined) delete process.env.SESSION_SECRET;
      else process.env.SESSION_SECRET = previous;
    }
  });

  it.each(['{invalid json', 'null', '{"roles":[]}', '{"roles":{},"users":[]}'])(
    'menolak file RBAC rusak tanpa mengubah isi file: %s',
    (content) => {
      const dataDir = createTempDataDir();
      const file = path.join(dataDir, 'rbac-db.json');
      fs.writeFileSync(file, content);
      expect(() => new ServerRbacStore(dataDir)).toThrow(/RBAC.*(rusak|tidak valid)/);
      expect(fs.readFileSync(file, 'utf8')).toBe(content);
    }
  );

  it('pembaruan akun yang tidak valid atau gagal tulis tidak mengubah akun maupun sesi', () => {
    const dataDir = createTempDataDir();
    const rbac = new ServerRbacStore(dataDir);
    const dev = rbac.bootstrapFirstDeveloper(
      { username: 'dev.test', password: 'StrongPassword123!', fullName: 'Dev Test' },
      '127.0.0.1', 'Vitest'
    );
    expect(dev.ok).toBe(true);
    if (!dev.ok) return;
    const created = rbac.createUser(
      { username: 'staf.test', password: 'Password123!', fullName: 'Staf Test', roleId: 'sales_medrep' },
      dev.user.username, dev.role.id, '127.0.0.1'
    );
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const login = rbac.authenticate('staf.test', 'Password123!', '127.0.0.1', 'Vitest');
    expect(login.ok).toBe(true);
    if (!login.ok) return;

    const update = (newPassword: string) => rbac.updateUser(
      created.user.id, { isActive: false, newPassword },
      dev.user.id, dev.user.username, dev.role.id, '127.0.0.1'
    );
    expect(update('short')).toMatchObject({ ok: false, status: 400 });
    expect(rbac.listUsers().find((u) => u.id === created.user.id)?.isActive).toBe(true);
    expect(rbac.resolveToken(login.token)).not.toBeNull();

    fs.mkdirSync(path.join(dataDir, 'rbac-db.json.tmp'));
    expect(() => update('NewPassword123!')).toThrow();
    expect(rbac.listUsers().find((u) => u.id === created.user.id)?.isActive).toBe(true);
    expect(rbac.resolveToken(login.token)).not.toBeNull();
    expect(new ServerRbacStore(dataDir).listUsers().find((u) => u.id === created.user.id)?.isActive).toBe(true);
  });

  it('menolak email duplikat dan login Google dengan akun lama yang memiliki email ambigu', () => {
    const dataDir = createTempDataDir();
    const rbac = new ServerRbacStore(dataDir);
    const dev = rbac.bootstrapFirstDeveloper(
      { username: 'dev.test', password: 'StrongPassword123!', fullName: 'Dev Test' },
      '127.0.0.1', 'Vitest'
    );
    expect(dev.ok).toBe(true);
    if (!dev.ok) return;
    const create = (username: string, email: string) => rbac.createUser(
      { username, email, password: 'Password123!', fullName: username, roleId: 'sales_medrep' },
      dev.user.username, dev.role.id, '127.0.0.1'
    );
    expect(create('staf.satu', 'tester@example.test').ok).toBe(true);
    expect(create('staf.dua', ' TESTER@example.test ')).toMatchObject({ ok: false, status: 409 });
    const other = create('staf.dua', 'other@example.test');
    expect(other.ok).toBe(true);
    if (!other.ok) return;
    expect(rbac.updateUser(
      other.user.id, { email: 'TESTER@example.test' },
      dev.user.id, dev.user.username, dev.role.id, '127.0.0.1'
    )).toMatchObject({ ok: false, status: 409 });

    const file = path.join(dataDir, 'rbac-db.json');
    const saved = JSON.parse(fs.readFileSync(file, 'utf8')) as { users: Array<{ username: string; email: string }> };
    const otherUser = saved.users.find((u) => u.username === 'staf.dua');
    expect(otherUser).toBeDefined();
    if (!otherUser) return;
    otherUser.email = 'TESTER@example.test';
    fs.writeFileSync(file, JSON.stringify(saved));
    const reopened = new ServerRbacStore(dataDir);
    expect(reopened.authenticateByVerifiedEmail('tester@example.test', 'uid', 'Test', '127.0.0.1', 'Vitest'))
      .toMatchObject({ ok: false, status: 409 });
    expect(reopened.authenticate('staf.satu', 'Password123!', '127.0.0.1', 'Vitest').ok).toBe(true);
  });

  it('gagal menyimpan peran tidak mengubah matriks peran di memori maupun di disk', () => {
    const dataDir = createTempDataDir();
    const rbac = new ServerRbacStore(dataDir);
    const oldPermissions = JSON.stringify(rbac.listRoles().find((r) => r.id === 'sales_medrep')?.permissions);
    fs.mkdirSync(path.join(dataDir, 'rbac-db.json.tmp'));
    expect(() => rbac.createRole({ name: 'Peran uji' }, 'admin', 'it_admin', '127.0.0.1')).toThrow();
    expect(() => rbac.updateRole(
      'sales_medrep', { permissions: { overview: ['view'] } }, 'admin', 'it_admin', '127.0.0.1'
    )).toThrow();
    expect(rbac.listRoles().some((r) => r.name === 'Peran uji')).toBe(false);
    expect(JSON.stringify(rbac.listRoles().find((r) => r.id === 'sales_medrep')?.permissions)).toBe(oldPermissions);
    expect(new ServerRbacStore(dataDir).listRoles().some((r) => r.name === 'Peran uji')).toBe(false);
  });

  it('tidak mencabut hak dari satu-satunya peran pengelola RBAC aktif', () => {
    const rbac = new ServerRbacStore(createTempDataDir());
    const role = rbac.createRole(
      { name: 'Admin Kustom', permissions: { 'rbac-admin': ['view', 'update'] } },
      'admin', 'it_admin', '127.0.0.1'
    );
    expect(role.ok).toBe(true);
    if (!role.ok) return;
    expect(rbac.createUser(
      { username: 'admin.kustom', password: 'Password123!', fullName: 'Admin', roleId: role.role.id },
      'admin', 'it_admin', '127.0.0.1'
    ).ok).toBe(true);
    expect(rbac.updateRole(role.role.id, { permissions: { overview: ['view'] } }, 'admin', 'it_admin', '127.0.0.1'))
      .toMatchObject({ ok: false, status: 400 });
    expect(rbac.listRoles().find((r) => r.id === role.role.id)?.permissions['rbac-admin']).toEqual(['view', 'update']);
  });

  it('membatasi daftar bootstrap Firebase dan login ke email yang dikonfigurasi', () => {
    vi.stubEnv('VITE_FIREBASE_CONFIGURED_ADMINS_ONLY', 'true');
    vi.stubEnv('BOOTSTRAP_DEV_EMAIL', ' admin@example.com ');
    vi.stubEnv('FIREBASE_ADMIN_EMAILS', 'ADMIN@example.com, second@example.com');
    vi.stubEnv('BOOTSTRAP_DEV_PASSWORD', '');
    vi.stubEnv('BOOTSTRAP_DEV_PASSWORD_HASH', '');
    const rbac = new ServerRbacStore(createTempDataDir());

    expect([...getFirebaseBootstrapAdmins()]).toEqual(['admin@example.com', 'second@example.com']);
    for (const oldEmail of ['antraderyll@gmail.com', 'cloud.ams2026@gmail.com']) {
      expect(rbac.authenticateByVerifiedEmail(oldEmail, 'uid-old', 'Old', '127.0.0.1', 'Vitest')).toMatchObject({
        ok: false,
        status: 403
      });
    }
    expect(rbac.authenticateByVerifiedEmail('Admin@Example.com', 'uid-admin', 'Admin', '127.0.0.1', 'Vitest')).toMatchObject({
      ok: true,
      role: { id: 'developer_it_support' }
    });
  });

  it('tidak memakai email lama jika mode terbatas tidak memiliki alamat bootstrap', () => {
    vi.stubEnv('VITE_FIREBASE_CONFIGURED_ADMINS_ONLY', 'true');
    vi.stubEnv('BOOTSTRAP_DEV_EMAIL', '');
    vi.stubEnv('FIREBASE_ADMIN_EMAILS', '');
    vi.stubEnv('BOOTSTRAP_DEV_PASSWORD', '');
    vi.stubEnv('BOOTSTRAP_DEV_PASSWORD_HASH', '');
    expect(getFirebaseBootstrapAdmins().size).toBe(0);
    const dir = createTempDataDir();
    const rbac = new ServerRbacStore(dir);
    expect(rbac.authenticateByVerifiedEmail('antraderyll@gmail.com', 'uid', 'Old', '127.0.0.1', 'Vitest').ok).toBe(false);

    vi.stubEnv('BOOTSTRAP_DEV_PASSWORD', 'StrongPassword123!');
    expect(() => new ServerRbacStore(dir)).toThrow('BOOTSTRAP_DEV_EMAIL wajib diisi');
  });

  it('menolak nilai opsi pembatasan yang tidak valid saat server dimulai', () => {
    vi.stubEnv('VITE_FIREBASE_CONFIGURED_ADMINS_ONLY', 'TRUE');
    expect(() => new ServerRbacStore(createTempDataDir())).toThrow('harus bernilai true atau false');
  });

  it('memberi hak write gudang berdasarkan tugas dan memigrasikan role sistem lama secara aman', () => {
    const dataDir = createTempDataDir();
    const initial = new ServerRbacStore(dataDir);
    const roles = Object.fromEntries(initial.listRoles().map((role) => [role.id, role]));

    expect(roles.kepala_gudang?.permissions['gudang-penerimaan']).toEqual(['view', 'create', 'update']);
    expect(roles.kepala_gudang?.permissions['gudang-mutasi']).toEqual(['view', 'create', 'update']);
    expect(roles.qc_officer?.permissions['gudang-penerimaan']).toEqual(['view', 'update']);
    expect(roles.qc_officer?.permissions['gudang-mutasi']).toEqual(['view']);
    expect(roles.qa_manager?.permissions['gudang-mutasi']).toEqual(['view', 'update', 'approve']);

    const file = path.join(dataDir, 'rbac-db.json');
    const saved = JSON.parse(fs.readFileSync(file, 'utf8')) as { roles: Array<{ id: string; permissions: Record<string, string[]> }> };
    for (const role of saved.roles) {
      delete role.permissions['gudang-penerimaan'];
      delete role.permissions['gudang-mutasi'];
    }
    fs.writeFileSync(file, JSON.stringify(saved), 'utf8');

    const migrated = Object.fromEntries(new ServerRbacStore(dataDir).listRoles().map((role) => [role.id, role]));
    expect(migrated.kepala_gudang?.permissions['gudang-mutasi']).toEqual(['view', 'create', 'update']);
    expect(migrated.qc_officer?.permissions['gudang-mutasi']).toEqual(['view']);
  });

  it('akun & peran baru yang diinput admin langsung persisten dan bisa dipakai login dari IP internet lain', () => {
    const dataDir = createTempDataDir();
    const rbac = new ServerRbacStore(dataDir);
    expect(rbac.needsInitialSetup()).toBe(true);

    // 1. Setup awal developer
    const setupRes = rbac.bootstrapFirstDeveloper(
      {
        username: 'dev.utama',
        password: 'DevPassword123!',
        fullName: 'Developer Utama'
      },
      '10.0.0.1',
      'Vitest/1.0'
    );
    expect(setupRes.ok).toBe(true);
    if (!setupRes.ok) return;
    expect(rbac.needsInitialSetup()).toBe(false);

    // 2. Buat peran kustom + akun baru via manajemen RBAC server
    const roleRes = rbac.createRole(
      {
        name: 'Supervisor Cold Chain',
        description: 'Akses gudang & inspeksi suhu',
        permissions: {
          overview: ['view'],
          'gudang-logistik': ['view', 'create', 'update']
        }
      },
      setupRes.user.username,
      setupRes.role.id,
      '10.0.0.1'
    );
    expect(roleRes.ok).toBe(true);
    if (!roleRes.ok) return;

    const userRes = rbac.createUser(
      {
        username: 'rina.gudang',
        password: 'PasswordAman99',
        fullName: 'Rina Lestari',
        email: 'rina@anugrahmitraselaras.co.id',
        department: 'Logistik CDAKB',
        roleId: roleRes.role.id,
        isActive: true
      },
      setupRes.user.username,
      setupRes.role.id,
      '10.0.0.1'
    );
    expect(userRes.ok).toBe(true);
    if (!userRes.ok) return;

    // 3. Simulasikan akses dari pengguna lain lewat internet menggunakan instance store yang membaca disk
    const remoteRbac = new ServerRbacStore(dataDir);
    const loginRes = remoteRbac.authenticate(
      'rina.gudang',
      'PasswordAman99',
      '182.253.40.12',
      'Mozilla/5.0 (Linux; Android 14)'
    );
    expect(loginRes.ok).toBe(true);
    if (!loginRes.ok) return;

    expect(loginRes.user.username).toBe('rina.gudang');
    expect(loginRes.role.id).toBe(roleRes.role.id);
    expect(loginRes.role.permissions['gudang-logistik']).toEqual(['view', 'create', 'update']);
    expect(remoteRbac.resolveSessionById(loginRes.session.id)).toBe(true);

    // 4. Perubahan izin peran langsung berlaku pada token sesi yang sudah aktif
    const updateRoleRes = remoteRbac.updateRole(
      roleRes.role.id,
      {
        permissions: {
          overview: ['view'],
          'gudang-logistik': ['view', 'create', 'update', 'approve'],
          'qc-inspeksi': ['view', 'create']
        }
      },
      setupRes.user.username,
      setupRes.role.id,
      '10.0.0.1'
    );
    expect(updateRoleRes.ok).toBe(true);

    const resolvedLive = remoteRbac.resolveToken(loginRes.token);
    expect(resolvedLive).not.toBeNull();
    expect(resolvedLive?.role.permissions['qc-inspeksi']).toEqual(['view', 'create']);
    expect(canWriteSyncKey(resolvedLive!.role, 'inspeksi_qc')).toBe(true);
    expect(canWriteSyncKey(resolvedLive!.role, 'keuangan_jurnal')).toBe(false);
  });

  it('gagal menulis akun tidak meninggalkan akun setengah-jadi di memori maupun di disk', () => {
    const dataDir = createTempDataDir();
    const rbac = new ServerRbacStore(dataDir);
    const dev = rbac.bootstrapFirstDeveloper(
      { username: 'dev.persist', password: 'StrongPassword123!', fullName: 'Dev Persist' },
      '127.0.0.1',
      'Vitest'
    );
    expect(dev.ok).toBe(true);
    if (!dev.ok) return;

    fs.mkdirSync(path.join(dataDir, 'rbac-db.json.tmp'));
    expect(() =>
      rbac.createUser(
        {
          username: 'beta.persist',
          password: 'BetaPassword123!',
          fullName: 'Beta Tester',
          roleId: 'sales_medrep'
        },
        dev.user.username,
        dev.role.id,
        '127.0.0.1'
      )
    ).toThrow();

    expect(rbac.listUsers()).toEqual([]);
    expect(new ServerRbacStore(dataDir).listUsers()).toEqual([]);
  });

  it('logout mencabut sesi sendiri termasuk developer tanpa membuka pencabutan sesi developer oleh admin', () => {
    const dataDir = createTempDataDir();
    const rbac = new ServerRbacStore(dataDir);
    const dev = rbac.bootstrapFirstDeveloper(
      { username: 'dev.logout', password: 'DevPassword123!', fullName: 'Dev Logout' },
      '127.0.0.1', 'Vitest'
    );
    expect(dev.ok).toBe(true);
    if (!dev.ok) return;
    const staff = rbac.createUser(
      { username: 'staf.logout', password: 'StaffPassword123!', fullName: 'Staff Logout', roleId: 'sales_medrep' },
      dev.user.username, dev.role.id, '127.0.0.1'
    );
    expect(staff.ok).toBe(true);
    if (!staff.ok) return;
    const login = rbac.authenticate('staf.logout', 'StaffPassword123!', '127.0.0.1', 'Vitest');
    expect(login.ok).toBe(true);
    if (!login.ok) return;

    expect(rbac.revokeSession(dev.session.id, staff.user.username, staff.user.roleId, '127.0.0.1')).toBe(false);
    expect(rbac.endOwnSession(dev.session.id, staff.user.id, '127.0.0.1')).toBe(false);
    expect(rbac.endOwnSession(login.session.id, staff.user.id, '127.0.0.1')).toBe(true);
    expect(rbac.resolveToken(login.token)).toBeNull();
    expect(rbac.endOwnSession(dev.session.id, dev.user.id, '127.0.0.1')).toBe(true);
    expect(rbac.resolveToken(dev.token)).toBeNull();
    expect(new ServerRbacStore(dataDir).resolveToken(dev.token)).toBeNull();
  });

  it('gagal menyimpan logout tidak mencabut sesi di memori maupun di disk', () => {
    const dataDir = createTempDataDir();
    const rbac = new ServerRbacStore(dataDir);
    const dev = rbac.bootstrapFirstDeveloper(
      { username: 'dev.logout', password: 'DevPassword123!', fullName: 'Dev Logout' },
      '127.0.0.1', 'Vitest'
    );
    expect(dev.ok).toBe(true);
    if (!dev.ok) return;
    fs.mkdirSync(path.join(dataDir, 'rbac-db.json.tmp'));
    expect(() => rbac.endOwnSession(dev.session.id, dev.user.id, '127.0.0.1')).toThrow();
    expect(rbac.resolveToken(dev.token)).not.toBeNull();
    expect(new ServerRbacStore(dataDir).resolveToken(dev.token)).not.toBeNull();
  });

  it('reset sandi oleh admin, penonaktifan akun, dan penghapusan akun langsung mencabut sesi aktif', () => {
    const dataDir = createTempDataDir();
    const rbac = new ServerRbacStore(dataDir);
    const dev = rbac.bootstrapFirstDeveloper(
      { username: 'dev.sec', password: 'DevPassword123!', fullName: 'Dev Security' },
      '127.0.0.1',
      'Vitest'
    );
    expect(dev.ok).toBe(true);
    if (!dev.ok) return;

    const u1 = rbac.createUser(
      {
        username: 'staf.sales',
        password: 'SandiAwal123',
        fullName: 'Andi Sales',
        roleId: 'sales_medrep',
        isActive: true
      },
      dev.user.username,
      dev.role.id,
      '127.0.0.1'
    );
    expect(u1.ok).toBe(true);
    if (!u1.ok) return;

    const loginU1 = rbac.authenticate('staf.sales', 'SandiAwal123', '203.0.113.5', 'MobileApp');
    expect(loginU1.ok).toBe(true);
    if (!loginU1.ok) return;
    expect(rbac.resolveSessionById(loginU1.session.id)).toBe(true);

    // Reset kata sandi oleh admin harus langsung mencabut sesi lama staf tersebut
    const resetRes = rbac.updateUser(
      u1.user.id,
      { newPassword: 'SandiBaru456' },
      dev.user.id,
      dev.user.username,
      dev.role.id,
      '127.0.0.1'
    );
    expect(resetRes.ok).toBe(true);
    expect(rbac.resolveSessionById(loginU1.session.id)).toBe(false);
    expect(rbac.resolveToken(loginU1.token)).toBeNull();

    // Sandi lama gagal, sandi baru berhasil login
    expect(rbac.authenticate('staf.sales', 'SandiAwal123', '203.0.113.5', 'MobileApp').ok).toBe(false);
    const reLogin = rbac.authenticate('staf.sales', 'SandiBaru456', '203.0.113.5', 'MobileApp');
    expect(reLogin.ok).toBe(true);
    if (!reLogin.ok) return;

    // Penonaktifan akun juga mencabut sesi dan menolak login
    const deactivateRes = rbac.updateUser(
      u1.user.id,
      { isActive: false },
      dev.user.id,
      dev.user.username,
      dev.role.id,
      '127.0.0.1'
    );
    expect(deactivateRes.ok).toBe(true);
    expect(rbac.resolveSessionById(reLogin.session.id)).toBe(false);
    expect(rbac.authenticate('staf.sales', 'SandiBaru456', '203.0.113.5', 'MobileApp').ok).toBe(false);
  });

  it('delta sync server mengembalikan hanya perubahan terbaru lintas pengguna secara deterministik', () => {
    const dataDir = createTempDataDir();
    const syncStore = new ServerDataSyncStore(dataDir);

    const w1 = syncStore.setKey('stok_gudang', [{ id: 'STK-1', nama: 'Ventilator' }], 'ahmad.gudang');
    const w2 = syncStore.setKey('penjualan', [{ id: 'INV-1', total: 15000000 }], 'farhan.sales');

    const snapshotUser2 = syncStore.getAllState();
    expect(snapshotUser2.revision).toBe(2);
    expect(Object.keys(snapshotUser2.entries)).toEqual(['stok_gudang', 'penjualan']);

    // Klien 2 sudah punya versi saat ini
    const knownVersions = {
      stok_gudang: w1.entry.version,
      penjualan: w2.entry.version
    };
    expect(Object.keys(syncStore.getAllState(knownVersions).entries)).toHaveLength(0);

    // Klien 1 menambah batch baru -> delta untuk Klien 2 hanya memuat kunci yang berubah
    syncStore.setBatch(
      {
        penjualan: [{ id: 'INV-1', total: 15000000 }, { id: 'INV-2', total: 8000000 }],
        audit_trail: [{ id: 'AUD-1', aksi: 'Buat Invoice' }]
      },
      [],
      'farhan.sales'
    );

    const deltaForUser2 = syncStore.getAllState(knownVersions);
    expect(deltaForUser2.revision).toBe(3);
    expect(Object.keys(deltaForUser2.entries).sort()).toEqual(['audit_trail', 'penjualan']);
  });

  it('bootstrap developer dari env var memetakan BOOTSTRAP_DEV_* termasuk role "Developer & IT Support"', () => {
    const prevEnv = {
      BOOTSTRAP_DEV_USERNAME: process.env.BOOTSTRAP_DEV_USERNAME,
      BOOTSTRAP_DEV_FULLNAME: process.env.BOOTSTRAP_DEV_FULLNAME,
      BOOTSTRAP_DEV_EMAIL: process.env.BOOTSTRAP_DEV_EMAIL,
      BOOTSTRAP_DEV_ROLE_ID: process.env.BOOTSTRAP_DEV_ROLE_ID,
      BOOTSTRAP_DEV_PASSWORD: process.env.BOOTSTRAP_DEV_PASSWORD
    };
    try {
      process.env.BOOTSTRAP_DEV_USERNAME = 'dev.admin';
      process.env.BOOTSTRAP_DEV_FULLNAME = 'Langgo Bramandityo';
      process.env.BOOTSTRAP_DEV_EMAIL = 'antraderyll@gmail.com';
      process.env.BOOTSTRAP_DEV_ROLE_ID = 'Developer & IT Support';
      process.env.BOOTSTRAP_DEV_PASSWORD = 'DevStrongPassword123!';

      const dataDir = createTempDataDir();
      const rbac = new ServerRbacStore(dataDir);
      expect(rbac.needsInitialSetup()).toBe(false);

      const loginRes = rbac.authenticate('dev.admin', 'DevStrongPassword123!', '127.0.0.1', 'Vitest');
      expect(loginRes.ok).toBe(true);
      if (!loginRes.ok) return;

      expect(loginRes.user.username).toBe('dev.admin');
      expect(loginRes.user.fullName).toBe('Langgo Bramandityo');
      expect(loginRes.user.email).toBe('antraderyll@gmail.com');
      expect(loginRes.role.id).toBe('developer_it_support');
      expect(loginRes.role.name).toBe('Developer & IT Support');
    } finally {
      for (const [k, v] of Object.entries(prevEnv)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  });

  it('reset kata sandi developer mencabut sesi lama, menolak sandi lama, dan aktif kembali dengan kode reset satu kali', () => {
    const dataDir = createTempDataDir();
    const rbac = new ServerRbacStore(dataDir);
    const setupRes = rbac.bootstrapFirstDeveloper(
      {
        username: 'dev.admin',
        password: 'SandiLamaDeveloper1!',
        fullName: 'Langgo Bramandityo',
        email: 'antraderyll@gmail.com'
      },
      '127.0.0.1',
      'Vitest'
    );
    expect(setupRes.ok).toBe(true);
    if (!setupRes.ok) return;

    const resetReq = rbac.initiateDeveloperPasswordReset();
    expect(resetReq.ok).toBe(true);
    if (!resetReq.ok) return;

    expect(rbac.needsDeveloperPasswordReset()).toBe(true);
    expect(rbac.resolveSessionById(setupRes.session.id)).toBe(false);
    expect(rbac.authenticate('dev.admin', 'SandiLamaDeveloper1!', '127.0.0.1', 'Vitest').ok).toBe(false);

    // Kode reset salah ditolak
    const wrongCode = rbac.completeDeveloperPasswordReset(
      { resetCode: 'AMS-RESET-SALAH', newPassword: 'SandiBaruKuat2026!' },
      '127.0.0.1',
      'Vitest'
    );
    expect(wrongCode.ok).toBe(false);

    // Kode reset benar + sandi baru berhasil & langsung mengeluarkan sesi
    const resetDone = rbac.completeDeveloperPasswordReset(
      { resetCode: resetReq.resetCode, newPassword: 'SandiBaruKuat2026!' },
      '127.0.0.1',
      'Vitest'
    );
    expect(resetDone.ok).toBe(true);
    if (!resetDone.ok) return;

    expect(rbac.needsDeveloperPasswordReset()).toBe(false);
    expect(resetDone.user.username).toBe('dev.admin');
    expect(rbac.resolveSessionById(resetDone.session.id)).toBe(true);

    // Kode reset tidak dapat dipakai ulang (single-use)
    const reuse = rbac.completeDeveloperPasswordReset(
      { resetCode: resetReq.resetCode, newPassword: 'SandiLain9999!' },
      '127.0.0.1',
      'Vitest'
    );
    expect(reuse.ok).toBe(false);

    // Bisa login ulang menggunakan kata sandi baru
    const loginBaru = rbac.authenticate('dev.admin', 'SandiBaruKuat2026!', '127.0.0.1', 'Vitest');
    expect(loginBaru.ok).toBe(true);
  });
});
