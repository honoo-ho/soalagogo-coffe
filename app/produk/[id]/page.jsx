import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import KartuProduk from "@/components/KartuProduk";
import GaleriProduk from "@/components/GaleriProduk";
import PilihanVarianProduk from "@/components/PilihanVarianProduk";
import BagikanProduk from "@/components/BagikanProduk";
import TombolFavorit from "@/components/TombolFavorit";
import { ambilFotoProduk } from "@/lib/foto-produk";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logServerError } from "@/lib/log-error";
import { getSiteOrigin } from "@/lib/site-url";
import { ambilPengaturanToko } from "@/lib/pengaturan-toko";
import { CatatProdukDilihat } from "@/components/ProdukTerakhirDilihat";
import TombolBandingkan from "@/components/TombolBandingkan";
import FormUlasan from "@/components/FormUlasan";
import { createSupabasePublicServerClient } from "@/lib/supabase/public-server";
import { slugKategori } from "@/lib/slug-kategori";
import AsistenProduk from "@/components/AsistenProduk";

const ambilProduk = cache(async (id) => {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("produk")
    .select("*")
    .eq("id", id)
    .eq("aktif", true)
    .maybeSingle();

  if (error) throw error;
  return data;
});

export async function generateMetadata({ params }) {
  const { id } = await params;
  const produk = await ambilProduk(id);
  if (!produk) notFound();
  const pengaturanToko = await ambilPengaturanToko();

  const deskripsi = produk.deskripsi?.trim().replace(/\s+/g, " ").slice(0, 200)
    || `Lihat ${produk.nama} di ${pengaturanToko.nama}.`;
  const asal = await getSiteOrigin();
  const foto = ambilFotoProduk(produk.foto_url)[0];
  let urlFoto;

  if (foto) {
    try {
      const url = new URL(foto, asal);
      if (url.protocol === "http:" || url.protocol === "https:") {
        urlFoto = url.toString();
      }
    } catch {
      urlFoto = undefined;
    }
  }

  return {
    metadataBase: new URL(asal),
    title: `${produk.nama} | ${pengaturanToko.nama}`,
    description: deskripsi,
    openGraph: {
      title: produk.nama,
      description: deskripsi,
      type: "website",
      images: urlFoto ? [{ url: urlFoto, alt: `Foto ${produk.nama}` }] : [],
    },
  };
}

