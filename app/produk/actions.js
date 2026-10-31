"use server";

import { revalidatePath } from "next/cache";
import { createSupabasePublicServerClient } from "@/lib/supabase/public-server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const BATAS_NAMA = 80;
const BATAS_KOMENTAR = 1000;

export async function kirimUlasan(_previousState, formData) {
  const nilai = {
    produkId: String(formData.get("produk_id") ?? "").trim(),
    nama: String(formData.get("nama") ?? "").trim(),
    rating: String(formData.get("rating") ?? "").trim(),
    komentar: String(formData.get("komentar") ?? "").trim(),
  };
  const errors = {};

  if (!/^\d+$/.test(nilai.produkId) || !Number.isSafeInteger(Number(nilai.produkId))) {
    errors.form = "Produk tidak valid.";
  }
  if (!nilai.nama) errors.nama = "Nama wajib diisi.";
  else if (nilai.nama.length > BATAS_NAMA) errors.nama = `Nama maksimal ${BATAS_NAMA} karakter.`;
  if (!/^[1-5]$/.test(nilai.rating)) errors.rating = "Pilih rating dari 1 sampai 5.";
  if (!nilai.komentar) errors.komentar = "Komentar wajib diisi.";
  else if (nilai.komentar.length > BATAS_KOMENTAR) {
    errors.komentar = `Komentar maksimal ${BATAS_KOMENTAR} karakter.`;
  }

  if (Object.keys(errors).length > 0) return { errors, values: nilai, success: false };

  // Honeypot: kirim respons sukses yang sama tanpa menyimpan kiriman otomatis.
  if (String(formData.get("website") ?? "").trim()) {
    return { errors: {}, values: {}, success: true, message: "Ulasan berhasil dikirim." };
  }

  try {
    const supabaseAdminRead = createSupabaseServerClient();
    const { data: produk, error: errorProduk } = await supabaseAdminRead
      .from("produk")
      .select("id")
      .eq("id", nilai.produkId)
      .eq("aktif", true)
      .maybeSingle();

    if (errorProduk || !produk) {
      return {
        errors: { form: "Produk tidak ditemukan atau sudah tidak aktif." },
        values: nilai,
        success: false,
      };
    }

    const supabase = createSupabasePublicServerClient();
    const { error } = await supabase.from("ulasan").insert({
      produk_id: Number(nilai.produkId),
      nama: nilai.nama,
      rating: Number(nilai.rating),
      komentar: nilai.komentar,
    });

    if (error) {
      console.error("Gagal menyimpan ulasan:", error.message);
      return {
        errors: { form: "Ulasan belum dapat disimpan. Silakan coba lagi." },
        values: nilai,
        success: false,
      };
    }
  } catch (error) {
    console.error("Gagal menyimpan ulasan:", error?.message ?? error);
    return {
      errors: { form: "Ulasan belum dapat disimpan. Periksa koneksi lalu coba lagi." },
      values: nilai,
      success: false,
    };
  }

  revalidatePath(`/produk/${nilai.produkId}`);
  return { errors: {}, values: {}, success: true, message: "Terima kasih, ulasan Anda berhasil dikirim." };
}
