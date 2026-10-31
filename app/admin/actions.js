"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseSessionClient } from "@/lib/supabase/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/log-error";

const BUCKET_FOTO_PRODUK = "foto-produk";
const UKURAN_MAKS_FOTO = 4 * 1024 * 1024;
const UKURAN_MAKS_TOTAL_FOTO = 4 * 1024 * 1024;
const JUMLAH_MAKS_FOTO = 10;
const EKSTENSI_FOTO = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};
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

function signatureGambarValid(tipe, bytes) {
  if (tipe === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (tipe === "image/png") {
    return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte);
  }
  if (tipe === "image/webp") {
    return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  if (tipe === "image/gif") {
    const signature = String.fromCharCode(...bytes.slice(0, 6));
    return signature === "GIF87a" || signature === "GIF89a";
  }
  return false;
}

async function validasiFileFoto(formData) {
  const files = formData
    .getAll("foto_file")
    .filter((file) => typeof file !== "string" && file.name);

  if (files.length > JUMLAH_MAKS_FOTO) {
    return { files, error: "Pilih maksimal 10 foto." };
  }

  if (files.reduce((total, file) => total + file.size, 0) > UKURAN_MAKS_TOTAL_FOTO) {
    return { files, error: "Ukuran total foto maksimal 4 MB." };
  }

  for (const file of files) {
    if (!EKSTENSI_FOTO[file.type] || file.size === 0) {
      return { files, error: "Foto harus berupa JPG, PNG, WebP, atau GIF yang valid." };
    }
    if (file.size > UKURAN_MAKS_FOTO) {
      return { files, error: "Ukuran setiap foto maksimal 4 MB." };
    }

    const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    if (!signatureGambarValid(file.type, bytes)) {
      return { files, error: "Isi file tidak cocok dengan tipe gambar yang dipilih." };
    }
  }

  return { files, error: null };
}

async function hapusUploadFoto(supabase, paths) {
  if (paths.length === 0) return;
  try {
    const { error } = await supabase.storage.from(BUCKET_FOTO_PRODUK).remove(paths);
    if (error) logServerError("Gagal membersihkan upload foto:", error);
  } catch (error) {
    logServerError("Gagal membersihkan upload foto:", error);
  }
}

async function unggahFileFoto(supabase, files) {
  const urlFoto = [];
  const paths = [];

  for (const file of files) {
    const path = `${randomUUID()}.${EKSTENSI_FOTO[file.type]}`;
    paths.push(path);
    try {
      const { data, error } = await supabase.storage
        .from(BUCKET_FOTO_PRODUK)
        .upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });

      if (error) throw error;
      urlFoto.push(supabase.storage.from(BUCKET_FOTO_PRODUK).getPublicUrl(data.path).data.publicUrl);
    } catch (error) {
      logServerError("Gagal mengunggah foto produk:", error);
      await hapusUploadFoto(supabase, paths);
      return { urlFoto: [], paths: [], error: "Foto gagal diunggah. Periksa bucket foto-produk lalu coba lagi." };
    }
  }

  return { urlFoto, paths, error: null };
}

async function kategoriTersedia(supabase, nama) {
  if (!nama) return true;
  try {
    const { data, error } = await supabase
      .from("kategori")
      .select("nama")
      .eq("nama", nama)
      .maybeSingle();
    return !error && Boolean(data);
  } catch {
    return false;
  }
}

function ambilNilaiFormProduk(formData) {
  return {
    nama: String(formData.get("nama") ?? "").trim(),
    harga: String(formData.get("harga") ?? "").trim(),
    harga_diskon: String(formData.get("harga_diskon") ?? "").trim(),
    kategori: String(formData.get("kategori") ?? "").trim(),
    badge: String(formData.get("badge") ?? "").trim(),
    stok: String(formData.get("stok") ?? "").trim(),
    foto_url: String(formData.get("foto_url") ?? ""),
    deskripsi: String(formData.get("deskripsi") ?? ""),
    varian: String(formData.get("varian") ?? ""),
  };
}

