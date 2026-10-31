import Link from "next/link";
import { notFound } from "next/navigation";
import { formatRupiah } from "@/lib/format";
import { ambilFotoProduk } from "@/lib/foto-produk";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function HalamanBandingkan({ searchParams }) {
  const params = await searchParams;
  const parameterId = params.id;
  const idProduk = Array.isArray(parameterId) ? parameterId : typeof parameterId === "string" ? [parameterId] : [];

  if (idProduk.length > 2) {
    return (
      <section className="flex flex-col items-start gap-4 py-12">
        <h1 className="text-2xl font-extrabold">Pilih maksimal dua produk</h1>
        <p className="text-teks-lembut">Kembali ke katalog dan hapus salah satu pilihan sebelum membandingkan produk lain.</p>
        <Link href="/" className="font-semibold text-utama hover:text-utama-gelap">Kembali ke katalog</Link>
      </section>
    );
  }

  if (idProduk.length < 2) {
    return (
      <section className="flex flex-col items-start gap-4 py-12">
        <h1 className="text-2xl font-extrabold">Bandingkan dua produk</h1>
        <p className="text-teks-lembut">Pilih dua produk dari halaman detail, lalu buka perbandingan dari navigasi.</p>
        <Link href="/" className="font-semibold text-utama hover:text-utama-gelap">Pilih produk</Link>
      </section>
    );
  }

  if (new Set(idProduk).size !== 2 || idProduk.some((id) => !/^\d+$/.test(id))) notFound();

  const supabase = createSupabaseServerClient();
  const { data: produk, error } = await supabase
    .from("produk")
    .select("id,nama,harga,harga_diskon,deskripsi,foto_url,kategori,aktif")
    .in("id", idProduk)
    .eq("aktif", true);

  if (error) throw error;
  if (!produk || produk.length !== 2) notFound();

  const daftarTerurut = idProduk.map((id) => produk.find((item) => String(item.id) === id));
  if (daftarTerurut.some((item) => !item)) notFound();

  return (
    <section className="flex flex-col gap-6 py-8">
      <div>
        <Link href="/" className="text-sm text-teks-lembut underline underline-offset-4 hover:text-utama">
          Kembali ke katalog
        </Link>
        <h1 className="mt-3 text-2xl font-extrabold">Perbandingan produk</h1>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {daftarTerurut.map((item) => {
          const hargaDiskonValid = Number.isInteger(item.harga_diskon) && item.harga_diskon < item.harga;
          const foto = ambilFotoProduk(item.foto_url)[0] ?? "";
          return (
            <article key={item.id} className="flex flex-col gap-4 rounded-2xl border border-garis bg-latar p-4">
              <Link href={`/produk/${item.id}`} className="self-start font-semibold text-utama hover:text-utama-gelap">
                Buka detail produk
              </Link>
              <img src={foto} alt={item.nama} className="aspect-square w-full rounded-xl bg-permukaan object-cover" />
              <h2 className="text-xl font-bold">{item.nama}</h2>
              <dl className="grid gap-3">
                <div>
                  <dt className="text-sm font-semibold text-teks-lembut">Kategori</dt>
                  <dd>{item.kategori || "Tanpa kategori"}</dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold text-teks-lembut">Harga</dt>
                  <dd>
                    {hargaDiskonValid ? (
                      <>
                        <span className="mr-2 text-sm text-teks-lembut line-through">{formatRupiah(item.harga)}</span>
                        <span className="font-bold text-harga">{formatRupiah(item.harga_diskon)}</span>
                      </>
                    ) : (
                      <span className="font-bold text-harga">{formatRupiah(item.harga)}</span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold text-teks-lembut">Deskripsi</dt>
                  <dd className="whitespace-pre-line">{item.deskripsi || "Belum ada deskripsi."}</dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>
    </section>
  );
}
