import { notFound } from "next/navigation";
import KartuProduk from "@/components/KartuProduk";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { slugKategori } from "@/lib/slug-kategori";

export default async function HalamanKategori({ params }) {
  const { slug } = await params;
  const supabase = createSupabaseServerClient();
  const { data: daftarKategori, error: errorKategori } = await supabase
    .from("kategori")
    .select("nama")
    .order("nama", { ascending: true });

  if (errorKategori) throw errorKategori;
  const kategori = (daftarKategori ?? []).find((item) => slugKategori(item.nama) === slug);
  if (!kategori) notFound();

  const { data: produk, error } = await supabase
    .from("produk")
    .select("*")
    .eq("kategori", kategori.nama)
    .eq("aktif", true)
    .order("urutan", { ascending: true })
    .order("id", { ascending: true });

  if (error) throw error;

  return (
    <section className="flex flex-col gap-5 py-8">
      <div>
        <h1 className="text-3xl font-extrabold">{kategori.nama}</h1>
        <p className="mt-2 text-teks-lembut">Produk dalam kategori {kategori.nama}.</p>
      </div>
      {produk?.length ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {produk.map((item) => <KartuProduk key={item.id} produk={item} />)}
        </div>
      ) : (
        <p className="text-teks-lembut">Belum ada produk dalam kategori ini.</p>
      )}
    </section>
  );
}
