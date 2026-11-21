# Panduan Deployment VPS — AMS Integrated System

> **Target deployment aktif:** Windows Server VPS bersama aplikasi lain. Ikuti bagian **Prosedur Deployment Saat Ini — Windows Server Staging** terlebih dahulu. Folder aplikasi `C:\Apps\AMS`, domain `ams.bejodigitalprint.com`, dan port aplikasi `3100`.
>
> **Peringatan VPS bersama:** Jangan menjalankan perintah Linux di VPS Windows. Jangan menghentikan/restart Caddy, mengubah port aplikasi lain, menjalankan `-ConfigureFirewall` pada deployment rutin, atau memakai `-BlockPocketBasePort`. VPS ini juga menjalankan aplikasi lain (termasuk Bejo Stiker POS). Skrip rutin hanya boleh mengelola `AMS_AppService`.
>
> VPS Linux harus berupa server terpisah; jangan menjalankan perintah Linux pada VPS Windows bersama aplikasi lain. Bagian **Deploy Linux — Ubuntu dan Firebase** adalah panduan aktif untuk target Linux. Skrip `deploy-linux.ps1` dijalankan dari PC Windows melalui SSH dan hanya meng-update source, menjalankan tes/build, me-restart satu service AMS yang ditentukan, lalu memeriksa health. Skrip tidak mengubah firewall, Nginx, rahasia, DNS, atau service lain. Untuk VPS Windows aktif, lihat [panduan VPS Windows](./panduan-deploy-vps-windows.md). Untuk preview Oracle Cloud, lihat [panduan Oracle Cloud + Firebase](./deployment-oracle-free-preview.md).

Panduan ini menjelaskan deployment ke Windows Server VPS Firebase Staging dan, pada bagian terpisah, persiapan serta rilis ke VPS Linux.

---

## Prosedur Deployment Saat Ini — Windows Server Staging

### 1. Alur rilis dari komputer lokal

Lakukan langkah ini pada komputer pengembangan, di folder repositori:

```powershell
# Ganti dengan folder repositori pada komputer lokal Anda
Set-Location "<jalur-repo-lokal>\AMS Integrated System"
git switch main
git status --short
Copy-Item .env.local.example .env.local
# Isi Web App config staging sebelum menjalankan build.
npm run lint
npm test
npm run build:staging
```

Pastikan pemeriksaan lulus dan tinjau perubahan sebelum commit. Stage hanya file yang memang menjadi bagian rilis; jangan memakai `git add -A` tanpa memeriksa daftar file.

```powershell
git add -- <file-yang-memang-akan-dirilis>
git diff --cached --check
git diff --cached
git commit -m "jenis(perubahan): ringkasan"
git push origin main
git status --short
git log -1 --oneline
```

Jangan commit `.env`, API key, Service Account JSON, `.session-secret`, database lokal di `data-preview/`, atau file backup. Setelah push berhasil, konfirmasikan commit yang dikirim dan berikan pengguna opsi deploy Windows VPS dengan skrip siap jalan; **push tidak sama dengan deploy** dan tidak memberi izin untuk menjalankan perintah di VPS tanpa persetujuan pengguna.

### 2. Target VPS dan pengaturan tetap

| Pengaturan | Nilai untuk VPS aktif | Catatan |
|---|---|---|
| Folder source | `C:\Apps\AMS` | Branch `main`; deploy script `C:\Apps\AMS\deploy.ps1` |
| Domain publik | `ams.bejodigitalprint.com` | DNS dan TLS dikelola Caddy yang juga melayani aplikasi lain |
| Port Node.js AMS | `3100` | Akses aplikasi melalui Caddy/HTTPS; jangan mengganti tanpa memastikan port baru kosong dan proxy ikut disesuaikan |
| Service aplikasi | `AMS_AppService` | Satu proses Node.js; hanya service ini yang dihentikan/dijalankan oleh deploy |
| Reverse proxy | Caddy (`C:\caddy\Caddyfile`) | Konfigurasi dipakai bersama; jangan timpa atau restart manual |
| Data persisten | `C:\AMS\Data` | Tidak berada di repo; jangan dihapus ketika update source |
| Backup | `C:\AMS\Backups` | Termasuk backup snapshot situs saat diperlukan |
| Log AMS | `C:\AMS\Logs` | Log service Windows |
| Rahasia | `C:\AMS\Secrets` | Service Account Firebase, di luar repo |
| Environment | `C:\Apps\AMS\.env.staging` | Jangan commit atau mengirim isinya ke chat |
| Firebase | `ams-integrated-staging` | Firestore Database ID `(default)`; gunakan nilai dari Firebase Console |

