# Deployment dan checklist AMS

Panduan aktif adalah [deployment VPS Linux](./panduan-deploy-vps.md). Dokumen ini merangkum gerbang verifikasi, bukan prosedur provisioning alternatif.

## Kondisi terakhir yang dibuktikan

Linux staging menjalankan rilis `32aee94` dengan service `ams` dan Firebase terhubung saat pemeriksaan 25 November 2026. Snapshot website dipertahankan. Bukti, keterbatasan dan riwayat lengkap ada di [evaluasi staging](./evaluasi-staging.md). Status tersebut tidak menjamin kondisi server pada waktu berikutnya atau kesiapan produksi.

## Sebelum deployment

- [ ] Verifikasi target, commit, domain, environment, akun service dan izin operator; jangan mengubah layanan aplikasi lain.
- [ ] Periksa checkout dan perubahan lokal. Script standar menolak checkout tidak bersih; jangan reset, stash atau menimpa snapshot/data tanpa rencana dan persetujuan.
- [ ] Pastikan backup konsisten seluruh sumber aktual, termasuk state server, RBAC, portal, media, snapshot, Firebase dan data offline yang relevan; simpan salinan terenkripsi di luar VPS dan uji restore.
- [ ] Periksa `AMS_DATA_DIR`, konfigurasi Firebase, build mode dan secret tanpa menampilkan nilai rahasia.
- [ ] Jalankan lint, tes dan build sesuai target; rencanakan rollback dan persetujuan operator.

## Sesudah deployment

- [ ] Periksa service AMS, health lokal dan publik, Firebase project/database, login, RBAC, WebSocket, website dan portal sesuai lingkup rilis.
- [ ] Periksa snapshot website dan data yang harus dipertahankan; jangan menghapus cache atau antrean offline untuk memaksa pembaruan.
- [ ] Catat commit, lingkungan, bukti dan hasil gagal di [evaluasi staging](./evaluasi-staging.md). Uji staging tidak otomatis menutup checklist produksi.

PostgreSQL shadow belum menjadi database runtime. Migrasi aktual, rekonsiliasi, login tanpa Firebase dan cutover memerlukan pekerjaan serta persetujuan terpisah. Untuk gerbang go-live lihat [checklist produksi](./production-list.md).
