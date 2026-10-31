import KartuProduk from "@/components/KartuProduk";
import Tombol from "@/components/Tombol";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toko } from "@/lib/toko";

export default async function HalamanKatalog({ searchParams }) {
  const params = await searchParams;
  const pencarian = typeof params.q === "string" ? params.q.trim() : "";
  const kategoriAktif = typeof params.kategori === "string" ? params.kategori : "";
  let daftarProduk = [];
  let daftarKategori = [];
  let pesanError = "";

  try {
    const supabase = createSupabaseServerClient();
    let queryProduk = supabase.from("produk").select("*");
    const { data: kategoriData, error: errorKategori } = await supabase
      .from("produk")
      .select("kategori")
      .not("kategori", "is", null);

    if (errorKategori) {
      throw errorKategori;
    }

    daftarKategori = [...new Set((kategoriData ?? []).map((item) => item.kategori).filter(Boolean))].sort(
      (a, b) => a.localeCompare(b, "id")
    );

    if (kategoriAktif) {
      queryProduk = queryProduk.eq("kategori", kategoriAktif);
    }

    if (pencarian) {
      const teksPencarian = pencarian.replace(/[\\%_*]/g, "\\$&");
      queryProduk = queryProduk.ilike("nama", `%${teksPencarian}%`);
    }

    const { data, error } = await queryProduk;

    if (error) {
      throw error;
    }

    daftarProduk = data ?? [];
  } catch (error) {
    console.error("Gagal mengambil daftar produk dari Supabase:", error);
    pesanError =
      error instanceof Error && error.message.startsWith("Konfigurasi Supabase")
        ? error.message
        : "Produk gagal dimuat. Silakan coba lagi nanti.";
  }

  return (
    <>
      <section className="py-10 sm:py-14">
        <h1 className="max-w-2xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
          {toko.nama}
        </h1>
        <p className="mt-3 max-w-xl text-lg text-teks-lembut">{toko.tagline}</p>
        <p className="mt-4 text-sm text-teks-lembut">{toko.jamBuka}</p>
      </section>

      <section aria-labelledby="judul-produk" className="flex flex-col gap-5">
        <h2 id="judul-produk" className="text-xl font-bold">
          Produk kami
        </h2>
        <form action="/" method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1.5 text-sm font-semibold">
            Cari nama produk
            <input
              type="search"
              name="q"
              defaultValue={pencarian}
              placeholder="Contoh: kopi"
              className="w-full rounded-lg border border-garis bg-latar px-3 py-2.5 text-base text-teks placeholder:text-teks-lembut focus:border-utama focus:outline-none"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1.5 text-sm font-semibold">
            Kategori
            <select
              name="kategori"
              defaultValue={kategoriAktif}
              className="w-full rounded-lg border border-garis bg-latar px-3 py-2.5 text-base text-teks focus:border-utama focus:outline-none"
            >
              <option value="">Semua kategori</option>
              {daftarKategori.map((kategori) => (
                <option key={kategori} value={kategori}>
                  {kategori}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-3">
            <Tombol type="submit">Terapkan</Tombol>
            {pencarian || kategoriAktif ? (
              <a href="/" className="text-sm font-semibold text-utama hover:text-utama-gelap">
                Hapus filter
              </a>
            ) : null}
          </div>
        </form>
        {pesanError ? (
          <p role="alert" className="max-w-prose rounded-lg bg-harga-latar p-4 text-bahaya">
            {pesanError}
          </p>
        ) : daftarProduk.length === 0 ? (
          <p className="text-teks-lembut">
            {pencarian || kategoriAktif ? "Tidak ada produk yang cocok dengan filter." : "Belum ada produk"}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {daftarProduk.map((produk) => (
              <KartuProduk key={produk.id} produk={produk} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