function validasiVarianProduk(teks) {
  const baris = teks.split(/\r?\n/).map((nilai) => nilai.trim()).filter(Boolean);
  if (baris.length > 20) return { data: null, error: "Maksimal 20 varian per produk." };
  const data = [];
  const namaUnik = new Set();
  for (let index = 0; index < baris.length; index += 1) {
    const pemisah = baris[index].lastIndexOf("|");
    const nama = pemisah < 0 ? "" : baris[index].slice(0, pemisah).trim();
    const hargaTeks = pemisah < 0 ? "" : baris[index].slice(pemisah + 1).trim();
    const harga = Number(hargaTeks);
    if (!nama || nama.length > 80 || !/^\d+$/.test(hargaTeks) || !Number.isSafeInteger(harga) || harga <= 0 || harga > 2147483647) {
      return { data: null, error: `Varian pada baris ${index + 1} harus berformat nama|harga, dengan nama maksimal 80 karakter dan harga bilangan bulat positif.` };
    }
    const kunci = nama.toLocaleLowerCase("id-ID");
    if (namaUnik.has(kunci)) return { data: null, error: `Nama varian “${nama}” tercantum lebih dari sekali.` };
    namaUnik.add(kunci);
    data.push({ nama, harga });
  }
  return { data, error: null };
}

async function gantiVarianProduk(supabase, produkId, varian) {
  const { error: errorHapus } = await supabase.from("varian_produk").delete().eq("produk_id", produkId);
  if (errorHapus) throw errorHapus;
  if (varian.length === 0) return;
  const { error } = await supabase.from("varian_produk").insert(
    varian.map((item) => ({ ...item, produk_id: produkId }))
  );
  if (error) throw error;
}

function validasiNilaiFormProduk(nilai) {
  const errors = {};
  const harga = Number(nilai.harga);
  const hargaDiskon = nilai.harga_diskon === "" ? null : Number(nilai.harga_diskon);
  const stok = nilai.stok === "" ? null : Number(nilai.stok);

  if (!nilai.nama) errors.nama = "Nama produk wajib diisi.";
  if (!nilai.harga || !Number.isInteger(harga) || harga <= 0) {
    errors.harga = "Harga harus berupa bilangan bulat positif.";
  }
  if (
    hargaDiskon !== null &&
    (!Number.isInteger(hargaDiskon) || hargaDiskon < 0 || hargaDiskon >= harga)
  ) {
    errors.harga_diskon = "Harga diskon harus bilangan bulat dan lebih rendah dari harga normal.";
  }
  if (nilai.badge && !["baru", "terlaris"].includes(nilai.badge)) {
    errors.badge = "Pilih badge yang tersedia.";
  }
  if (stok !== null && (!Number.isInteger(stok) || stok < 0)) {
    errors.stok = "Stok harus bilangan bulat minimal 0.";
  }

  return { errors, harga, hargaDiskon, stok };
}

function gabungkanFotoProduk(formData, urlFoto) {
  const fotoManual = String(formData.get("foto_url") ?? "")
    .split(/\r?\n/)
    .map((url) => url.trim())
    .filter(Boolean);
  return [...fotoManual, ...urlFoto].join("\n") || null;
}

export async function masukAdmin(formData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/admin/login?error=login_failed");
  }

  let error;
  try {
    const supabase = await createSupabaseSessionClient();
    ({ error } = await supabase.auth.signInWithPassword({ email, password }));
  } catch {
    redirect("/admin/login?error=login_failed");
  }

  if (error) {
    redirect("/admin/login?error=login_failed");
  }

  redirect("/admin");
}

export async function keluarAdmin() {
  try {
    const supabase = await createSupabaseSessionClient();
    await supabase.auth.signOut();
  } finally {
    redirect("/admin/login");
  }
}

export async function gantiPasswordAdmin(formData) {
  const passwordBaru = String(formData.get("password_baru") ?? "");
  const konfirmasiPassword = String(formData.get("konfirmasi_password") ?? "");

  if (passwordBaru.length < 8) {
    redirect("/admin/password?status=too_short");
  }

  if (passwordBaru !== konfirmasiPassword) {
    redirect("/admin/password?status=mismatch");
  }

  let status = "success";
  try {
    const supabase = await createSupabaseSessionClient();
    const { data, error: authError } = await supabase.auth.getUser();

    if (authError || !data.user) {
      status = "session_error";
    } else {
      const { error } = await supabase.auth.updateUser({ password: passwordBaru });
      if (error) {
        status = "update_error";
      }
    }
  } catch {
    status = "update_error";
  }

  redirect(`/admin/password?status=${status}`);
}

