import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSiteOrigin } from "@/lib/site-url";

const UKURAN_BATCH = 1000;

export default async function sitemap() {
  const supabase = createSupabaseServerClient();
  const produk = [];
  const { count, error: errorJumlah } = await supabase
    .from("produk")
    .select("id", { count: "exact", head: true })
    .eq("aktif", true);

  if (errorJumlah) throw errorJumlah;

  let awal = 0;

  while (awal < (count ?? 0)) {
    const { data, error } = await supabase
      .from("produk")
      .select("id")
      .eq("aktif", true)
      .order("id", { ascending: true })
      .range(awal, awal + UKURAN_BATCH - 1);

    if (error) throw error;
    if (!data?.length) break;
    produk.push(...data);
    awal += data.length;
  }

  const asal = await getSiteOrigin();
  return [
    {
      url: asal,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${asal}/tentang`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    ...produk.map((item) => ({
      url: `${asal}/produk/${encodeURIComponent(item.id)}`,
      changeFrequency: "weekly",
      priority: 0.8,
    })),
  ];
}
