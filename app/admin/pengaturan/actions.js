"use server";

import { createSupabaseSessionClient } from "@/lib/supabase/session";
import { logServerError } from "@/lib/log-error";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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