Sebelum deploy pertama kali, buka **PowerShell as Administrator** dan pastikan jalur berikut benar. Jangan menjalankan langkah instalasi/clone pada folder yang sudah berisi aplikasi:

```powershell
Test-Path C:\Apps\AMS\deploy.ps1
Test-Path C:\Apps\AMS\.env.staging
Test-Path C:\caddy\Caddyfile
Test-Path C:\AMS\Data
Get-Service -Name AMS_AppService
Get-Service -Name Caddy -ErrorAction SilentlyContinue
Get-Service -Name CaddyWebServer -ErrorAction SilentlyContinue
```

Jika `C:\caddy\Caddyfile` tidak ada, atau Anda tidak dapat memastikan konfigurasi itu memuat route aplikasi yang ada, **berhenti dan minta administrator VPS memeriksa Caddy**. Jangan biarkan skrip membuat Caddyfile baru pada server bersama sebelum semua hostname aplikasi lain dipertahankan.

Periksa secara read-only bahwa konfigurasi yang ada mengarahkan domain AMS ke port yang benar. Tinjau hasilnya; jangan mengedit atau me-reload Caddy untuk deployment aplikasi rutin:

```powershell
Select-String -Path "C:\caddy\Caddyfile" -Pattern "ams\.bejodigitalprint\.com"
Select-String -Path "C:\caddy\Caddyfile" -Pattern "127\.0\.0\.1:3100"
```

### 3. Isi `.env.staging` di VPS

File yang dipakai service adalah `C:\Apps\AMS\.env.staging`. Buka langsung di VPS dengan Notepad (jalankan Notepad sebagai Administrator bila diperlukan):

```powershell
notepad C:\Apps\AMS\.env.staging
```

Pastikan variabel berikut diset. Ganti placeholder Firebase/token dengan nilai yang benar dari proyek staging dan simpan semua rahasia hanya di VPS:

```env
NODE_ENV="production"
PORT="3100"
APP_URL="https://ams.bejodigitalprint.com"
DEPLOYMENT_ENV="staging"
VITE_DEPLOYMENT_ENV="staging"
AMS_DB_DRIVER="firebase"
AMS_DATA_DIR="C:\\AMS\\Data"

VITE_FIREBASE_API_KEY="<dari Firebase Web App staging>"
VITE_FIREBASE_AUTH_DOMAIN="ams-integrated-staging.firebaseapp.com"
VITE_FIREBASE_PROJECT_ID="ams-integrated-staging"
VITE_FIREBASE_EXPECTED_PROJECT_ID="ams-integrated-staging"
VITE_FIREBASE_STORAGE_BUCKET="ams-integrated-staging.firebasestorage.app"
VITE_FIREBASE_MESSAGING_SENDER_ID="<dari Firebase Web App staging>"
VITE_FIREBASE_APP_ID="<dari Firebase Web App staging>"
VITE_FIRESTORE_DATABASE_ID="(default)"
VITE_FIREBASE_ADMIN_EMAIL="ptams.erp@gmail.com,cloud.ams2026@gmail.com"

FIREBASE_PROJECT_ID="ams-integrated-staging"
FIREBASE_EXPECTED_PROJECT_ID="ams-integrated-staging"
FIRESTORE_DATABASE_ID="(default)"
FIREBASE_FIRESTORE_DATABASE_ID="(default)"
FIRESTORE_EXPECTED_DATABASE_ID="(default)"
FIREBASE_SERVICE_ACCOUNT_PATH="C:\\AMS\\Secrets\\ams-integrated-staging-firebase-adminsdk-fbsvc-9d434aa089.json"

SESSION_SECRET="<64 karakter hex acak>"
INITIAL_SETUP_TOKEN="<token acak untuk setup awal>"
AMS_ADMIN_TOKEN=""
BOOTSTRAP_DEV_USERNAME="dev.admin"
BOOTSTRAP_DEV_FULLNAME="Langgo Bramandityo"
BOOTSTRAP_DEV_EMAIL="ptams.erp@gmail.com"
BOOTSTRAP_DEV_ROLE_ID="Developer & IT Support"
BOOTSTRAP_DEV_PASSWORD_HASH=""
BOOTSTRAP_DEV_PASSWORD=""
FIREBASE_ADMIN_EMAILS="ptams.erp@gmail.com,cloud.ams2026@gmail.com,antraderyll@gmail.com"

# Opsional: terjemahan otomatis bahasa Inggris pada website publik
DEEPL_AUTH_KEY="<DeepL API key; hanya disimpan di VPS>"
DEEPL_API_URL="https://api-free.deepl.com"
```

