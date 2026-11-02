# Bukti implementasi US-14 dan US-25

Dokumen ini menunjukkan source yang perlu disertakan bersama implementasi saat evaluator CHAT 2026 memeriksa kedua user story. Bukti ini memetakan source code; keberhasilan panggilan Gemini secara langsung tetap memerlukan `GEMINI_API_KEY` yang valid dan sesi admin.

## US-14 — Deskripsi produk dengan Gemini

Kriteria US-14 pada `docs/user-stories.md:168–178` meminta deskripsi dibuat dari nama dan kategori, Gemini dipanggil di server, dan hasilnya mengisi kolom deskripsi sebelum produk disimpan.

Alur lengkap:

```text
components/FormProduk.jsx:44–64
  → app/admin/actions.js:703–797 (buatDeskripsiProduk)
  → Gemini Interactions API, model gemini-3.8-flash
  → hasil description mengisi draft FormProduk
  → form produk tetap menggunakan action simpanProduk/ubahProduk
```

- `components/FormProduk.jsx`: tombol AI memanggil Server Action; hasil sukses mengisi draft `deskripsi`, sedangkan kegagalan mempertahankan draft yang ada.
- `app/admin/actions.js`: autentikasi sesi, validasi nama/kategori, panggilan Gemini dengan batas waktu, status error yang aman, dan validasi hasil teks 1–3 kalimat dengan batas 1.200 karakter.
- `.env.example`: mendeklarasikan `GEMINI_API_KEY` untuk server. Nilai rahasia tidak disimpan di source.
- `lib/log-error.js`: log hanya memakai label aman dan metadata status; body error provider dan kunci tidak dicetak.

Model default yang digunakan adalah `gemini-3.8-flash`. API dipanggil melalui endpoint Interactions REST dengan `store: false` agar request dan respons tidak disimpan sebagai interaction. Referensi resmi: [daftar model Gemini](https://ai.google.dev/gemini-api/docs/models) dan [Interactions API](https://ai.google.dev/gemini-api/docs/interactions-overview).

## US-25 — Mode gelap

Kriteria US-25 pada `docs/user-stories.md:299–309` meminta toggle terang/gelap, pilihan persisten setelah refresh, dan keterbacaan teks.

- `components/Header.jsx`: memasang `TombolTema` di navigasi global.
- `components/TombolTema.jsx`: mengganti tema pada `document.documentElement.dataset.theme`, menyimpan `terang`/`gelap` pada localStorage key `soalagogo-tema-v1`, dan menyediakan accessible name untuk tema tujuan.
- `public/theme-init.js`: membaca tema tersimpan sebelum halaman interaktif ditampilkan dan menetapkan `data-theme` pada elemen HTML.
- `app/layout.jsx`: memuat stylesheet global serta `theme-init.js` dengan strategi `beforeInteractive`; `suppressHydrationWarning` menangani atribut tema yang ditetapkan sebelum hydration.
- `app/globals.css`: mendefinisikan token warna terang di `@theme` dan mengganti token latar, permukaan, garis, teks, teks lembut, utama, harga, serta bahaya pada `html[data-theme="gelap"]`. Komponen yang memakai token Tailwind tersebut mengikuti kedua tema.

## File source untuk dump evaluator

Sertakan file berikut secara utuh agar definisi UI, action, stylesheet, dan inisialisasi tidak terpotong atau terlewat:

1. `docs/user-stories.md` (bagian US-14 dan US-25)
2. `app/admin/actions.js` (seluruh definisi `buatDeskripsiProduk`, baris 703–797)
3. `components/FormProduk.jsx`
4. `.env.example` (nama variabel saja, tanpa file env lokal)
5. `components/Header.jsx`
6. `components/TombolTema.jsx`
7. `public/theme-init.js`
8. `app/layout.jsx`
9. `app/globals.css`
10. `lib/log-error.js`

Jangan sertakan `.env.local` atau nilai API key di dump.

## Cara verifikasi manual

1. Masuk sebagai admin, isi nama dan kategori produk, buat deskripsi AI, edit hasil bila perlu, lalu simpan melalui form produk. Coba juga tanpa `GEMINI_API_KEY` dan pastikan pesan error muncul tanpa menghapus isi draft sebelumnya.
2. Di halaman publik dan admin, ganti terang/gelap, refresh, lalu pastikan tema terpilih tetap aktif. Periksa halaman beranda, detail produk, keranjang, favorit, dan halaman admin pada lebar desktop dan sekitar 390 px.

Panggilan Gemini live dan verifikasi visual browser harus dicatat terpisah setelah dilakukan; keberhasilan build saja bukan bukti untuk kedua hal tersebut.