export default async function HalamanDetailProduk({ params }) {
  const { id } = await params;
  const produk = await ambilProduk(id);

  if (!produk) {
    notFound();
  }

  const supabase = createSupabaseServerClient();
  const supabasePublik = createSupabasePublicServerClient();
  const { data: ulasanData, error: errorUlasan } = await supabasePublik
    .from("ulasan")
    .select("id,nama,rating,komentar,created_at")
    .eq("produk_id", id)
    .eq("ditampilkan", true)
    .order("created_at", { ascending: false });

  if (errorUlasan) logServerError("Gagal mengambil ulasan produk:", errorUlasan);
  const ulasan = errorUlasan ? [] : ulasanData ?? [];
  const rataRataRating = ulasan.length
    ? ulasan.reduce((total, item) => total + item.rating, 0) / ulasan.length
    : null;

  const teksBadge = produk.badge === "baru" ? "Baru" : produk.badge === "terlaris" ? "Terlaris" : "";
  const { data: varianProduk, error: errorVarian } = await supabase
    .from("varian_produk")
    .select("id,nama,harga")
    .eq("produk_id", id)
    .order("id", { ascending: true });
  if (errorVarian) logServerError("Gagal mengambil varian produk:", errorVarian);
  const varian = errorVarian ? [] : varianProduk ?? [];

  let produkTerkait = [];
  if (produk.kategori) {
    const { data, error: errorTerkait } = await supabase
      .from("produk")
      .select("*")
      .eq("aktif", true)
      .eq("kategori", produk.kategori)
      .neq("id", id)
      .order("created_at", { ascending: false })
      .limit(4);

    if (errorTerkait) {
      logServerError("Gagal mengambil produk terkait:", errorTerkait);
    } else {
      produkTerkait = data ?? [];
    }
  }

  return (
    <>
      <CatatProdukDilihat produk={produk} />
      <article className="grid gap-8 py-8 md:grid-cols-2 md:py-12">
        <GaleriProduk nama={produk.nama} foto={ambilFotoProduk(produk.foto_url)} />
        <div className="flex flex-col gap-4">
          <Link href="/" className="text-sm text-teks-lembut underline underline-offset-4 hover:text-utama">
            Kembali ke katalog
          </Link>
          {produk.kategori ? (
            <Link href={`/kategori/${slugKategori(produk.kategori)}`} className="text-sm text-teks-lembut hover:text-utama hover:underline">
              {produk.kategori}
            </Link>
          ) : null}
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight">{produk.nama}</h1>
          {teksBadge ? (
            <p className="self-start rounded-md bg-utama px-3 py-1 text-sm font-bold text-white">
              {teksBadge}
            </p>
          ) : null}
          {produk.stok === 0 ? (
            <p className="self-start rounded-md bg-harga-latar px-3 py-1 text-sm font-bold text-bahaya">
              Habis
            </p>
          ) : null}
          <p className="max-w-prose leading-relaxed text-teks-lembut">{produk.deskripsi}</p>
          <TombolFavorit produk={produk} />
          <TombolBandingkan produk={produk} />
          <BagikanProduk namaProduk={produk.nama} />
          {produk.stok === 0 ? null : (
            <PilihanVarianProduk produk={produk} varian={varian} />
          )}
        </div>
      </article>
      <section aria-labelledby="judul-ulasan" className="grid gap-8 border-t border-garis py-8 md:grid-cols-2">
        <div className="flex flex-col gap-5">
          <div>
            <h2 id="judul-ulasan" className="text-2xl font-extrabold">Ulasan pembeli</h2>
            {rataRataRating === null ? (
              <p className="mt-2 text-teks-lembut">Belum ada ulasan untuk produk ini.</p>
            ) : (
              <p className="mt-2 text-teks-lembut">
                Rata-rata <span className="font-bold text-teks">{rataRataRating.toFixed(1)} dari 5</span>
                {" · "}{ulasan.length} ulasan
              </p>
            )}
          </div>
          {errorUlasan ? (
            <p role="status" className="text-sm text-teks-lembut">Ulasan belum dapat dimuat saat ini.</p>
          ) : ulasan.length > 0 ? (
            <ul className="flex flex-col gap-4">
              {ulasan.map((item) => (
                <li key={item.id} className="rounded-xl border border-garis bg-latar p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold">{item.nama}</p>
                    <p className="text-sm font-semibold text-harga" aria-label={`Rating ${item.rating} dari 5`}>
                      {"★".repeat(item.rating)}{"☆".repeat(5 - item.rating)}
                    </p>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-teks-lembut">{item.komentar}</p>
                  <time dateTime={item.created_at} className="mt-3 block text-xs text-teks-lembut">
                    {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(item.created_at))}
                  </time>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-xl font-bold">Tulis ulasan</h2>
            <p className="mt-1 text-sm text-teks-lembut">Bagikan pengalaman Anda dengan produk ini.</p>
          </div>
          <FormUlasan produkId={produk.id} />
        </div>
      </section>
      <AsistenProduk produkId={produk.id} />
      {produkTerkait.length > 0 ? (
        <section aria-labelledby="judul-produk-terkait" className="flex flex-col gap-5 pb-12">
          <h2 id="judul-produk-terkait" className="text-xl font-bold">
            Produk lain di kategori {produk.kategori}
          </h2>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            {produkTerkait.map((item) => (
              <KartuProduk key={item.id} produk={item} />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
