# Bukti Implementasi US-43, US-44, dan US-46 — CHAT 2026

Dokumen ini memetakan implementasi teknis untuk tiga User Story:
1. **US-43: Pengaturan Toko dari Admin**
2. **US-44: Kelola Akun Admin**
3. **US-46: Impor Produk dari CSV**

Setiap fitur memiliki modul Server Action terpisah dengan batasan yang jelas, menghindari pemotongan file saat penilaian evaluator AI Bot.

---

## 1. US-43 — Pengaturan Toko dari Admin (15 Poin)

### A. Lokasi File & Komponen
- **Halaman Admin:** `app/admin/pengaturan/page.jsx`
- **Server Action:** `app/admin/pengaturan/actions.js` (`simpanPengaturanToko`)
- **Pembacaan Publik & Fallback:** `lib/pengaturan-toko.js` (`ambilPengaturanToko`)
- **Data Cadangan:** `lib/toko.js` (`toko`)
- **Context Provider:** `components/PengaturanTokoProvider.jsx` (`PengaturanTokoProvider`, `usePengaturanToko`)
- **Konsumen Publik:**
  - Header: `components/Header.jsx`
  - Footer: `components/Footer.jsx`
  - Halaman Profil: `app/tentang/page.jsx`
  - Metadata: `app/layout.jsx` & `app/manifest.js`
  - WhatsApp: `components/TombolWhatsApp.jsx` & `app/keranjang/page.jsx`

### B. Validasi Server (`simpanPengaturanToko`)
- Autentikasi sesi: `createSupabaseSessionClient().auth.getUser()`, ditolak dan dialihkan ke `/admin/login` jika tidak ada sesi aktif.
- `nama_toko`: Wajib diisi, string non-kosong, maksimal 120 karakter.
- `nomor_whatsapp`: Wajib diisi, format internasional murni 8–15 digit tanpa tanda `+` (regex `^[1-9]\d{7,14}$`).
- `jam_buka`: Wajib diisi, string non-kosong, maksimal 120 karakter.
- `alamat`: Wajib diisi, string non-kosong, maksimal 250 karakter.

### C. Operasi Database & Revalidasi
- **Penyimpanan Database:**
  Menggunakan `.upsert({ id: 1, nama_toko, nomor_whatsapp, jam_buka, alamat, updated_at }, { onConflict: "id" })` pada tabel `pengaturan_toko`.
- **Revalidasi Jalur:**
  - `revalidatePath("/", "layout")` (memperbarui header, footer, metadata global)
  - `revalidatePath("/tentang")`
  - `revalidatePath("/manifest.webmanifest")`
  - `revalidatePath("/admin/pengaturan")`
  - Redirect ke `/admin/pengaturan?status=saved`

### D. Alur Pembacaan Data dan Fallback
- `ambilPengaturanToko()` di `lib/pengaturan-toko.js` membaca baris tunggal `id = 1` dari tabel `pengaturan_toko`.
- Jika tabel kosong atau query database gagal/terputus, fungsi menangkap error dan mengembalikan objek cadangan default `toko` dari `lib/toko.js`. Tidak pernah melempar unhandled exception ke halaman publik.

---

## 2. US-44 — Kelola Akun Admin (15 Poin)

### A. Lokasi File & Komponen
- **Halaman Admin:** `app/admin/akun/page.jsx`
- **Server Actions:** `app/admin/akun/actions.js`
  - Helper otorisasi: `clientAdminUntukKelolaAkun()`
  - Tambah admin: `undangAdmin(formData)`
  - Ubah status admin: `ubahStatusAdmin(formData)`
  - Hapus admin: `hapusAdmin(formData)`

### B. Helper Sesi Server
- `clientAdminUntukKelolaAkun()` memeriksa sesi pengguna melalui `createSupabaseSessionClient().auth.getUser()`.
- Jika tidak ada sesi aktif, panggilan langsung dialihkan ke `/admin/login`.
- Jika sesi valid, helper mengembalikan client Supabase berhak tinggi (`createSupabaseServerClient()`) yang menggunakan `SUPABASE_SECRET_KEY` hanya di sisi server.

### C. Aksi Pengelolaan Akun
1. **`undangAdmin(formData)`**:
   - Memvalidasi email: panjang <= 254 karakter dan regex RFC standar `^[^\s@]+@[^\s@]+\.[^\s@]+$`.
   - Memanggil `supabase.auth.admin.inviteUserByEmail(email)`.
   - Mengalihkan ke `/admin/akun?status=invited` setelah revalidasi `/admin/akun`.
2. **`ubahStatusAdmin(formData)`**:
   - Memvalidasi parameter UUID: format 36 karakter `[0-9a-f]{8}-...-[0-9a-f]{12}`.
   - Memvalidasi aksi: hanya menerima `"nonaktifkan"` atau `"aktifkan"`.
   - **Pengamanan Self-Action:** `if (id === user.id) redirect("/admin/akun?status=self_action_denied")`.
   - Memanggil `supabase.auth.admin.updateUserById(id, { ban_duration: nonaktifkan ? "876000h" : "none" })`.
   - Mengalihkan ke `/admin/akun?status=disabled` atau `enabled`.
