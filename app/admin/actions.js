"use server";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { createSupabaseSessionClient } from "@/lib/supabase/session";

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

async function validasiFileFoto(formData, pathKembali) {
  const files = formData
    .getAll("foto_file")
    .filter((file) => typeof file !== "string" && file.name);

  if (files.length > JUMLAH_MAKS_FOTO) {
    redirect(`${pathKembali}?error=too_many_images`);
  }

  if (files.reduce((total, file) => total + file.size, 0) > UKURAN_MAKS_TOTAL_FOTO) {
    redirect(`${pathKembali}?error=image_too_large`);
  }

  for (const file of files) {
    if (!EKSTENSI_FOTO[file.type] || file.size === 0) {
      redirect(`${pathKembali}?error=invalid_image`);
    }
    if (file.size > UKURAN_MAKS_FOTO) {
      redirect(`${pathKembali}?error=image_too_large`);
    }

    const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    if (!signatureGambarValid(file.type, bytes)) {
      redirect(`${pathKembali}?error=invalid_image`);
    }
  }

  return files;
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

async function unggahFileFoto(supabase, files, pathKembali) {
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
      redirect(`${pathKembali}?error=upload_failed`);
    }
  }

  return { urlFoto, paths };
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

export async function simpanProduk(formData) {
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

  const nama = String(formData.get("nama") ?? "").trim();
  const hargaText = String(formData.get("harga") ?? "").trim();
  const harga = Number(hargaText);
  const hargaDiskonText = String(formData.get("harga_diskon") ?? "").trim();
  const hargaDiskon = hargaDiskonText === "" ? null : Number(hargaDiskonText);
  const badgeInput = String(formData.get("badge") ?? "").trim();
  const badge = badgeInput || null;
  const stokText = String(formData.get("stok") ?? "").trim();
  const stok = stokText === "" ? null : Number(stokText);

  if (
    !nama ||
    !hargaText ||
    !Number.isInteger(harga) ||
    harga < 0 ||
    (hargaDiskon !== null &&
      (!Number.isInteger(hargaDiskon) || hargaDiskon < 0 || hargaDiskon >= harga)) ||
    (badge !== null && !["baru", "terlaris"].includes(badge)) ||
    (stok !== null && (!Number.isInteger(stok) || stok < 0))
  ) {
    redirect("/admin/produk/baru?error=invalid_data");
  }

  const files = await validasiFileFoto(formData, "/admin/produk/baru");
  const { urlFoto, paths } = await unggahFileFoto(supabase, files, "/admin/produk/baru");

  const produk = {
    nama,
    harga,
    harga_diskon: hargaDiskon,
    badge,
    stok,
    kategori: String(formData.get("kategori") ?? "").trim() || null,
    foto_url: gabungkanFotoProduk(formData, urlFoto),
    deskripsi: String(formData.get("deskripsi") ?? "").trim() || null,
  };

  let error;
  try {
    ({ error } = await supabase.from("produk").insert(produk));
  } catch (insertError) {
    console.error("Gagal menyimpan produk:", insertError);
    await hapusUploadFoto(supabase, paths);
    redirect("/admin/produk/baru?error=save_failed");
  }

  if (error) {
    console.error("Gagal menyimpan produk:", error.message);
    await hapusUploadFoto(supabase, paths);
    redirect("/admin/produk/baru?error=save_failed");
  }

  redirect("/admin");
}

export async function ubahProduk(formData) {
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

  const pathUbah = `/admin/produk/${id}/ubah`;
  const nama = String(formData.get("nama") ?? "").trim();
  const hargaText = String(formData.get("harga") ?? "").trim();
  const harga = Number(hargaText);
  const hargaDiskonText = String(formData.get("harga_diskon") ?? "").trim();
  const hargaDiskon = hargaDiskonText === "" ? null : Number(hargaDiskonText);
  const badgeInput = String(formData.get("badge") ?? "").trim();
  const badge = badgeInput || null;
  const stokText = String(formData.get("stok") ?? "").trim();
  const stok = stokText === "" ? null : Number(stokText);

  if (
    !nama ||
    !hargaText ||
    !Number.isInteger(harga) ||
    harga < 0 ||
    (hargaDiskon !== null &&
      (!Number.isInteger(hargaDiskon) || hargaDiskon < 0 || hargaDiskon >= harga)) ||
    (badge !== null && !["baru", "terlaris"].includes(badge)) ||
    (stok !== null && (!Number.isInteger(stok) || stok < 0))
  ) {
    redirect(`${pathUbah}?error=invalid_data`);
  }

  const files = await validasiFileFoto(formData, pathUbah);
  const { urlFoto, paths } = await unggahFileFoto(supabase, files, pathUbah);

  const perubahan = {
    nama,
    harga,
    harga_diskon: hargaDiskon,
    badge,
    stok,
    kategori: String(formData.get("kategori") ?? "").trim() || null,
    foto_url: gabungkanFotoProduk(formData, urlFoto),
    deskripsi: String(formData.get("deskripsi") ?? "").trim() || null,
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
    redirect(`${pathUbah}?error=save_failed`);
  }

  if (error) {
    console.error("Gagal mengubah produk:", error.message);
    await hapusUploadFoto(supabase, paths);
    redirect(`${pathUbah}?error=save_failed`);
  }

  if (!data) {
    await hapusUploadFoto(supabase, paths);
    redirect(`${pathUbah}?error=not_found`);
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
