"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseSessionClient } from "@/lib/supabase/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
    if (error) console.error("Gagal membersihkan upload foto:", error.message);
  } catch (error) {
    console.error("Gagal membersihkan upload foto:", error);
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
      console.error("Gagal mengunggah foto produk:", error?.message ?? error);
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
  };
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
  try {
    ({ error } = await supabase.from("produk").insert(produk));
  } catch (insertError) {
    console.error("Gagal menyimpan produk:", insertError);
    await hapusUploadFoto(supabase, paths);
    return { errors: { form: "Produk gagal disimpan. Periksa data dan coba lagi." }, values: nilai };
  }

  if (error) {
    console.error("Gagal menyimpan produk:", error.message);
    await hapusUploadFoto(supabase, paths);
    return { errors: { form: "Produk gagal disimpan. Periksa data dan coba lagi." }, values: nilai };
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
    console.error("Gagal mengubah produk:", updateError);
    await hapusUploadFoto(supabase, paths);
    return { errors: { form: "Perubahan produk gagal disimpan. Periksa data dan coba lagi." }, values: nilai };
  }

  if (error) {
    console.error("Gagal mengubah produk:", error.message);
    await hapusUploadFoto(supabase, paths);
    return { errors: { form: "Perubahan produk gagal disimpan. Periksa data dan coba lagi." }, values: nilai };
  }

  if (!data) {
    await hapusUploadFoto(supabase, paths);
    return { errors: { form: "Produk tidak ditemukan atau sudah dihapus." }, values: nilai };
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
    console.error("Gagal menghapus produk:", deleteError);
    redirect("/admin?error=delete_failed");
  }

  if (error) {
    console.error("Gagal menghapus produk:", error.message);
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
    console.error("Gagal membaca status produk:", readError);
    redirect("/admin?error=status_failed");
  }

  if (error) {
    console.error("Gagal membaca status produk:", error.message);
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
    console.error("Gagal mengubah status produk:", updateError);
    redirect("/admin?error=status_failed");
  }

  if (hasil.error) {
    console.error("Gagal mengubah status produk:", hasil.error.message);
    redirect("/admin?error=status_failed");
  }
  if (!hasil.data) redirect("/admin?error=status_conflict");

  redirect("/admin?status=status_updated");
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
    return { error: "OPENAI_API_KEY belum diatur di environment server." };
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
      console.error("OpenAI API gagal membuat deskripsi:", response.status, hasil?.error?.code);
      return {
        error:
          response.status === 429
            ? "Batas penggunaan AI tercapai. Coba lagi nanti."
            : "Deskripsi gagal dibuat oleh AI. Periksa konfigurasi API lalu coba lagi.",
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
    console.error("Permintaan deskripsi AI gagal:", error);
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
    console.error("Gagal menyimpan pengaturan toko:", saveError?.message ?? saveError);
    redirect("/admin/pengaturan?status=save_failed");
  }

  if (error) {
    console.error("Gagal menyimpan pengaturan toko:", error.message);
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
    console.error("Konfigurasi pengelolaan akun admin tidak tersedia:", error?.message ?? error);
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
    console.error("Gagal mengundang akun admin:", inviteError?.message ?? inviteError);
    redirect("/admin/akun?status=invite_failed");
  }
  if (error) {
    console.error("Gagal mengundang akun admin:", error.message);
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
    console.error("Gagal mengubah status akun admin:", updateError?.message ?? updateError);
    redirect("/admin/akun?status=update_failed");
  }
  if (error) {
    console.error("Gagal mengubah status akun admin:", error.message);
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
    console.error("Gagal menghapus akun admin:", deleteError?.message ?? deleteError);
    redirect("/admin/akun?status=delete_failed");
  }
  if (error) {
    console.error("Gagal menghapus akun admin:", error.message);
    redirect("/admin/akun?status=delete_failed");
  }

  revalidatePath("/admin/akun");
  redirect("/admin/akun?status=deleted");
}