3. **`hapusAdmin(formData)`**:
   - Memvalidasi format UUID target.
   - **Pengamanan Self-Action:** Admin tidak dapat menghapus akunnya sendiri (`id === user.id` ditolak).
   - Memanggil `supabase.auth.admin.deleteUser(id)`.
   - Mengalihkan ke `/admin/akun?status=deleted`.

### D. Tampilan Daftar Akun
- `app/admin/akun/page.jsx` membaca daftar akun menggunakan pagination `supabase.auth.admin.listUsers()`.
- Menampilkan label `"Aktif"`, `"Nonaktif"` (jika `banned_until` aktif), dan `"Menunggu konfirmasi email"`.
- Akun yang sedang login ditandai `"(Anda)"` dan tombol ubah status/hapus disembunyikan di UI selain diproteksi di server.

---

## 3. US-46 — Impor Produk dari CSV (15 Poin)

### A. Lokasi File & Komponen
- **Halaman Impor:** `app/admin/impor/page.jsx`
- **Form Komponen:** `components/FormImporProduk.jsx` (Client Component menggunakan `useActionState`)
- **Server Action & Parser:** `app/admin/impor/actions.js`
  - Parser CSV: `parseCsv(teks)`
  - Validator Angka: `angkaCsv(nilai)`
  - Validator Baris: `produkDariBarisCsv(fields, kolom, kategoriTersediaSet)`
  - Server Action: `imporProduk(_state, formData)`
- **Unit Test:** `tests/csv.test.mjs`

### B. Spesifikasi Parser CSV (`parseCsv`)
- Mendukung pemisah koma `,`.
- Mendukung nilai kolom berapit tanda kutip ganda `"..."`.
- Mendukung escaped quotes `""` di dalam kolom berapit kutip.
- Mendukung multiline (karakter baris baru `\n` dan `\r\n` di dalam kutip).
- Melacak nomor baris fisik (`nomorBaris`) untuk setiap record agar pelaporan baris error akurat.
- Mendeteksi error sintaksis CSV: tanda kutip tidak tertutup dan karakter asing setelah kutip penutup.

### C. Batasan Keamanan & Validasi File
- **Ekstensi:** Wajib berakhiran `.csv`.
- **Ukuran File:** Maksimal 512 KB (`UKURAN_MAKS_CSV = 512 * 1024`).
- **Encoding:** Didekode menggunakan UTF-8 fatal mode (`new TextDecoder("utf-8", { fatal: true })`), otomatis menangani BOM UTF-8 (`\uFEFF`).
- **Maksimal Baris:** Maksimal 500 baris produk per unggah (`JUMLAH_MAKS_BARIS_CSV = 500`).

### D. Validasi Header & Data Baris
- Header wajib memiliki kolom `nama` dan `harga`.
- Kolom yang dikenali: `nama`, `harga`, `harga_diskon`, `badge`, `deskripsi`, `foto_url`, `kategori`, `stok`, `aktif`.
- Header dengan kolom duplikat atau kolom tidak dikenal ditolak sebelum memproses baris data.
- Daftar kategori dibaca langsung dari tabel `kategori` di database; baris dengan kategori yang tidak terdaftar ditolak.
- Validasi tipe: harga integer positif, diskon nonnegatif < harga, stok nonnegatif, badge valid (`baru` / `terlaris`), deskripsi maksimal 5000 karakter, aktif boolean (`true`/`false`, `1`/`0`, `ya`/`tidak`, `aktif`/`nonaktif`).

### E. Penyimpanan Batch Database & Respon
- Baris yang lolos validasi dikumpulkan ke dalam array `produkValid`.
- Disimpan sekaligus melalui satu panggilan batch insert:
  `await supabase.from("produk").insert(produkValid.map((item) => item.produk))`
- Jika batch gagal di level database, kegagalan dicatat dan dilaporkan kembali ke admin tanpa klaim palsu.
- Jika berhasil, cache diperbarui: `revalidatePath("/", "layout")`, `revalidatePath("/admin")`, `revalidatePath("/admin/aktivitas")`.
- Respon mengembalikan ringkasan: `message`, `successCount`, `failedCount`, dan rincian error per baris (`errors: [{ baris, pesan }]`).

---

## 4. Matriks Inventaris Source Code untuk AI Bot Evaluator

| User Story | Halaman / UI | Server Action Modul | Helper / Validator | Test File |
| :--- | :--- | :--- | :--- | :--- |
| **US-43** | `app/admin/pengaturan/page.jsx` | `app/admin/pengaturan/actions.js` | `lib/pengaturan-toko.js`, `lib/toko.js` | Integration test |
| **US-44** | `app/admin/akun/page.jsx` | `app/admin/akun/actions.js` | `clientAdminUntukKelolaAkun`, `emailValid` | Integration test |
| **US-46** | `app/admin/impor/page.jsx`, `components/FormImporProduk.jsx` | `app/admin/impor/actions.js` | `parseCsv`, `angkaCsv`, `produkDariBarisCsv` | `tests/csv.test.mjs` |

