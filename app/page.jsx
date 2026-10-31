import KartuProduk from "@/components/KartuProduk";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toko } from "@/lib/toko";

export default async function HalamanKatalog() {
  let daftarProduk = [];
  let pesanError = "";

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase.from("produk").select("*");

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
        {pesanError ? (
          <p role="alert" className="max-w-prose rounded-lg bg-harga-latar p-4 text-bahaya">
            {pesanError}
          </p>
        ) : daftarProduk.length === 0 ? (
          <p className="text-teks-lembut">Belum ada produk</p>
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
