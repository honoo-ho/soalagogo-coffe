import test from "node:test";
import assert from "node:assert/strict";
import {
  buatPesanKeranjang,
  hapusItemKeranjang,
  kunciItemKeranjang,
  namaItemKeranjang,
  normalisasiItemKeranjang,
  subtotalItemKeranjang,
  tambahItemKeranjang,
  totalKeranjang,
  ubahJumlahItemKeranjang,
} from "../lib/keranjang.mjs";

const produkXL = {
  id: "17",
  nama: "Syal Batik Sutra",
  nama_produk: "Syal Batik Sutra",
  nama_varian: "XL",
  varian_id: "201",
  harga: 350000,
  harga_diskon: null,
  stok: 10,
};

const produkM = {
  ...produkXL,
  nama_varian: "M",
  varian_id: "202",
  harga: 125000,
};

// Simulasi data uji untuk produk 59 dan varian 101 (XL) serta 102 (ML)
const produk59XL = {
  id: "59",
  nama: "Syal Batik Sutra",
  nama_produk: "Syal Batik Sutra",
  nama_varian: "XL",
  varian_id: "101",
  harga: 350000,
  harga_diskon: null,
  stok: 10,
};

const produk59ML = {
  ...produk59XL,
  nama_varian: "ML",
  varian_id: "102",
  harga: 125000,
};

const produk60TanpaVarian = {
  id: "60",
  nama: "Kopi Bubuk",
  harga: 45000,
  harga_diskon: null,
  stok: 5,
};

const formatRupiah = (nilai) => `Rp${nilai.toLocaleString("id-ID")}`;

// --- 9 Pengujian Wajib US-12, US-21, US-48 ---

test("1. Dua varian produk sama menghasilkan dua key berbeda", () => {
  const keyXL = kunciItemKeranjang(produk59XL);
  const keyML = kunciItemKeranjang(produk59ML);

  assert.equal(keyXL, "59:101");
  assert.equal(keyML, "59:102");
  assert.notEqual(keyXL, keyML);
});

test("2. ID produk sama dan ID varian sama menghasilkan key sama", () => {
  const keyDariNumber = kunciItemKeranjang({ id: 59, varian_id: 101 });
  const keyDariString = kunciItemKeranjang({ id: "59", varian_id: "101" });

  assert.equal(keyDariNumber, "59:101");
  assert.equal(keyDariString, "59:101");
  assert.equal(keyDariNumber, keyDariString);
});

test("3. Produk berbeda menghasilkan key berbeda", () => {
  const keyProduk59 = kunciItemKeranjang({ id: 59, varian_id: 101 });
  const keyProduk60 = kunciItemKeranjang({ id: 60, varian_id: 101 });

  assert.equal(keyProduk59, "59:101");
  assert.equal(keyProduk60, "60:101");
  assert.notEqual(keyProduk59, keyProduk60);
});

test("4. Produk tanpa varian memiliki key stabil", () => {
  const keyProduk = kunciItemKeranjang(produk60TanpaVarian);
  const keyDenganNull = kunciItemKeranjang({ id: 60, varian_id: null });
  const keyDenganEmpty = kunciItemKeranjang({ id: "60", varian_id: "" });
  const keyTanpaField = kunciItemKeranjang({ id: 60 });
  const keyDariIdSaja = kunciItemKeranjang(60);

  assert.equal(keyProduk, "60:tanpa-varian");
  assert.equal(keyDenganNull, "60:tanpa-varian");
  assert.equal(keyDenganEmpty, "60:tanpa-varian");
  assert.equal(keyTanpaField, "60:tanpa-varian");
  assert.equal(keyDariIdSaja, "60:tanpa-varian");
});

test("5. Menghapus XL tidak menghapus ML", () => {
  let items = tambahItemKeranjang([], produk59XL, 1);
  items = tambahItemKeranjang(items, produk59ML, 1);
  assert.equal(items.length, 2);

  const kunciXL = kunciItemKeranjang(produk59XL);
  items = hapusItemKeranjang(items, kunciXL);

  assert.equal(items.length, 1);
  assert.equal(items[0].varian_id, "102");
  assert.equal(items[0].nama_varian, "ML");
  assert.equal(kunciItemKeranjang(items[0]), "59:102");
});

test("6. Menghapus ML tidak menghapus XL", () => {
  let items = tambahItemKeranjang([], produk59XL, 1);
  items = tambahItemKeranjang(items, produk59ML, 1);
  assert.equal(items.length, 2);

  const kunciML = kunciItemKeranjang(produk59ML);
  items = hapusItemKeranjang(items, kunciML);

  assert.equal(items.length, 1);
  assert.equal(items[0].varian_id, "101");
  assert.equal(items[0].nama_varian, "XL");
  assert.equal(kunciItemKeranjang(items[0]), "59:101");
});