export async function simpanProduk(_previousState, formData) {
  let supabase;
  let user;

  try {
    supabase = await createSupabaseSessionClient();
    const { data, error } = await supabase.auth.getUser();
    user = error ? null : data.user;
  } catch {
    user = null;
  }

  if (!user) {
    redirect("/admin/login");
  }

  const nilai = ambilNilaiFormProduk(formData);
  const { errors, harga, hargaDiskon, stok } = validasiNilaiFormProduk(nilai);
  const hasilVarian = validasiVarianProduk(nilai.varian);
  if (hasilVarian.error) errors.varian = hasilVarian.error;
  if (nilai.kategori && !(await kategoriTersedia(supabase, nilai.kategori))) {
    errors.kategori = "Kategori tidak tersedia. Pilih kategori dari daftar.";
  }
  if (Object.keys(errors).length > 0) return { errors, values: nilai };

  const hasilValidasiFoto = await validasiFileFoto(formData);
  if (hasilValidasiFoto.error) {
    return { errors: { foto_file: hasilValidasiFoto.error }, values: nilai };
  }
  const { urlFoto, paths, error: errorUnggah } = await unggahFileFoto(supabase, hasilValidasiFoto.files);
  if (errorUnggah) return { errors: { foto_file: errorUnggah }, values: nilai };

  const produk = {
    nama: nilai.nama,
    harga,
    harga_diskon: hargaDiskon,
    badge: nilai.badge || null,
    stok,
    kategori: nilai.kategori || null,
    foto_url: gabungkanFotoProduk(formData, urlFoto),
    deskripsi: nilai.deskripsi.trim() || null,
  };

  let error;
  let dataProduk;
  try {
    ({ data: dataProduk, error } = await supabase.from("produk").insert(produk).select("id").single());
  } catch (insertError) {
    logServerError("Gagal menyimpan produk:", insertError);
    await hapusUploadFoto(supabase, paths);
    return { errors: { form: "Produk gagal disimpan. Periksa data dan coba lagi." }, values: nilai };
  }

  if (error) {
    logServerError("Gagal menyimpan produk:", error);
    await hapusUploadFoto(supabase, paths);
    return { errors: { form: "Produk gagal disimpan. Periksa data dan coba lagi." }, values: nilai };
  }

  try {
    await gantiVarianProduk(supabase, dataProduk.id, hasilVarian.data);
  } catch (errorVarian) {
    logServerError("Gagal menyimpan varian produk:", errorVarian);
    return { errors: { form: "Produk tersimpan, tetapi variannya gagal disimpan. Buka produk untuk mengatur ulang variannya." }, values: nilai };
  }

  redirect("/admin");
}

export async function ubahProduk(_previousState, formData) {
  let supabase;
  let user;

  try {
    supabase = await createSupabaseSessionClient();
    const { data, error } = await supabase.auth.getUser();
    user = error ? null : data.user;
  } catch {
    user = null;
  }

  if (!user) {
    redirect("/admin/login");
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!/^\d+$/.test(id)) {
    redirect("/admin?error=invalid_id");
  }

  const nilai = ambilNilaiFormProduk(formData);
  const { errors, harga, hargaDiskon, stok } = validasiNilaiFormProduk(nilai);
  const hasilVarian = validasiVarianProduk(nilai.varian);
  if (hasilVarian.error) errors.varian = hasilVarian.error;
  if (nilai.kategori && !(await kategoriTersedia(supabase, nilai.kategori))) {
    errors.kategori = "Kategori tidak tersedia. Pilih kategori dari daftar.";
  }
  if (Object.keys(errors).length > 0) return { errors, values: nilai };

  const hasilValidasiFoto = await validasiFileFoto(formData);
  if (hasilValidasiFoto.error) {
    return { errors: { foto_file: hasilValidasiFoto.error }, values: nilai };
  }
  const { urlFoto, paths, error: errorUnggah } = await unggahFileFoto(supabase, hasilValidasiFoto.files);
  if (errorUnggah) return { errors: { foto_file: errorUnggah }, values: nilai };

  const perubahan = {
    nama: nilai.nama,
    harga,
    harga_diskon: hargaDiskon,
    badge: nilai.badge || null,
    stok,
    kategori: nilai.kategori || null,
    foto_url: gabungkanFotoProduk(formData, urlFoto),
    deskripsi: nilai.deskripsi.trim() || null,
  };

  let data;
  let error;
  try {
    ({ data, error } = await supabase
      .from("produk")
      .update(perubahan)
      .eq("id", id)
      .select("id")
      .maybeSingle());
  } catch (updateError) {
    logServerError("Gagal mengubah produk:", updateError);
    await hapusUploadFoto(supabase, paths);
    return { errors: { form: "Perubahan produk gagal disimpan. Periksa data dan coba lagi." }, values: nilai };
  }

  if (error) {
    logServerError("Gagal mengubah produk:", error);
    await hapusUploadFoto(supabase, paths);
    return { errors: { form: "Perubahan produk gagal disimpan. Periksa data dan coba lagi." }, values: nilai };
  }

  if (!data) {
    await hapusUploadFoto(supabase, paths);
    return { errors: { form: "Produk tidak ditemukan atau sudah dihapus." }, values: nilai };
  }

  try {
    await gantiVarianProduk(supabase, id, hasilVarian.data);
  } catch (errorVarian) {
    logServerError("Gagal menyimpan varian produk:", errorVarian);
    return { errors: { form: "Data produk tersimpan, tetapi variannya gagal disimpan. Coba simpan perubahan lagi." }, values: nilai };
  }

  redirect("/admin");
}

