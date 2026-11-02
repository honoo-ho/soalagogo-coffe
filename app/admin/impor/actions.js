"use server";

import { createSupabaseSessionClient } from "@/lib/supabase/session";
import { logServerError } from "@/lib/log-error";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const UKURAN_MAKS_CSV = 512 * 1024;
const JUMLAH_MAKS_BARIS_CSV = 500;
const KOLOM_PRODUK_CSV = new Set([
  "nama",
  "harga",
  "harga_diskon",
  "badge",
  "deskripsi",
  "foto_url",
  "kategori",
  "stok",
  "aktif",
]);

function parseCsv(teks) {
  const records = [];
  let fields = [];
  let field = "";
  let inQuotes = false;
  let setelahKutip = false;
  let nomorBaris = 1;
  let awalRecord = 1;

  function simpanField() {
    fields.push(field);
    field = "";
    setelahKutip = false;
  }

  function simpanRecord() {
    simpanField();
    if (fields.some((value) => value.trim() !== "")) {
      records.push({ fields, nomorBaris: awalRecord });
    }
    fields = [];
    awalRecord = nomorBaris + 1;
  }

  for (let index = 0; index < teks.length; index += 1) {
    const karakter = teks[index];
    const newline = karakter === "\r" || karakter === "\n";

    if (inQuotes) {
      if (karakter === '"') {
        if (teks[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
          setelahKutip = true;
        }
      } else if (newline) {
        field += "\n";
        if (karakter === "\r" && teks[index + 1] === "\n") index += 1;
        nomorBaris += 1;
      } else {
        field += karakter;
      }
      continue;
    }

    if (setelahKutip && karakter !== "," && !newline && !/\s/.test(karakter)) {
      return { records: [], error: `Format CSV tidak valid di baris ${nomorBaris}: ada karakter setelah tanda kutip penutup.` };
    }
    if (karakter === '"') {
      if (field.length > 0 && !setelahKutip) {
        return { records: [], error: `Format CSV tidak valid di baris ${nomorBaris}: tanda kutip harus membuka nilai kolom.` };
      }
      inQuotes = true;
      continue;
    }
    if (karakter === ",") {
      simpanField();
      continue;
    }
    if (newline) {
      simpanRecord();
      if (karakter === "\r" && teks[index + 1] === "\n") index += 1;
      nomorBaris += 1;
      awalRecord = nomorBaris;
      continue;
    }
    if (!setelahKutip) field += karakter;
  }

  if (inQuotes) {
    return { records: [], error: `Format CSV tidak valid: tanda kutip pada baris ${awalRecord} belum ditutup.` };
  }
  if (fields.length > 0 || field.length > 0 || setelahKutip) simpanRecord();
  return { records, error: null };
}

function angkaCsv(nilai) {
  if (!/^\d+$/.test(nilai)) return null;
  const angka = Number(nilai);
  return Number.isSafeInteger(angka) && angka <= 2147483647 ? angka : null;
}

function produkDariBarisCsv(fields, kolom, kategoriTersediaSet) {
  const nilai = Object.fromEntries(kolom.map((namaKolom, index) => [namaKolom, String(fields[index] ?? "").trim()]));
  const errors = [];
  const nama = nilai.nama ?? "";
  const harga = angkaCsv(nilai.harga ?? "");
  const hargaDiskon = nilai.harga_diskon ? angkaCsv(nilai.harga_diskon) : null;
  const stok = nilai.stok ? angkaCsv(nilai.stok) : null;
  const badge = nilai.badge ?? "";

  if (!nama) errors.push("nama wajib diisi");
  else if (nama.length > 120) errors.push("nama maksimal 120 karakter");
  if (harga === null || harga <= 0) errors.push("harga harus bilangan bulat positif");
  if (nilai.harga_diskon && (hargaDiskon === null || hargaDiskon >= harga || hargaDiskon < 0)) {
    errors.push("harga_diskon harus bilangan bulat nonnegatif dan lebih rendah dari harga");
  }
  if (nilai.stok && (stok === null || stok < 0)) errors.push("stok harus bilangan bulat nonnegatif");
  if (badge && !["baru", "terlaris"].includes(badge)) errors.push("badge harus kosong, baru, atau terlaris");
  if ((nilai.deskripsi ?? "").length > 5000) errors.push("deskripsi maksimal 5000 karakter");
  if (nilai.kategori && !kategoriTersediaSet.has(nilai.kategori)) errors.push("kategori tidak ditemukan");

  let aktif = true;
  if (nilai.aktif) {
    const status = nilai.aktif.toLowerCase();
    if (["true", "1", "ya", "aktif"].includes(status)) aktif = true;
    else if (["false", "0", "tidak", "nonaktif"].includes(status)) aktif = false;
    else errors.push("aktif harus true/false, 1/0, ya/tidak, atau aktif/nonaktif");
  }

  if (errors.length > 0) return { produk: null, errors };
  return {
    produk: {
      nama,
      harga,
      harga_diskon: hargaDiskon,
      badge: badge || null,
      deskripsi: nilai.deskripsi || null,
      foto_url: nilai.foto_url || null,
      kategori: nilai.kategori || null,
      stok,
      aktif,
    },
    errors: [],
  };
}

export async function imporProduk(_state, formData) {
  let supabase;
  let user;

  try {
    supabase = await createSupabaseSessionClient();
    const { data, error } = await supabase.auth.getUser();
    user = error ? null : data.user;
  } catch {
    user = null;
  }

  if (!user) redirect("/admin/login");

  const file = formData.get("file_csv");
  if (!file || typeof file === "string" || !file.name) {
    return { message: "Pilih file CSV yang ingin diimpor.", successCount: 0, failedCount: 0, errors: [] };
  }
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return { message: "File harus berekstensi .csv.", successCount: 0, failedCount: 0, errors: [] };
  }
  if (file.size === 0 || file.size > UKURAN_MAKS_CSV) {
    return { message: "Ukuran file CSV harus lebih dari 0 dan maksimal 512 KB.", successCount: 0, failedCount: 0, errors: [] };
  }

  let teks;
  try {
    teks = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
  } catch {
    return { message: "File tidak dapat dibaca sebagai teks UTF-8. Simpan ulang sebagai CSV UTF-8.", successCount: 0, failedCount: 0, errors: [] };
  }

  const hasilParse = parseCsv(teks.replace(/^\uFEFF/, ""));
  if (hasilParse.error) {
    return { message: hasilParse.error, successCount: 0, failedCount: 0, errors: [] };
  }
  if (hasilParse.records.length < 2) {
    return { message: "CSV harus memiliki header dan minimal satu baris produk.", successCount: 0, failedCount: 0, errors: [] };
  }

  const [headerRecord, ...barisData] = hasilParse.records;
  if (barisData.length > JUMLAH_MAKS_BARIS_CSV) {
    return { message: "File maksimal berisi 500 baris produk sekali impor.", successCount: 0, failedCount: 0, errors: [] };
  }

  const kolom = headerRecord.fields.map((nama, index) => (index === 0 ? nama.replace(/^\uFEFF/, "") : nama).trim().toLowerCase());
  if (kolom.some((nama) => !nama)) {
    return { message: "Semua kolom pada header harus memiliki nama.", successCount: 0, failedCount: 0, errors: [] };
  }
  if (new Set(kolom).size !== kolom.length) {
    return { message: "Header CSV tidak boleh memiliki nama kolom yang duplikat.", successCount: 0, failedCount: 0, errors: [] };
  }
  const kolomTidakDikenal = kolom.filter((nama) => !KOLOM_PRODUK_CSV.has(nama));
  if (kolomTidakDikenal.length > 0) {
    return { message: `Kolom tidak dikenal: ${kolomTidakDikenal.join(", ")}.`, successCount: 0, failedCount: 0, errors: [] };
  }
  if (!kolom.includes("nama") || !kolom.includes("harga")) {
    return { message: "Header CSV wajib memiliki kolom nama dan harga.", successCount: 0, failedCount: 0, errors: [] };
  }

  let dataKategori;
  let errorKategori;
  try {
    ({ data: dataKategori, error: errorKategori } = await supabase.from("kategori").select("nama"));
  } catch (error) {
    logServerError("Gagal membaca kategori untuk impor CSV:", error);
    return { message: "Daftar kategori gagal dimuat. Periksa koneksi database lalu coba lagi.", successCount: 0, failedCount: 0, errors: [] };
  }
  if (errorKategori) {
    logServerError("Gagal membaca kategori untuk impor CSV:", errorKategori);
    return { message: "Daftar kategori gagal dimuat. Pastikan tabel kategori tersedia.", successCount: 0, failedCount: 0, errors: [] };
  }

  const kategoriTersediaSet = new Set((dataKategori ?? []).map((kategori) => kategori.nama));
  const produkValid = [];
  const errors = [];

  for (const baris of barisData) {
    if (baris.fields.length !== kolom.length) {
      errors.push({ baris: baris.nomorBaris, pesan: `jumlah kolom ${baris.fields.length}, seharusnya ${kolom.length}` });
      continue;
    }

    const hasil = produkDariBarisCsv(baris.fields, kolom, kategoriTersediaSet);
    if (hasil.errors.length > 0) {
      errors.push({ baris: baris.nomorBaris, pesan: hasil.errors.join("; ") });
      continue;
    }
    produkValid.push({ baris: baris.nomorBaris, produk: hasil.produk });
  }

  if (produkValid.length > 0) {
    try {
      const { error } = await supabase
        .from("produk")
        .insert(produkValid.map((item) => item.produk));
      if (error) throw error;
    } catch (error) {
      logServerError("Gagal menyimpan hasil impor produk:", error);
      const alasan = "Gagal disimpan oleh database. Periksa struktur tabel dan nilai kategori.";
      errors.push(...produkValid.map((item) => ({ baris: item.baris, pesan: alasan })));
      return {
        message: "Tidak ada baris valid yang berhasil disimpan karena proses batch gagal.",
        successCount: 0,
        failedCount: barisData.length,
        errors,
      };
    }

    revalidatePath("/", "layout");
    revalidatePath("/admin");
    revalidatePath("/admin/aktivitas");
  }

  return {
    message: `Impor selesai: ${produkValid.length} berhasil, ${errors.length} gagal.`,
    successCount: produkValid.length,
    failedCount: errors.length,
    errors,
  };
}

