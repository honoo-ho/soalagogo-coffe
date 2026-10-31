"use server";

import { redirect } from "next/navigation";
import { createSupabaseSessionClient } from "@/lib/supabase/session";

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

  if (!nama || !hargaText || !Number.isInteger(harga) || harga < 0) {
    redirect("/admin/produk/baru?error=invalid_data");
  }

  const produk = {
    nama,
    harga,
    kategori: String(formData.get("kategori") ?? "").trim() || null,
    foto_url: String(formData.get("foto_url") ?? "").trim() || null,
    deskripsi: String(formData.get("deskripsi") ?? "").trim() || null,
  };

  let error;
  try {
    ({ error } = await supabase.from("produk").insert(produk));
  } catch (insertError) {
    console.error("Gagal menyimpan produk:", insertError);
    redirect("/admin/produk/baru?error=save_failed");
  }

  if (error) {
    console.error("Gagal menyimpan produk:", error.message);
    redirect("/admin/produk/baru?error=save_failed");
  }

  redirect("/admin");
}
