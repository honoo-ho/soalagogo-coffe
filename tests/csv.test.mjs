import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const actionsPath = path.resolve(__dirname, "../app/admin/impor/actions.js");
const code = fs.readFileSync(actionsPath, "utf8");

// Extract helper definitions directly from app/admin/impor/actions.js
const startMarker = "const UKURAN_MAKS_CSV";
const endMarker = "export async function imporProduk";
const helperCode = code.slice(code.indexOf(startMarker), code.indexOf(endMarker));

const context = {};
vm.createContext(context);
vm.runInContext(
  helperCode +
    "\nthis.parseCsv = parseCsv;\nthis.angkaCsv = angkaCsv;\nthis.produkDariBarisCsv = produkDariBarisCsv;\nthis.KOLOM_PRODUK_CSV = KOLOM_PRODUK_CSV;\nthis.UKURAN_MAKS_CSV = UKURAN_MAKS_CSV;\nthis.JUMLAH_MAKS_BARIS_CSV = JUMLAH_MAKS_BARIS_CSV;",
  context
);

const { parseCsv, angkaCsv, produkDariBarisCsv, KOLOM_PRODUK_CSV } = context;

const kategoriTersedia = new Set(["Minuman", "Camilan", "Bumbu", "Kue kering", "Kerajinan", "Kain"]);

test("1. Parse CSV valid dengan koma dan kutip", () => {
  const csv = 'nama,harga,kategori\n"Kopi Robusta",25000,Minuman\n"Keripik Singkong, Pedas",15000,Camilan\n';
  const hasil = parseCsv(csv);
  assert.equal(hasil.error, null);
  assert.equal(hasil.records.length, 3);
  assert.deepEqual([...hasil.records[0].fields], ["nama", "harga", "kategori"]);
  assert.deepEqual([...hasil.records[1].fields], ["Kopi Robusta", "25000", "Minuman"]);
  assert.deepEqual([...hasil.records[2].fields], ["Keripik Singkong, Pedas", "15000", "Camilan"]);
});

test("2. Parse CSV dengan tanda kutip ganda yang di-escape (\"\")", () => {
  const csv = 'nama,harga\n"Kopi ""Spesial"" Flores",35000\n';
  const hasil = parseCsv(csv);
  assert.equal(hasil.error, null);
  assert.equal(hasil.records[1].fields[0], 'Kopi "Spesial" Flores');
});

test("3. Parse CSV multiline di dalam kolom tanda kutip", () => {
  const csv = 'nama,harga,deskripsi\n"Bolu Gulung",45000,"Enak dan empuk.\r\nCocok untuk teman kopi."\n';
  const hasil = parseCsv(csv);
  assert.equal(hasil.error, null);
  assert.equal(hasil.records.length, 2);
  assert.ok(hasil.records[1].fields[2].includes("\n"));
});

test("4. Error jika tanda kutip tidak ditutup", () => {
  const csv = 'nama,harga\n"Kopi Tanpa Tutup,25000\n';
  const hasil = parseCsv(csv);
  assert.ok(hasil.error && hasil.error.includes("belum ditutup"));
  assert.equal(hasil.records.length, 0);
});

test("5. Error jika ada karakter setelah tanda kutip penutup", () => {
  const csv = 'nama,harga\n"Kopi"Ekstra,25000\n';
  const hasil = parseCsv(csv);
  assert.ok(hasil.error && hasil.error.includes("ada karakter setelah tanda kutip penutup"));
  assert.equal(hasil.records.length, 0);
});

test("6. Validasi angka integer aman untuk harga dan stok", () => {
  assert.equal(angkaCsv("25000"), 25000);
  assert.equal(angkaCsv("0"), 0);
  assert.equal(angkaCsv("-500"), null);
  assert.equal(angkaCsv("25.50"), null);
  assert.equal(angkaCsv("abc"), null);
  assert.equal(angkaCsv(""), null);
});

test("7. Validasi produk dari baris CSV yang valid", () => {
  const kolom = ["nama", "harga", "harga_diskon", "kategori", "stok", "aktif"];
  const fields = ["Kopi Arabika", "50000", "45000", "Minuman", "20", "ya"];
  const hasil = produkDariBarisCsv(fields, kolom, kategoriTersedia);

  assert.equal(hasil.errors.length, 0);
  assert.notEqual(hasil.produk, null);
  assert.equal(hasil.produk.nama, "Kopi Arabika");
  assert.equal(hasil.produk.harga, 50000);
  assert.equal(hasil.produk.harga_diskon, 45000);
  assert.equal(hasil.produk.kategori, "Minuman");
  assert.equal(hasil.produk.stok, 20);
  assert.equal(hasil.produk.aktif, true);
});

test("8. Menolak nama kosong atau harga bukan angka", () => {
  const kolom = ["nama", "harga"];
  const barisKosong = ["", "50000"];
  const hasil1 = produkDariBarisCsv(barisKosong, kolom, kategoriTersedia);
  assert.ok(hasil1.errors.some((p) => p.includes("nama wajib diisi")));

  const barisHargaSalah = ["Kopi Robusta", "bukan_angka"];
  const hasil2 = produkDariBarisCsv(barisHargaSalah, kolom, kategoriTersedia);
  assert.ok(hasil2.errors.some((p) => p.includes("harga harus bilangan bulat positif")));
});

test("9. Menolak harga_diskon yang lebih besar atau sama dengan harga", () => {
  const kolom = ["nama", "harga", "harga_diskon"];
  const fields = ["Kopi Robusta", "50000", "55000"];
  const hasil = produkDariBarisCsv(fields, kolom, kategoriTersedia);
  assert.ok(hasil.errors.some((p) => p.includes("harga_diskon")));
});

test("10. Menolak kategori yang tidak terdaftar di database", () => {
  const kolom = ["nama", "harga", "kategori"];
  const fields = ["Kopi Robusta", "50000", "Elektronik"];
  const hasil = produkDariBarisCsv(fields, kolom, kategoriTersedia);
  assert.ok(hasil.errors.some((p) => p.includes("kategori tidak ditemukan")));
});

test("11. Validasi nilai aktif (true/false, 1/0, ya/tidak, aktif/nonaktif)", () => {
  const kolom = ["nama", "harga", "aktif"];
  
  const hasilAktif = produkDariBarisCsv(["Kopi A", "10000", "aktif"], kolom, kategoriTersedia);
  assert.equal(hasilAktif.produk.aktif, true);

  const hasilNonaktif = produkDariBarisCsv(["Kopi B", "10000", "nonaktif"], kolom, kategoriTersedia);
  assert.equal(hasilNonaktif.produk.aktif, false);

  const hasilSalah = produkDariBarisCsv(["Kopi C", "10000", "mungkin"], kolom, kategoriTersedia);
  assert.ok(hasilSalah.errors.some((p) => p.includes("aktif harus")));
});