export async function hapusProduk(formData) {
  let supabase;
  let user;

  try {
    supabase = await createSupabaseSessionClient();
    const { data, error } = await supabase.auth.getUser();
    user = error ? null : data.user;
  } catch {
    user = null;
  }

  if (!user) {
    redirect("/admin/login");
  }

  const id = String(formData.get("id") ?? "").trim();
  if (!/^\d+$/.test(id)) {
    redirect("/admin?error=invalid_id");
  }

  let data;
  let error;
  try {
    ({ data, error } = await supabase
      .from("produk")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle());
  } catch (deleteError) {
    logServerError("Gagal menghapus produk:", deleteError);
    redirect("/admin?error=delete_failed");
  }

  if (error) {
    logServerError("Gagal menghapus produk:", error);
    redirect("/admin?error=delete_failed");
  }

  if (!data) {
    redirect("/admin?error=not_found");
  }

  redirect("/admin");
}

export async function ubahStatusProduk(formData) {
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

  const id = String(formData.get("id") ?? "").trim();
  if (!/^\d+$/.test(id)) redirect("/admin?error=invalid_id");

  let produk;
  let error;
  try {
    ({ data: produk, error } = await supabase
      .from("produk")
      .select("aktif")
      .eq("id", id)
      .maybeSingle());
  } catch (readError) {
    logServerError("Gagal membaca status produk:", readError);
    redirect("/admin?error=status_failed");
  }

  if (error) {
    logServerError("Gagal membaca status produk:", error);
    redirect("/admin?error=status_failed");
  }
  if (!produk) redirect("/admin?error=not_found");

  let hasil;
  try {
    hasil = await supabase
      .from("produk")
      .update({ aktif: !produk.aktif })
      .eq("id", id)
      .eq("aktif", produk.aktif)
      .select("id")
      .maybeSingle();
  } catch (updateError) {
    logServerError("Gagal mengubah status produk:", updateError);
    redirect("/admin?error=status_failed");
  }

  if (hasil.error) {
    logServerError("Gagal mengubah status produk:", hasil.error);
    redirect("/admin?error=status_failed");
  }
  if (!hasil.data) redirect("/admin?error=status_conflict");

  redirect("/admin?status=status_updated");
}

export async function ubahUrutanProduk(formData) {
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

  const id = String(formData.get("id") ?? "").trim();
  const arah = String(formData.get("arah") ?? "");
  if (!/^\d+$/.test(id)) redirect("/admin?error=invalid_id");
  if (arah !== "naik" && arah !== "turun") redirect("/admin?error=order_failed");

  let hasil;
  try {
    hasil = await supabase.rpc("atur_urutan_produk", {
      p_produk_id: id,
      p_arah: arah,
    });
  } catch (error) {
    logServerError("Gagal mengubah urutan produk:", error);
    redirect("/admin?error=order_failed");
  }

  if (hasil.error) {
    logServerError("Gagal mengubah urutan produk:", hasil.error);
    redirect("/admin?error=order_failed");
  }
  if (hasil.data === "not_found") redirect("/admin?error=not_found");
  if (hasil.data === "boundary") redirect("/admin?status=order_boundary");
  if (hasil.data !== "updated") redirect("/admin?error=order_failed");

  revalidatePath("/", "layout");
  revalidatePath("/admin");
  revalidatePath("/admin/aktivitas");
  redirect(`/admin?status=order_${arah}`);
}

