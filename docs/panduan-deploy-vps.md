# Panduan Deployment VPS Linux AMS

## Deploy Linux — Ubuntu dan Firebase

> Deployment staging Linux sebelumnya telah dilaporkan berhasil; lihat evaluasi staging untuk commit dan bukti. Ini bukan bukti kesiapan produksi, migrasi PostgreSQL, atau kondisi server saat ini.

### 1. OS dan spesifikasi

Untuk VPS baru, rekomendasi utama adalah **Ubuntu Server 26.04 LTS 64-bit**. Per November 2026, 26.04 adalah rilis LTS terbaru dengan standard security maintenance hingga Mei 2031. Karena panduan lama dan mayoritas pengalaman Linux AMS menggunakan Ubuntu 24.04, uji build serta koneksi Firebase di staging terlebih dahulu sebelum produksi. **Ubuntu 24.04 LTS** adalah alternatif konservatif yang tercantum pada panduan proyek, dengan standard maintenance hingga Mei 2029. Jangan memilih rilis interim Ubuntu untuk server produksi. Periksa [siklus dukungan Ubuntu](https://ubuntu.com/about/release-cycle) saat menyediakan server.

| Komponen | Minimum staging/pilot | Rekomendasi produksi |
|---|---:|---:|
| CPU | 2 vCPU | **4 vCPU** |
| RAM | 4 GB | **8 GB** |
| Swap | 2 GB opsional | 2–4 GB sebagai pengaman, bukan pengganti RAM |
| Disk | 40–60 GB SSD | **80–100 GB NVMe** |
| Jaringan | IP publik statis | IP statis; lokasi Indonesia/Jakarta untuk latensi pengguna |
| Firewall | SSH, HTTP, HTTPS | **Hanya port SSH, 80, 443**; batasi SSH ke IP administrator jika memungkinkan |

Angka ini adalah baseline operasional, bukan hasil load test. Sediakan backup terenkripsi di luar disk VPS dan uji pemulihannya. Lokasi VPS tidak mengubah lokasi Firestore; region Firestore harus diperiksa dan dipilih tersendiri di Firebase Console.

### 2. Batas arsitektur dan keamanan

- Server adalah Node.js/Express dengan WebSocket `/api/sync/ws`. Gunakan **Node.js 24 LTS** (minimum proyek Node 22) dan satu proses service. Jangan memakai PM2 cluster atau lebih dari satu instance: koneksi WebSocket serta sebagian state server hidup di memori proses.
- Driver aktif adalah Firebase. PocketBase merupakan konfigurasi arsip/opsional lama, bukan dependensi yang perlu dipasang untuk deploy Firebase.
- `AMS_DATA_DIR` harus berada di luar working tree/build, misalnya `/var/lib/ams-data`. Direktori tersebut menyimpan state lokal server seperti `rbac-db.json`, `app-state.json`, dan `.session-secret`; Firebase bukan satu-satunya data yang perlu dicadangkan.
- Node mendengarkan pada port internal (default 3000). Port ini **tidak boleh dibuka ke internet**; akses publik melalui Nginx dan HTTPS. Pastikan reverse proxy meneruskan header Upgrade WebSocket.
- Jangan mengarahkan domain produksi ke VPS baru sebelum staging, pemulihan data, login, sinkronisasi, DNS, dan TLS diverifikasi. Jangan jalankan dua VPS aktif dengan state lokal masing-masing tanpa rencana cutover.
- Konfigurasi `VITE_FIREBASE_*` diperlukan saat build. Kredensial Firebase Admin serta `SESSION_SECRET` dan `INITIAL_SETUP_TOKEN` hanya disimpan di server, tidak di Git, chat, atau log.

### 3. Provisioning pertama kali di Ubuntu

Langkah ini untuk **VPS Ubuntu baru**, dijalankan melalui SSH sebagai administrator dengan `sudo`. Sesuaikan port SSH bila bukan 22. Pastikan akses SSH sudah diizinkan sebelum mengaktifkan UFW:

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y ca-certificates curl git nginx ufw certbot python3-certbot-nginx

sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose

sudo useradd --system --create-home --home-dir /home/ams \
  --user-group --shell /usr/sbin/nologin ams
sudo mkdir -p /opt/ams/app /var/lib/ams-data /etc/ams/secrets
sudo chown -R ams:ams /opt/ams /var/lib/ams-data
sudo chmod 700 /var/lib/ams-data
sudo chown root:ams /etc/ams/secrets
sudo chmod 750 /etc/ams/secrets
```

Pasang **Node.js 24.x LTS** dari repository paket NodeSource. Unduh dan tinjau instruksi pemasangan dari [dokumentasi NodeSource](https://github.com/nodesource/distributions); NodeSource adalah repository pihak ketiga, bukan bagian dari Ubuntu. Hindari Node.js EOL dan hindari mengandalkan `nvm` pada service systemd karena PATH service dapat berbeda. Verifikasi:

```bash
node --version
npm --version
```

Clone repository ke direktori aplikasi sebagai pemilik runtime:

```bash
sudo -u ams git clone --branch main \
  https://github.com/ptamserp-ui/AMS-Integrated-System.git \
  /opt/ams/app
```

### 4. Environment dan Firebase

Buat `/opt/ams/app/.env.staging` untuk staging atau `.env.production` untuk produksi dari template yang sesuai, misalnya [`.env.production.example`](../.env.production.example). Gunakan path Linux seperti `/var/lib/ams-data` dan `/etc/ams/secrets/...`. Simpan konfigurasi web Firebase yang benar untuk target build. Pastikan nilai-nilai ini cocok dengan Firebase Console:

```env
NODE_ENV="production"
PORT="3000"
APP_URL="https://<domain>"
DEPLOYMENT_ENV="staging"
VITE_DEPLOYMENT_ENV="staging"
AMS_DB_DRIVER="firebase"
AMS_DATA_DIR="/var/lib/ams-data"

VITE_FIREBASE_PROJECT_ID="<project-id-target>"
VITE_FIREBASE_EXPECTED_PROJECT_ID="<project-id-target>"
VITE_FIRESTORE_DATABASE_ID="<database-id-target>"
FIREBASE_PROJECT_ID="<project-id-target>"
FIREBASE_EXPECTED_PROJECT_ID="<project-id-target>"
FIRESTORE_DATABASE_ID="<database-id-target>"
FIREBASE_FIRESTORE_DATABASE_ID="<database-id-target>"
FIRESTORE_EXPECTED_DATABASE_ID="<database-id-target>"
FIREBASE_SERVICE_ACCOUNT_PATH="/etc/ams/secrets/<service-account>.json"

SESSION_SECRET="<secret-acak>"
INITIAL_SETUP_TOKEN="<token-setup-acak>"
```

Untuk produksi, set `DEPLOYMENT_ENV` dan `VITE_DEPLOYMENT_ENV` ke `production`; untuk staging, gunakan `staging` dan project/database staging. Jangan menyalin placeholder template. Database ID harus dipastikan dari Firebase Console. File Service Account disimpan di luar Git dan hanya boleh dibaca oleh akun service:

```bash
SERVICE_ACCOUNT="/etc/ams/secrets/ams-firebase-service-account.json"
sudo chown root:ams "$SERVICE_ACCOUNT"
sudo chmod 640 "$SERVICE_ACCOUNT"
ENV_FILE=".env.staging" # pilih .env.production untuk target production
sudo chown ams:ams "/opt/ams/app/$ENV_FILE"
sudo chmod 600 "/opt/ams/app/$ENV_FILE"
```

Nama file environment harus tepat (`.env.staging` atau `.env.production`), karena file tersebut dipakai saat build dan runtime. Buat nilai rahasia langsung di VPS; jangan mengirimkannya melalui chat.

Untuk membatasi bootstrap administrator Firebase hanya ke email yang dikonfigurasi, tambahkan ke environment sebelum build dan sebelum service dijalankan:

```env
VITE_FIREBASE_CONFIGURED_ADMINS_ONLY="true"
VITE_FIREBASE_ADMIN_EMAIL="<email-admin>"
BOOTSTRAP_DEV_EMAIL="<email-admin>"
FIREBASE_ADMIN_EMAILS="<email-admin>"
```

Gunakan daftar email yang konsisten (pisahkan beberapa email dengan koma pada variabel daftar) dan build ulang jika konfigurasi berubah. Tanpa opsi ini, akun bootstrap lama tetap diizinkan untuk kompatibilitas. Opsi ini tidak mencabut akun RBAC yang sudah ada atau hak administrator Firebase lainnya. Periksa dan sesuaikan juga `isBootstrappedAdmin` pada Firestore Rules di project target sebelum mempublikasikannya: file rules di repository masih berisi akun lama dan tidak membaca environment ini. Jangan menimpa rules project lain tanpa memastikan targetnya.

### 5. Build dan systemd

Verifikasi dan build dijalankan dari direktori aplikasi sebagai pengguna `ams`:

```bash
sudo -u ams -H bash -lc '
  cd /opt/ams/app &&
  npm ci &&
  npm run lint &&
  DEPLOYMENT_ENV=staging npm test -- --mode staging &&
  npm run build:staging
'
```

Untuk produksi, ganti semua `staging` di perintah test/build dengan `production`. Build production perlu konfigurasi Firebase production sebelum dijalankan.

Buat `/etc/systemd/system/ams.service` (service staging dapat memakai nama berbeda seperti `ams-staging.service`):

```ini
[Unit]
Description=AMS Integrated System
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=ams
Group=ams
WorkingDirectory=/opt/ams/app
Environment=NODE_ENV=production
Environment=DEPLOYMENT_ENV=production
ExecStart=/usr/bin/node /opt/ams/app/server.js
Restart=on-failure
RestartSec=5
UMask=0077
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Unit di atas untuk production dan harus memakai `.env.production`. Untuk staging, gunakan unit terpisah (misalnya `ams-staging.service`), ubah baris environment menjadi `Environment=DEPLOYMENT_ENV=staging`, lalu pastikan unit hanya dipakai dengan build dan `.env.staging`.

Aktifkan hanya service AMS:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now ams
sudo systemctl status ams --no-pager
sudo journalctl -u ams -n 100 --no-pager
curl -fsS http://127.0.0.1:3000/api/health
```

Pada instalasi baru tanpa data RBAC yang dipulihkan, selesaikan Setup Wizard menggunakan `INITIAL_SETUP_TOKEN` dari environment file. Jangan jalankan bootstrap akun baru setelah memulihkan data RBAC yang sudah berisi akun.

### 6. Nginx, HTTPS, dan WebSocket

Buat `/etc/nginx/sites-available/ams` dan masukkan server block untuk domain target. Ganti `<domain>` dengan nama DNS yang benar:

```nginx
server {
    listen 80;
    server_name <domain>;

    location /api/sync/ws {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Untuk VPS baru yang terisolasi, ganti contoh domain dengan domain yang telah diverifikasi sebelum mengaktifkan konfigurasi dan menerbitkan sertifikat. Pada VPS bersama, jangan mengubah atau reload reverse proxy tanpa meninjau dampak pada aplikasi lain:

```bash
DOMAIN="staging.example.com"
sudo ln -s /etc/nginx/sites-available/ams /etc/nginx/sites-enabled/ams
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d "$DOMAIN"
curl -fsS "https://$DOMAIN/api/health"
```

Nginx memerlukan penerusan header `Upgrade` dan `Connection` untuk WebSocket; lihat [dokumentasi WebSocket Nginx](https://nginx.org/en/docs/http/websocket.html). Jangan expose port 3000 langsung. Jangan menambahkan header CSP yang belum diuji terhadap Firebase dan seluruh fitur aplikasi.

### 7. Deploy rutin dari Windows melalui SSH

`deploy-linux.ps1` berjalan di PC Windows, bukan di VPS. Siapkan terlebih dahulu:

1. VPS sudah diprovisikan, DNS/TLS/Nginx aktif, source berada di `/opt/ams/app`, environment file valid, dan service systemd AMS sudah dibuat.
2. Kunci SSH administrator telah terpasang dan host key VPS telah diverifikasi/dicatat di `known_hosts`; script menggunakan `BatchMode` dan tidak menerima password interaktif.
3. Pengguna SSH memiliki akses `sudo -n` untuk menjalankan command sebagai akun aplikasi dan mengelola **service AMS yang ditentukan**. Jangan beri hak untuk mengelola service lain.
4. Working tree remote bersih. Script menolak perubahan lokal; tidak menjalankan reset, clean, atau force-pull.

Contoh deploy staging: ganti domain, host, project dan nama service sesuai target yang sudah diverifikasi.

```powershell
.\deploy-linux.ps1 `
  -SshHost "IP-ATAU-HOST-VPS" `
  -SshUser "amsdeploy" `
  -Domain "staging.example.com" `
  -DeploymentEnv staging `
  -ExpectedFirebaseProjectId "ams-integrated-staging" `
  -ExpectedFirestoreDatabaseId "(default)" `
  -ServiceName "ams-staging" `
  -AppUser "ams" `
  -AppDir "/opt/ams/app" `
  -AppPort 3000
```

Untuk meninjau rencana tanpa koneksi atau perubahan remote, gunakan parameter `-WhatIf`. Sesudah staging lulus tes login, RBAC, data, PWA, dan WebSocket, rencanakan cutover production terpisah. **Jangan arahkan domain produksi ke Linux hanya karena git push/build berhasil.**

Script melakukan fetch dan fast-forward branch, `npm ci`, lint, tes sesuai mode, build mode yang dipilih, restart satu unit systemd AMS, lalu memvalidasi health lokal dan URL HTTPS publik termasuk Firebase project/database. Jika tes/build gagal, service belum di-restart. Jika health check gagal setelah restart, script melaporkan kegagalan dan tidak mencoba rollback otomatis; periksa `journalctl` dan target Firebase sebelum tindakan lanjutan. Script tidak memprovisikan Ubuntu, tidak mengedit Nginx atau firewall, dan tidak menyalin/menampilkan rahasia.

### 8. Data, migrasi, backup, dan batas cutover

- Jadwalkan backup harian terenkripsi seluruh `/var/lib/ams-data`, simpan salinan di luar VPS, dan uji restore. Jangan memasukkan `.env` atau Service Account ke Git/backup yang tidak dienkripsi.
- Jika `rbac-db.json`, `app-state.json` atau `media-index.json` rusak/tidak valid/tidak dapat dibaca, atau secret sesi tidak valid/tidak dapat dibaca, service berhenti dengan error dan tidak menimpa berkas tersebut. Simpan berkas bermasalah dengan aman, periksa log tanpa membagikan rahasia, dan pulihkan backup yang telah diverifikasi; jangan hapus berkas untuk memaksa setup ulang.
- Pada kode lokal yang belum di-deploy, jika state atau indeks media hilang tetapi file `.tmp` masih ada, atau indeks hilang sementara direktori unggahan tidak kosong, startup menolak membuat file kosong. Penulisan state juga menolak menimpa `.tmp` yang sudah ada. Simpan semua file sebagai bukti, periksa backup dan rekonsiliasi sebelum pemulihan; jangan otomatis mengganti file utama dengan `.tmp` yang mungkin belum lengkap. Media tanpa metadata indeks ditahan, bukan otomatis dianggap publik; pulihkan metadata dari sumber tepercaya. Kehilangan tanpa jejak tidak otomatis terdeteksi.
- Akun dan peran disimpan pada server. Pengiriman snapshot ke Firebase bukan bukti backup lengkap atau restore yang berhasil; pastikan statusnya dan uji pemulihan secara terpisah.
- Jangan bootstrap akun baru di atas data RBAC yang dipulihkan; verifikasi sumber dan konsistensi data serta Firebase project/database sebelum migrasi.
- Data offline `localStorage` pada browser tidak ikut dipindah oleh salinan server.
- Saat cutover, hentikan penggunaan instance lama melalui prosedur terencana agar perubahan data tidak terpecah antara dua server. Jangan mengubah DNS sampai restore dan uji akhir disetujui.
- Setelah deploy, periksa `systemctl status ams`, `journalctl -u ams`, `https://<domain>/api/health`, login, Firebase Admin connection, dan koneksi WebSocket dari browser eksternal.

### Referensi resmi

- [Siklus dukungan Ubuntu](https://ubuntu.com/about/release-cycle)
- [Rilis dan status dukungan Node.js](https://nodejs.org/en/about/previous-releases)
- [WebSocket proxying Nginx](https://nginx.org/en/docs/http/websocket.html)

---

## Catatan pembaruan Linux

Instruksi Linux historis berbasis PocketBase/PM2 telah digantikan oleh prosedur Firebase + systemd di atas. Gunakan hanya panduan aktif dan deploy-linux.ps1; jangan jalankan perintah legacy dari salinan dokumen lama.