test("7. Update jumlah XL tidak mengubah ML", () => {
  let items = tambahItemKeranjang([], produk59XL, 1);
  items = tambahItemKeranjang(items, produk59ML, 2);

  const kunciXL = kunciItemKeranjang(produk59XL);
  items = ubahJumlahItemKeranjang(items, kunciXL, 5);

  const itemXL = items.find((item) => kunciItemKeranjang(item) === "59:101");
  const itemML = items.find((item) => kunciItemKeranjang(item) === "59:102");

  assert.equal(itemXL.jumlah, 5);
  assert.equal(itemML.jumlah, 2);
});

test("8. Data localStorage mempertahankan ID varian setelah normalisasi", () => {
  let items = tambahItemKeranjang([], produk59XL, 1);
  items = tambahItemKeranjang(items, produk59ML, 2);

  const serial = JSON.stringify(items);
  const dibaca = JSON.parse(serial)
    .map(normalisasiItemKeranjang)
    .filter((item) => item && item.jumlah > 0);

  assert.equal(dibaca.length, 2);
  assert.equal(dibaca[0].varian_id, "101");
  assert.equal(dibaca[1].varian_id, "102");
  assert.equal(kunciItemKeranjang(dibaca[0]), "59:101");
  assert.equal(kunciItemKeranjang(dibaca[1]), "59:102");

  // Format lama (id_varian atau varianId) tetap dinormalisasi dengan benar
  const legacyVarianId = normalisasiItemKeranjang({
    id: 59,
    nama: "Syal Batik Sutra",
    varianId: 101,
    namaVarian: "XL",
    harga: 350000,
    jumlah: 1,
  });
  assert.equal(legacyVarianId.varian_id, "101");
  assert.equal(kunciItemKeranjang(legacyVarianId), "59:101");
});

test("9. Tidak ada duplicate key pada contoh keranjang XL dan ML", () => {
  let items = tambahItemKeranjang([], produk59XL, 1);
  items = tambahItemKeranjang(items, produk59ML, 2);

  const daftarKunci = items.map(kunciItemKeranjang);
  assert.equal(daftarKunci.length, 2);
  assert.deepEqual(daftarKunci, ["59:101", "59:102"]);

  const setKunci = new Set(daftarKunci);
  assert.equal(setKunci.size, 2);
  assert.equal(setKunci.has("59:101"), true);
  assert.equal(setKunci.has("59:102"), true);
});

test("10. Simulasi sekuensial tombol hapus dan reload localStorage", () => {
  // 1. Tambahkan XL sebanyak 1
  let items = tambahItemKeranjang([], produk59XL, 1);
  // 2. Tambahkan ML sebanyak 1
  items = tambahItemKeranjang(items, produk59ML, 1);
  // 3. Pastikan dua baris berbeda
  assert.equal(items.length, 2);
  const keys1 = items.map(kunciItemKeranjang);
  assert.deepEqual(keys1, ["59:101", "59:102"]);
  assert.notEqual(keys1[0], keys1[1]);

  // 4. Klik Hapus pada XL
  items = hapusItemKeranjang(items, kunciItemKeranjang(produk59XL));
  // 5. Pastikan ML masih ada
  assert.equal(items.length, 1);
  assert.equal(items[0].varian_id, "102");
  assert.equal(items[0].nama_varian, "ML");
  assert.equal(kunciItemKeranjang(items[0]), "59:102");

  // 6. Tambahkan kembali XL
  items = tambahItemKeranjang(items, produk59XL, 1);
  assert.equal(items.length, 2);
  assert.deepEqual(items.map((i) => i.varian_id), ["102", "101"]);

  // 7. Klik Hapus pada ML
  items = hapusItemKeranjang(items, kunciItemKeranjang(produk59ML));
  // 8. Pastikan XL masih ada
  assert.equal(items.length, 1);
  assert.equal(items[0].varian_id, "101");
  assert.equal(items[0].nama_varian, "XL");
  assert.equal(kunciItemKeranjang(items[0]), "59:101");

  // 9. Refresh browser (simulasi serialisasi localStorage -> JSON parse -> normalisasi)
  const disimpan = JSON.stringify(items);
  const setelahRefresh = JSON.parse(disimpan)
    .map(normalisasiItemKeranjang)
    .filter((i) => i && i.jumlah > 0);

  // 10. Pastikan item yang tersisa tetap benar
  assert.equal(setelahRefresh.length, 1);
  assert.equal(setelahRefresh[0].id, "59");
  assert.equal(setelahRefresh[0].varian_id, "101");
  assert.equal(setelahRefresh[0].nama_varian, "XL");
  assert.equal(kunciItemKeranjang(setelahRefresh[0]), "59:101");
});