export async function buatDeskripsiProduk(nama, kategori) {
  let supabase;
  let user;

  try {
    supabase = await createSupabaseSessionClient();
    const { data, error } = await supabase.auth.getUser();
    user = error ? null : data.user;
  } catch {
    user = null;
  }

  if (!user) {
    return { error: "Sesi admin tidak valid. Silakan masuk kembali." };
  }

  const namaProduk = typeof nama === "string" ? nama.trim() : "";
  const kategoriProduk = typeof kategori === "string" ? kategori.trim() : "";

  if (!namaProduk || namaProduk.length > 120) {
    return { error: "Isi nama produk (maksimal 120 karakter) sebelum membuat deskripsi." };
  }

  if (kategoriProduk.length > 80) {
    return { error: "Kategori maksimal 80 karakter." };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { error: "Fitur bantuan deskripsi belum tersedia. Silakan coba lagi nanti." };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-6-luna",
        reasoning: { effort: "none" },
        instructions:
          "Tulis deskripsi produk singkat dalam bahasa Indonesia, 1 sampai 3 kalimat. Gunakan hanya informasi dari nama dan kategori yang diberikan. Jangan mengarang bahan, ukuran, asal, manfaat, stok, atau klaim lain yang tidak disebutkan. Kembalikan hanya teks deskripsi.",
        input: `Nama produk: ${namaProduk}\nKategori: ${kategoriProduk || "Tidak disebutkan"}`,
        max_output_tokens: 180,
        store: false,
      }),
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    });

    const hasil = await response.json();

    if (!response.ok) {
      logServerError("OpenAI API gagal membuat deskripsi:", response.status, hasil?.error?.code);
      return {
        error:
          response.status === 429
            ? "Batas penggunaan AI tercapai. Coba lagi nanti."
            : "Deskripsi belum dapat dibuat saat ini. Silakan coba lagi nanti.",
      };
    }

    const deskripsi = (hasil.output ?? [])
      .flatMap((item) => item.content ?? [])
      .filter((item) => item.type === "output_text")
      .map((item) => item.text)
      .join("\n")
      .trim();

    if (!deskripsi) {
      return { error: "AI tidak menghasilkan deskripsi. Silakan coba lagi." };
    }

    return { description: deskripsi };
  } catch (error) {
    logServerError("Permintaan deskripsi AI gagal:", error);
    return {
      error:
        error?.name === "TimeoutError"
          ? "Permintaan AI melewati batas waktu. Silakan coba lagi."
          : "Layanan AI tidak dapat dihubungi. Periksa koneksi lalu coba lagi.",
    };
  }
}

async function clientKategoriAdmin() {
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
  return supabase;
}

function namaKategoriValid(nama) {
  return nama.length > 0 && nama.length <= 80;
}

export async function tambahKategori(formData) {
  const supabase = await clientKategoriAdmin();
  const nama = String(formData.get("nama") ?? "").trim();
  if (!namaKategoriValid(nama)) redirect("/admin/kategori?status=invalid_name");

  let error;
  try {
    ({ error } = await supabase.from("kategori").insert({ nama }));
  } catch {
    redirect("/admin/kategori?status=save_failed");
  }
  if (error) {
    redirect(`/admin/kategori?status=${error.code === "23505" ? "duplicate" : "save_failed"}`);
  }
  redirect("/admin/kategori?status=created");
}

export async function ubahKategori(formData) {
  const supabase = await clientKategoriAdmin();
  const namaLama = String(formData.get("nama_lama") ?? "").trim();
  const namaBaru = String(formData.get("nama_baru") ?? "").trim();

  if (!namaLama || !namaKategoriValid(namaBaru)) {
    redirect("/admin/kategori?status=invalid_name");
  }

  let data;
  let error;
  try {
    ({ data, error } = await supabase
      .from("kategori")
      .update({ nama: namaBaru })
      .eq("nama", namaLama)
      .select("nama")
      .maybeSingle());
  } catch {
    redirect("/admin/kategori?status=save_failed");
  }

  if (error) {
    redirect(`/admin/kategori?status=${error.code === "23505" ? "duplicate" : "save_failed"}`);
  }
  if (!data) redirect("/admin/kategori?status=not_found");
  redirect("/admin/kategori?status=updated");
}

