> **Status dokumen (2026-11): RENCANA — BELUM DIEKSEKUSI, JANGAN DIIMPOR APA ADANYA.** Repositori pihak ketiga yang disebut di sini belum ditinjau untuk alur penggajian AMS. Biometrik wajah merupakan data sensitif dan memerlukan penilaian dasar pemrosesan, privasi dan keamanan oleh pihak yang berwenang. Kode pihak ketiga memerlukan pemeriksaan lisensi, audit keamanan dan persetujuan sebelum digunakan.

> **Klarifikasi 25 November 2026:** uraian integrasi Android di bawah adalah usulan, bukan fitur AMS yang terpasang atau koneksi terverifikasi. Penilaian hukum dan keamanan harus ditinjau oleh pihak berwenang sebelum keputusan.

# Integrasi Git Eksternal: Smart-Attendance-App

**Repository Sumber:** `https://github.com/driptobhattacharyya/Smart-Attendance-App.git`  
**Standar Kepatuhan:** CDAKB Permenkes RI 4/2014, ISO 13485:2016, ALCOA+ Data Integrity  
**Modul Sasaran:** HRD & Pelatihan (Time & Attendance) -> `src/components/modules/supporting/hris/TimeAttendanceModule.tsx`  
**Target:** Integrasi aplikasi turunan berbasis Android untuk karyawan (*Smart Attendance Android App*) dengan sinkronisasi geofencing GPS, face recognition, dan presensi real-time ke sistem pusat PT Anugrahmitra Selaras (AMS).

---

## 📱 Ringkasan Arsitektur Smart Attendance Android App

1. **Mobile App Client (Android / Kotlin & Jetpack Compose / React Native)**:
   - Digunakan oleh karyawan lapangan (sales, teknisi alkes, staf gudang cold-chain).
   - Fitur utama: Absensi masuk/keluar (*clock-in/out*), verifikasi geofencing radius lokasi pabrik/gudang, pemindaian wajah (*face recognition*), serta pengajuan cuti & lembur mandiri.

2. **Backend Sync & API Gateway**:
   - Menghubungkan data absensi mobile app Android ke database pusat sistem terintegrasi AMS.
   - Pengecekan otomatis aturan toleransi keterlambatan (10 menit) dan potongan gaji proporsional.

3. **Audit Trail & Keamanan**:
   - Dilindungi dengan hash-chain audit log dan enkripsi token autentikasi karyawan.

---
*Coded by Langgo Bramandityo*