// --- Pengujian regresi sebelumnya ---

test("varian berbeda menjadi item terpisah; varian sama hanya menambah jumlah", () => {
  let items = [];
  items = tambahItemKeranjang(items, produkXL, 1);
  items = tambahItemKeranjang(items, produkM, 2);

  assert.equal(items.length, 2);
  assert.deepEqual(items.map((item) => [item.varian_id, item.nama_varian, item.harga, item.jumlah]), [
    ["201", "XL", 350000, 1],
    ["202", "M", 125000, 2],
  ]);

  items = tambahItemKeranjang(items, produkXL, 1);
  assert.equal(items.length, 2);
  assert.equal(items.find((item) => item.varian_id === "201").jumlah, 2);
  assert.equal(items.find((item) => item.varian_id === "202").jumlah, 2);
  assert.equal(items.find((item) => item.varian_id === "201").harga, 350000);
});

test("ubah jumlah dan hapus hanya memengaruhi pasangan produk-varian yang dipilih", () => {
  let items = tambahItemKeranjang([], produkXL, 1);
  items = tambahItemKeranjang(items, produkM, 2);
  const kunciXL = kunciItemKeranjang(items[0]);
  const kunciM = kunciItemKeranjang(items[1]);

  items = ubahJumlahItemKeranjang(items, kunciM, 4);
  assert.equal(items.find((item) => item.varian_id === "201").jumlah, 1);
  assert.equal(items.find((item) => item.varian_id === "202").jumlah, 4);

  items = hapusItemKeranjang(items, kunciXL);
  assert.equal(items.length, 1);
  assert.equal(items[0].varian_id, "202");
  assert.equal(items[0].jumlah, 4);
  assert.notEqual(kunciXL, kunciM);
});

test("refresh melalui localStorage mempertahankan varian terpisah dan data lama tetap terbaca", () => {
  let items = tambahItemKeranjang([], produkXL, 2);
  items = tambahItemKeranjang(items, produkM, 2);

  const setelahRefresh = JSON.parse(JSON.stringify(items))
    .map(normalisasiItemKeranjang)
    .filter((item) => item && item.jumlah > 0);

  assert.equal(setelahRefresh.length, 2);
  assert.deepEqual(setelahRefresh.map((item) => item.varian_id), ["201", "202"]);
  assert.deepEqual(setelahRefresh.map((item) => item.nama_varian), ["XL", "M"]);

  const itemLama = normalisasiItemKeranjang({ id: 17, nama: "Kopi Bubuk", harga: 45000, jumlah: 2 });
  assert.equal(itemLama.varian_id, null);
  assert.equal(itemLama.nama_produk, "Kopi Bubuk");
  const tanpaVarian = tambahItemKeranjang([itemLama], { id: 17, nama: "Kopi Bubuk", harga: 45000 }, 1);
  assert.equal(tanpaVarian.length, 1);
  assert.equal(tanpaVarian[0].jumlah, 3);
});

test("subtotal, total, dan checkout menghitung serta menampilkan setiap varian", () => {
  let items = tambahItemKeranjang([], produkXL, 1);
  items = tambahItemKeranjang(items, produkM, 2);

  assert.deepEqual(items.map(subtotalItemKeranjang), [350000, 250000]);
  assert.equal(totalKeranjang(items), 600000);
  assert.deepEqual(items.map(namaItemKeranjang), ["Syal Batik Sutra — XL", "Syal Batik Sutra — M"]);

  const pesan = buatPesanKeranjang(items, formatRupiah);
  assert.match(pesan, /Syal Batik Sutra — XL: Rp350\.000 x 1 = Rp350\.000/);
  assert.match(pesan, /Syal Batik Sutra — M: Rp125\.000 x 2 = Rp250\.000/);
  assert.match(pesan, /Total: Rp600\.000\./);
});

test("harga diskon produk tanpa varian tetap menjadi harga aktif", () => {
  const item = normalisasiItemKeranjang({
    id: 25,
    nama: "Kopi Bubuk",
    harga: 50000,
    harga_diskon: 40000,
    jumlah: 2,
  });

  assert.equal(subtotalItemKeranjang(item), 80000);
  assert.equal(item.varian_id, null);
});