export async function hapusKategori(formData) {
  const supabase = await clientKategoriAdmin();
  const nama = String(formData.get("nama") ?? "").trim();
  if (!nama) redirect("/admin/kategori?status=not_found");

  let produk;
  let errorProduk;
  try {
    ({ data: produk, error: errorProduk } = await supabase
      .from("produk")
      .select("id")
      .eq("kategori", nama)
      .limit(1));
  } catch {
    redirect("/admin/kategori?status=delete_failed");
  }
  if (errorProduk) redirect("/admin/kategori?status=delete_failed");
  if (produk?.length) redirect("/admin/kategori?status=in_use");

  let data;
  let error;
  try {
    ({ data, error } = await supabase
      .from("kategori")
      .delete()
      .eq("nama", nama)
      .select("nama")
      .maybeSingle());
  } catch {
    redirect("/admin/kategori?status=delete_failed");
  }

  if (error) {
    redirect(`/admin/kategori?status=${error.code === "23503" ? "in_use" : "delete_failed"}`);
  }
  if (!data) redirect("/admin/kategori?status=not_found");
  redirect("/admin/kategori?status=deleted");
}

async function clientAdminUntukModerasiUlasan() {
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
  return supabase;
}

function idUlasanValid(formData) {
  const id = String(formData.get("id") ?? "").trim();
  return /^\d+$/.test(id) && Number.isSafeInteger(Number(id)) ? id : null;
}

export async function ubahStatusUlasan(formData) {
  const supabase = await clientAdminUntukModerasiUlasan();
  const id = idUlasanValid(formData);
  if (!id) redirect("/admin/ulasan?status=invalid_id");

  let ulasan;
  let error;
  try {
    ({ data: ulasan, error } = await supabase
      .from("ulasan")
      .select("id,produk_id,ditampilkan")
      .eq("id", id)
      .maybeSingle());
  } catch {
    redirect("/admin/ulasan?status=update_failed");
  }
  if (error) redirect("/admin/ulasan?status=update_failed");
  if (!ulasan) redirect("/admin/ulasan?status=not_found");

  let hasil;
  try {
    hasil = await supabase
      .from("ulasan")
      .update({ ditampilkan: !ulasan.ditampilkan })
      .eq("id", id)
      .eq("ditampilkan", ulasan.ditampilkan)
      .select("id")
      .maybeSingle();
  } catch {
    redirect("/admin/ulasan?status=update_failed");
  }
  if (hasil.error) redirect("/admin/ulasan?status=update_failed");
  if (!hasil.data) redirect("/admin/ulasan?status=update_conflict");

  revalidatePath(`/produk/${ulasan.produk_id}`);
  revalidatePath("/admin/ulasan");
  redirect(`/admin/ulasan?status=${ulasan.ditampilkan ? "hidden" : "shown"}`);
}

export async function hapusUlasan(formData) {
  const supabase = await clientAdminUntukModerasiUlasan();
  const id = idUlasanValid(formData);
  if (!id) redirect("/admin/ulasan?status=invalid_id");

  let data;
  let error;
  try {
    ({ data, error } = await supabase
      .from("ulasan")
      .delete()
      .eq("id", id)
      .select("id,produk_id")
      .maybeSingle());
  } catch {
    redirect("/admin/ulasan?status=delete_failed");
  }
  if (error) redirect("/admin/ulasan?status=delete_failed");
  if (!data) redirect("/admin/ulasan?status=not_found");

  revalidatePath(`/produk/${data.produk_id}`);
  revalidatePath("/admin/ulasan");
  redirect("/admin/ulasan?status=deleted");
}

async function clientAdminUntukBanner() {
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
  return supabase;
}

function validasiUrlBanner(nilai, label) {
  if (!nilai || nilai.length > 2048) return `${label} wajib diisi dan maksimal 2048 karakter.`;
  try {
    const url = new URL(nilai);
    if (url.protocol !== "http:" && url.protocol !== "https:") return `${label} harus memakai URL HTTP atau HTTPS.`;
  } catch {
    return `${label} harus berupa URL lengkap yang valid.`;
  }
  return null;
}

