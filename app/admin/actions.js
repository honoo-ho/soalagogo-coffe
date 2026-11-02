"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseSessionClient } from "@/lib/supabase/session";
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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { error: "Fitur bantuan deskripsi belum tersedia. Silakan coba lagi nanti." };
  }

  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        model: "gemini-3.8-flash",
        system_instruction:
          "Tulis deskripsi produk yang menarik dan wajar dalam bahasa Indonesia, 1 sampai 3 kalimat. Gunakan hanya nama dan kategori yang diberikan. Jangan mengarang bahan, komposisi, ukuran, asal, manfaat, stok, atau klaim lain. Kembalikan hanya teks deskripsi tanpa judul atau daftar.",
        input: `Nama produk: ${namaProduk}\nKategori: ${kategoriProduk || "Tidak disebutkan"}`,
        generation_config: { max_output_tokens: 220, thinking_level: "minimal" },
        store: false,
      }),
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    });

    let hasil;
    try {
      hasil = await response.json();
    } catch {
      logServerError("Gemini API gagal membuat deskripsi:", response.status);
      return { error: "Respons AI tidak dapat dibaca. Silakan coba lagi nanti." };
    }

    if (!response.ok) {
      logServerError("Gemini API gagal membuat deskripsi:", response.status);
      return {
        error:
          response.status === 429
            ? "Batas penggunaan AI tercapai. Coba lagi nanti."
            : "Deskripsi belum dapat dibuat saat ini. Silakan coba lagi nanti.",
      };
    }

    const deskripsi = typeof hasil?.output_text === "string" ? hasil.output_text.trim() : "";

    if (!deskripsi) {
      return { error: "AI tidak menghasilkan deskripsi. Silakan coba lagi." };
    }

    if (deskripsi.length > 1200) {
      return { error: "Deskripsi dari AI terlalu panjang. Silakan coba lagi." };
    }

    const jumlahKalimat = deskripsi.split(/(?<=[.!?])\s+/u).filter(Boolean).length;
    if (jumlahKalimat < 1 || jumlahKalimat > 3) {
      return { error: "Format deskripsi AI tidak sesuai. Silakan coba lagi." };
    }

    return { description: deskripsi };
  } catch (error) {
    logServerError("Permintaan deskripsi Gemini gagal:", error?.name === "TimeoutError" ? 504 : 0);
    return {
      error:
        error?.name === "TimeoutError" || error?.name === "AbortError"
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
