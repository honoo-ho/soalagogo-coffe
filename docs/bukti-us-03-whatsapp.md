# Bukti Implementasi US-03 — Pesan via WhatsApp

Dokumen ini memetakan kriteria US-03 ke source saat ini. Pemeriksaan ini membuktikan alur kode; pengiriman pesan sungguhan tidak dilakukan.

## Pemesanan langsung dari halaman detail

Alur source:

1. `app/produk/[id]/page.jsx` mengambil data produk dan varian (`id`, `nama`, `harga`) dari database pada baris 84–115. Komponen `PilihanVarianProduk` dipasang di baris 164–166.
2. `components/PilihanVarianProduk.jsx` menyimpan ID varian terpilih (baris 8–10), lalu memberikan `produk` dan objek varian terpilih ke `TombolWhatsApp` (baris 51). Pilihan harga ditampilkan pada baris 11–15 dan 47–49.
3. `components/TombolWhatsApp.jsx` membaca pengaturan toko melalui `usePengaturanToko` (baris 8–10). Harga aktif memakai harga varian jika ada; jika tidak, memakai harga diskon yang valid atau harga produk (baris 11–15).
4. Pesan dibentuk pada baris 16–18. Isinya mencakup nama produk, nama varian bila dipilih, jumlah, harga satuan, dan total harga.
5. URL dibentuk pada baris 19 dengan pola `https://wa.me/${pengaturanToko.nomorWhatsApp}?text=${encodeURIComponent(pesan)}` dan dipakai sebagai `href` anchor pada baris 37–40.
6. Anchor menggunakan `target="_blank"`; aplikasi hanya membuka WhatsApp dengan teks yang sudah menjadi draf. Tidak ada API pengiriman pesan otomatis.

## Sumber nomor WhatsApp dan fallback

- `app/layout.jsx:27–55` memanggil `ambilPengaturanToko()` dan meneruskan hasilnya ke `PengaturanTokoProvider`.
- `lib/pengaturan-toko.js:6–28` mengambil pengaturan publik dari `pengaturan_toko`. Jika baris pengaturan tidak ditemukan atau pembacaan gagal, fungsi mengembalikan objek `toko` dari `lib/toko.js`.
- `components/PengaturanTokoProvider.jsx:4–10` memakai `toko` sebagai nilai default dan fallback jika prop `pengaturan` kosong.
- `lib/toko.js:1–8` mendefinisikan nomor toko dalam format internasional berupa digit saja, tanpa `+` atau awalan `0`; format ini sesuai segmen nomor pada `wa.me`.
- Nomor pengaturan database divalidasi oleh aksi admin di `app/admin/actions.js` sebelum disimpan. Untuk nilai aktif/fallback runtime, source yang ditelusuri di sini tetap menjadi bukti; database tidak diperiksa dalam audit ini.

## Checkout seluruh isi keranjang

Checkout keranjang memakai alur pesan terpisah dari tombol pesan langsung:

1. `components/KeranjangProvider.jsx:21–39` memuat, menormalisasi, menyimpan, dan menambah item. Normalisasi memakai `lib/keranjang.mjs:1–24`, termasuk `varian_id`, `nama_varian`, dan harga.
2. `lib/keranjang.mjs:27–49` membentuk identitas item dari pasangan ID produk dan ID varian. Varian berbeda tetap menjadi baris berbeda.
3. `app/keranjang/page.jsx:18–23` menghitung total dan membentuk pesan melalui `buatPesanKeranjang`.
4. `lib/keranjang.mjs:71–90` menghitung harga aktif, subtotal tiap baris, total keranjang, dan isi pesan. Setiap baris memuat label produk/varian, harga satuan, jumlah, serta subtotal.
5. `app/keranjang/page.jsx:23,66–74` membentuk tautan `wa.me` dengan `encodeURIComponent`, lalu membuka tautan sebagai draf melalui anchor baru.

Contoh pemeriksaan source dengan dua baris keranjang:

| Produk | Varian | Harga satuan | Jumlah | Subtotal |
|---|---|---:|---:|---:|
| Syal Batik Sutra | XL | Rp200.000 | 1 | Rp200.000 |
| Syal Batik Sutra | ML | Rp125.000 | 1 | Rp125.000 |

Dengan pasangan ID produk–varian yang berbeda, helper menghasilkan dua baris pesan dan total Rp325.000. Harga pada contoh ini hanya data simulasi, bukan pembacaan data produk.

## Peta kriteria

| Kriteria US-03 | Bukti source |
|---|---|
| Tombol pada detail produk | `app/produk/[id]/page.jsx:164–166`; `components/PilihanVarianProduk.jsx:51` |
| URL `https://wa.me/nomor` | `components/TombolWhatsApp.jsx:19`; checkout: `app/keranjang/page.jsx:23` |
| Nomor dari pengaturan toko dan fallback | `app/layout.jsx:27–55`; `lib/pengaturan-toko.js:6–28`; `components/PengaturanTokoProvider.jsx:4–10`; `lib/toko.js:1–8` |
| Nama produk, varian, harga, jumlah | `components/TombolWhatsApp.jsx:11–18` |
| Pesan di-encode dan menjadi draf | `components/TombolWhatsApp.jsx:19,37–40`; `app/keranjang/page.jsx:23,66–74` |
| Setiap varian keranjang terpisah dengan subtotal dan total | `lib/keranjang.mjs:27–49,71–90`; `app/keranjang/page.jsx:37–42,57,65` |

## Catatan penelusuran

Pembentukan string URL saat ini berada di dua tempat karena ada dua alur checkout: `components/TombolWhatsApp.jsx` untuk pemesanan langsung dan `app/keranjang/page.jsx` untuk checkout keranjang. Keduanya memakai host, nomor dari context yang sama, dan encoding pesan yang sama. Ini bukan bukti kegagalan fungsi saat ini, tetapi perubahan format URL di masa depan perlu diterapkan pada kedua lokasi. Dokumen ini mencatat source apa adanya dan tidak menambahkan implementasi URL baru.

## Batas bukti

Pemetaan ini berdasarkan source. Tidak ada pesan WhatsApp yang dikirim dan tidak ada data database yang dibaca untuk skenario contoh. Pengujian helper keranjang dan build dicatat terpisah pada laporan audit agar hasil source tidak disamakan dengan uji runtime di browser.