function ambilNilaiBanner(formData) {
  return {
    id: String(formData.get("id") ?? "").trim(),
    judul: String(formData.get("judul") ?? "").trim(),
    teks: String(formData.get("teks") ?? "").trim(),
    gambar_url: String(formData.get("gambar_url") ?? "").trim(),
    tautan: String(formData.get("tautan") ?? "").trim(),
  };
}

function validasiBanner(nilai) {
  if (!nilai.judul || nilai.judul.length > 120) return "Judul wajib diisi dan maksimal 120 karakter.";
  if (!nilai.teks || nilai.teks.length > 500) return "Teks wajib diisi dan maksimal 500 karakter.";
  return validasiUrlBanner(nilai.gambar_url, "URL gambar") || validasiUrlBanner(nilai.tautan, "Tautan");
}

export async function simpanBannerPromo(formData) {
  const supabase = await clientAdminUntukBanner();
  const nilai = ambilNilaiBanner(formData);
  const errorValidasi = validasiBanner(nilai);
  if (errorValidasi) redirect(`/admin/banner?status=invalid&pesan=${encodeURIComponent(errorValidasi)}`);

  const payload = {
    judul: nilai.judul,
    teks: nilai.teks,
    gambar_url: nilai.gambar_url,
    tautan: nilai.tautan,
  };

  if (nilai.id) {
    if (!/^\d+$/.test(nilai.id) || !Number.isSafeInteger(Number(nilai.id))) {
      redirect("/admin/banner?status=invalid_id");
    }

    let data;
    let error;
    try {
      ({ data, error } = await supabase
        .from("banner_promo")
        .update(payload)
        .eq("id", nilai.id)
        .select("id")
        .maybeSingle());
    } catch {
      redirect("/admin/banner?status=save_failed");
    }
    if (error) redirect("/admin/banner?status=save_failed");
    if (!data) redirect("/admin/banner?status=not_found");

    revalidatePath("/");
    revalidatePath("/admin/banner");
    redirect("/admin/banner?status=updated");
  }

  let error;
  try {
    ({ error } = await supabase.from("banner_promo").insert(payload));
  } catch {
    redirect("/admin/banner?status=save_failed");
  }
  if (error) redirect("/admin/banner?status=save_failed");

  revalidatePath("/");
  revalidatePath("/admin/banner");
  redirect("/admin/banner?status=created");
}

export async function ubahStatusBannerPromo(formData) {
  const supabase = await clientAdminUntukBanner();
  const id = String(formData.get("id") ?? "").trim();
  if (!/^\d+$/.test(id) || !Number.isSafeInteger(Number(id))) redirect("/admin/banner?status=invalid_id");

  let banner;
  let error;
  try {
    ({ data: banner, error } = await supabase
      .from("banner_promo")
      .select("id,aktif")
      .eq("id", id)
      .maybeSingle());
  } catch {
    redirect("/admin/banner?status=update_failed");
  }
  if (error) redirect("/admin/banner?status=update_failed");
  if (!banner) redirect("/admin/banner?status=not_found");

  let hasil;
  try {
    hasil = await supabase
      .from("banner_promo")
      .update({ aktif: !banner.aktif })
      .eq("id", id)
      .eq("aktif", banner.aktif)
      .select("id")
      .maybeSingle();
  } catch {
    redirect("/admin/banner?status=update_failed");
  }
  if (hasil.error) redirect("/admin/banner?status=update_failed");
  if (!hasil.data) redirect("/admin/banner?status=update_conflict");

  revalidatePath("/");
  revalidatePath("/admin/banner");
  redirect(`/admin/banner?status=${banner.aktif ? "disabled" : "enabled"}`);
}

