import { cache } from "react";
import { createSupabasePublicServerClient } from "@/lib/supabase/public-server";
import { toko } from "@/lib/toko";
import { logServerError } from "@/lib/log-error";

export const ambilPengaturanToko = cache(async () => {
  try {
    const supabase = createSupabasePublicServerClient();
    const { data, error } = await supabase
      .from("pengaturan_toko")
      .select("nama_toko,nomor_whatsapp,alamat,jam_buka")
      .eq("id", 1)
      .maybeSingle();

    if (error) throw error;
    if (!data) return toko;

    return {
      ...toko,
      nama: data.nama_toko,
      nomorWhatsApp: data.nomor_whatsapp,
      alamat: data.alamat,
      jamBuka: data.jam_buka,
    };
  } catch (error) {
    logServerError("Gagal mengambil pengaturan toko, menggunakan nilai cadangan:", error);
    return toko;
  }
});