`DEEPL_API_URL` memakai `https://api-free.deepl.com` untuk DeepL API Free atau `https://api.deepl.com` untuk Pro. Jangan memakai awalan `VITE_` untuk key DeepL. `SESSION_SECRET`, `INITIAL_SETUP_TOKEN`, kredensial Google/Firebase, dan DeepL key tidak boleh masuk Git atau dibagikan di chat. Buat nilai token acak langsung di VPS, misalnya:

```powershell
-join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Maximum 256) })
```

Pastikan file Service Account benar-benar ada pada path yang ditentukan tanpa membuka atau menyalin isi JSON ke terminal/chat:

```powershell
Test-Path "C:\AMS\Secrets\ams-integrated-staging-firebase-adminsdk-fbsvc-9d434aa089.json"
```

Jika path file Service Account berbeda, ubah hanya nilai `FIREBASE_SERVICE_ACCOUNT_PATH` agar cocok. Jangan menebak ID database Firestore; untuk target aktif gunakan `(default)` yang sudah diverifikasi.

### 4. Deploy rutin setelah commit dan push

Setelah pengguna menyetujui deploy, buka **PowerShell as Administrator** di VPS. Jalankan skrip berikut persis; ia akan mengambil update `origin/main`, menjalankan pemeriksaan/build, memperbarui hanya `AMS_AppService`, lalu memeriksa health lokal:

```powershell
$ErrorActionPreference = "Stop"
$AppDir = "C:\Apps\AMS"
Set-Location -LiteralPath $AppDir

git -C $AppDir status --short
if ($LASTEXITCODE -ne 0) {
  throw "Tidak dapat membaca status repositori AMS."
}

& powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File (Join-Path $AppDir "deploy.ps1") `
  -AppDir $AppDir `
  -Domain "ams.bejodigitalprint.com" `
  -Port 3100
if ($LASTEXITCODE -ne 0) {
  throw "Deploy AMS gagal. Jangan menghentikan atau mengubah service aplikasi lain."
}

Invoke-RestMethod -Uri "http://127.0.0.1:3100/api/health" -TimeoutSec 15
Invoke-RestMethod -Uri "http://127.0.0.1:3100/api/system/db-config" -TimeoutSec 15
```

**Jangan tambahkan** `-ConfigureFirewall` pada deploy rutin. Jangan gunakan `-BlockPocketBasePort`, `Stop-Service Caddy`, `Restart-Service Caddy`, `git reset`, `git clean`, atau force-pull. Port `80/443` dan Caddy dipakai bersama, sedangkan port `3100` adalah port internal AMS. Skrip update saat ini mempertahankan `public/website-published.json` lokal dengan backup di `C:\AMS\Backups`; perubahan tracked lainnya menghentikan deploy agar tidak terhapus. Periksa output `Health OK`, `deploymentEnv=staging`, proyek Firebase staging, dan database `(default)`.

### 5. Jika deploy lama gagal karena snapshot lokal

Jika output menyebut perubahan lokal `public/website-published.json` akan tertimpa, kemungkinan `deploy.ps1` di VPS masih versi lama. Jangan commit snapshot itu dan jangan membuang perubahannya. Jalankan pemulihan satu kali berikut dari PowerShell Administrator; script menyimpan backup, melakukan fast-forward `main`, lalu memulihkan snapshot:

```powershell
$ErrorActionPreference = "Stop"
$AppDir = "C:\Apps\AMS"
$SnapshotRelative = "public/website-published.json"
$SnapshotPath = Join-Path $AppDir $SnapshotRelative
$BackupDir = "C:\AMS\Backups"