export async function simpanPengaturanToko(formData) {
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

  const pengaturan = {
    id: 1,
    nama_toko: String(formData.get("nama_toko") ?? "").trim(),
    nomor_whatsapp: String(formData.get("nomor_whatsapp") ?? "").trim(),
    jam_buka: String(formData.get("jam_buka") ?? "").trim(),
    alamat: String(formData.get("alamat") ?? "").trim(),
    updated_at: new Date().toISOString(),
  };

  if (!pengaturan.nama_toko || pengaturan.nama_toko.length > 120) {
    redirect("/admin/pengaturan?status=invalid_name");
  }
  if (!/^[1-9]\d{7,14}$/.test(pengaturan.nomor_whatsapp)) {
    redirect("/admin/pengaturan?status=invalid_phone");
  }
  if (!pengaturan.jam_buka || pengaturan.jam_buka.length > 120) {
    redirect("/admin/pengaturan?status=invalid_hours");
  }
  if (!pengaturan.alamat || pengaturan.alamat.length > 250) {
    redirect("/admin/pengaturan?status=invalid_address");
  }

  let error;
  try {
    ({ error } = await supabase
      .from("pengaturan_toko")
      .upsert(pengaturan, { onConflict: "id" }));
  } catch (saveError) {
    logServerError("Gagal menyimpan pengaturan toko:", saveError);
    redirect("/admin/pengaturan?status=save_failed");
  }

  if (error) {
    logServerError("Gagal menyimpan pengaturan toko:", error);
    redirect("/admin/pengaturan?status=save_failed");
  }

  revalidatePath("/", "layout");
  revalidatePath("/tentang");
  revalidatePath("/manifest.webmanifest");
  revalidatePath("/admin/pengaturan");
  redirect("/admin/pengaturan?status=saved");
}

async function clientAdminUntukKelolaAkun() {
  let sessionClient;
  let user;

  try {
    sessionClient = await createSupabaseSessionClient();
    const { data, error } = await sessionClient.auth.getUser();
    user = error ? null : data.user;
  } catch {
    user = null;
  }

  if (!user) redirect("/admin/login");

  try {
    return { supabase: createSupabaseServerClient(), user };
  } catch (error) {
    logServerError("Konfigurasi pengelolaan akun admin tidak tersedia:", error);
    redirect("/admin/akun?status=service_unavailable");
  }
}

function emailValid(email) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function undangAdmin(formData) {
  const { supabase } = await clientAdminUntukKelolaAkun();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();

  if (!emailValid(email)) redirect("/admin/akun?status=invalid_email");

  let error;
  try {
    ({ error } = await supabase.auth.admin.inviteUserByEmail(email));
  } catch (inviteError) {
    logServerError("Gagal mengundang akun admin:", inviteError);
    redirect("/admin/akun?status=invite_failed");
  }
  if (error) {
    logServerError("Gagal mengundang akun admin:", error);
    redirect("/admin/akun?status=invite_failed");
  }

  revalidatePath("/admin/akun");
  redirect("/admin/akun?status=invited");
}

export async function ubahStatusAdmin(formData) {
  const { supabase, user } = await clientAdminUntukKelolaAkun();
  const id = String(formData.get("id") ?? "").trim();
  const aksi = String(formData.get("aksi") ?? "");
  if (aksi !== "nonaktifkan" && aksi !== "aktifkan") {
    redirect("/admin/akun?status=invalid_action");
  }
  const nonaktifkan = aksi === "nonaktifkan";

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    redirect("/admin/akun?status=invalid_id");
  }
  if (id === user.id) redirect("/admin/akun?status=self_action_denied");

  let error;
  try {
    ({ error } = await supabase.auth.admin.updateUserById(id, {
      ban_duration: nonaktifkan ? "876000h" : "none",
    }));
  } catch (updateError) {
    logServerError("Gagal mengubah status akun admin:", updateError);
    redirect("/admin/akun?status=update_failed");
  }
  if (error) {
    logServerError("Gagal mengubah status akun admin:", error);
    redirect("/admin/akun?status=update_failed");
  }

  revalidatePath("/admin/akun");
  redirect(`/admin/akun?status=${nonaktifkan ? "disabled" : "enabled"}`);
}

export async function hapusAdmin(formData) {
  const { supabase, user } = await clientAdminUntukKelolaAkun();
  const id = String(formData.get("id") ?? "").trim();

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    redirect("/admin/akun?status=invalid_id");
  }
  if (id === user.id) redirect("/admin/akun?status=self_action_denied");

  let error;
  try {
    ({ error } = await supabase.auth.admin.deleteUser(id));
  } catch (deleteError) {
    logServerError("Gagal menghapus akun admin:", deleteError);
    redirect("/admin/akun?status=delete_failed");
  }
  if (error) {
    logServerError("Gagal menghapus akun admin:", error);
    redirect("/admin/akun?status=delete_failed");
  }

  revalidatePath("/admin/akun");
  redirect("/admin/akun?status=deleted");
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
