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

const formatRupiah = (nilai) => `Rp${nilai.toLocaleString("id-ID")}`;

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