if (-not (Test-Path -LiteralPath $SnapshotPath -PathType Leaf)) {
  throw "Snapshot tidak ditemukan; hentikan dan periksa repositori sebelum melanjutkan."
}
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null
$BackupPath = Join-Path $BackupDir ("website-published-manual-{0}.json" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
Copy-Item -LiteralPath $SnapshotPath -Destination $BackupPath

try {
  & git -C $AppDir restore --source=HEAD --staged --worktree -- $SnapshotRelative
  if ($LASTEXITCODE -ne 0) { throw "Gagal menyiapkan snapshot untuk fast-forward." }
  & git -C $AppDir pull --ff-only origin main
  if ($LASTEXITCODE -ne 0) { throw "Fast-forward gagal; snapshot akan dipulihkan dari backup." }
} finally {
  Copy-Item -LiteralPath $BackupPath -Destination $SnapshotPath -Force
}

& powershell.exe -NoProfile -ExecutionPolicy Bypass `
  -File (Join-Path $AppDir "deploy.ps1") `
  -AppDir $AppDir `
  -Domain "ams.bejodigitalprint.com" `
  -Port 3100 `
  -SkipGitUpdate
if ($LASTEXITCODE -ne 0) {
  throw "Build/deploy gagal. Backup snapshot tersedia di $BackupPath."
}
```

Jangan menjalankan pemulihan ini bila ada perubahan tracked selain snapshot atau branch bukan `main`; minta administrator memeriksa keadaan Git. Backup manual disimpan di `C:\AMS\Backups`.

### 6. Perilaku dan batas aman VPS bersama

- `deploy.ps1` menjalankan `npm ci`, lint, tes, dan `build:staging`. Jika `AMS_AppService` sedang berjalan, hanya service AMS yang dihentikan sementara dan dijalankan kembali setelah build.
- Caddy tidak dihentikan/restart pada deploy rutin. Jangan ubah Caddyfile bersama untuk rilis aplikasi tanpa meninjau route seluruh domain lain.
- Jangan mengubah firewall VPS bersama pada rilis aplikasi biasa. Pengaturan firewall memerlukan pemeriksaan terpisah karena berlaku untuk seluruh server.
- Jangan menjalankan dua proses `server.js`/dua instance AMS; WebSocket dan file data memerlukan satu instance.
- Data aplikasi tetap berada di `C:\AMS\Data`; jangan menghapus folder ini saat memperbarui source. Pastikan backup harian `C:\AMS\Backups` berjalan.
- Jika build, health check, service, port `3100`, atau pemeriksaan Firebase gagal, simpan output error dan hentikan proses. Jangan mencoba memperbaiki dengan menghentikan Caddy atau service aplikasi lain.

---

## Deploy Linux — Ubuntu dan Firebase

> **Belum ada bukti deployment Linux berhasil pada VPS target.** Lakukan staging pada VPS/hostname terpisah lebih dulu. Bagian ini menggambarkan arsitektur kode saat ini; provisioning awal, DNS, TLS, kredensial, migrasi data, dan pengujian pada server target tetap tanggung jawab operator.

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

Buat `/opt/ams/app/.env.staging` untuk staging atau `.env.production` untuk produksi dari template yang sesuai, misalnya [`.env.production.example`](../.env.production.example). Template yang ada juga dipakai pada VPS Windows; untuk Linux, **ganti semua path Windows** menjadi path POSIX seperti `/var/lib/ams-data` dan `/etc/ams/secrets/...`. Simpan konfigurasi web Firebase yang benar untuk target build. Pastikan nilai-nilai ini cocok dengan Firebase Console:

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

Aktifkan konfigurasi, uji, lalu terbitkan sertifikat:

```bash
DOMAIN="staging.ams.bejodigitalprint.com"
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

Contoh deploy staging:

```powershell
.\deploy-linux.ps1 `
  -SshHost "IP-ATAU-HOST-VPS" `
  -SshUser "amsdeploy" `
  -Domain "staging.ams.bejodigitalprint.com" `
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
- Untuk memindahkan sistem Windows, rencanakan transfer konsisten `C:\AMS\Data` ke `/var/lib/ams-data` dan verifikasi Firebase project/database. Jangan bootstrap akun baru di atas data RBAC yang dipulihkan.
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
