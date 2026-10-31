import { createSupabaseSessionClient } from "@/lib/supabase/session";

const UKURAN_BATCH = 1000;
const KOLOM = [
  ["id", "ID"],
  ["nama", "Nama produk"],
  ["harga", "Harga (Rp)"],
  ["harga_diskon", "Harga diskon (Rp)"],
  ["badge", "Badge"],
  ["deskripsi", "Deskripsi"],
  ["foto_url", "Foto URL"],
  ["kategori", "Kategori"],
  ["stok", "Stok"],
  ["aktif", "Aktif"],
  ["created_at", "Dibuat pada"],
];

function nilaiCsv(nilai) {
  let teks = nilai == null ? "" : String(nilai);
  if (/^[\t\r ]*[=+@-]/.test(teks)) teks = `'${teks}`;
  return `"${teks.replaceAll('"', '""')}"`;
}

export async function GET() {
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
    return new Response("Login admin diperlukan untuk mengekspor produk.", {
      status: 401,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  try {
    const produk = [];
    let awal = 0;

    while (true) {
      const { data, error } = await supabase
        .from("produk")
        .select(KOLOM.map(([kunci]) => kunci).join(","))
        .order("id", { ascending: true })
        .range(awal, awal + UKURAN_BATCH - 1);

      if (error) throw error;
      const batch = data ?? [];
      produk.push(...batch);
      if (batch.length < UKURAN_BATCH) break;
      awal += batch.length;
    }

    const baris = [
      KOLOM.map(([, judul]) => nilaiCsv(judul)).join(","),
      ...produk.map((item) =>
        KOLOM.map(([kunci]) => nilaiCsv(kunci === "aktif" ? (item[kunci] ? "Ya" : "Tidak") : item[kunci])).join(",")
      ),
    ];

    return new Response(`\uFEFF${baris.join("\r\n")}`, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="produk.csv"',
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Gagal mengekspor produk:", error?.message ?? error);
    return new Response("Daftar produk gagal diekspor. Coba lagi nanti.", {
      status: 500,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
}
