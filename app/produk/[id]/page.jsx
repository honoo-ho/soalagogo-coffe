import { cache } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import KartuProduk from "@/components/KartuProduk";
import GaleriProduk from "@/components/GaleriProduk";
import TombolWhatsApp from "@/components/TombolWhatsApp";
import TambahKeKeranjang from "@/components/TambahKeKeranjang";
import BagikanProduk from "@/components/BagikanProduk";
import TombolFavorit from "@/components/TombolFavorit";
import { formatRupiah } from "@/lib/format";
import { ambilFotoProduk } from "@/lib/foto-produk";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toko } from "@/lib/toko";

const ambilProduk = cache(async (id) => {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("produk")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data;
});

function buatUrlAsal(headerRequest) {
  const host = (headerRequest.get("x-forwarded-host") || headerRequest.get("host") || "localhost:3000")
    .split(",")[0]
    .trim();
  const protoDiteruskan = headerRequest.get("x-forwarded-proto")?.split(",")[0].trim();
  const protokol = protoDiteruskan === "http" || host.startsWith("localhost") ? "http" : "https";

  try {
    return new URL(`${protokol}://${host}`).origin;
  } catch {
    return "http://localhost:3000";
  }
}

export async function generateMetadata({ params }) {
  const { id } = await params;
  const produk = await ambilProduk(id);
  if (!produk) notFound();

  const deskripsi = produk.deskripsi?.trim().replace(/\s+/g, " ").slice(0, 200)
    || `Lihat ${produk.nama} di ${toko.nama}.`;
  const headerRequest = await headers();
  const asal = buatUrlAsal(headerRequest);
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
    title: `${produk.nama} | ${toko.nama}`,
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

  const adaDiskon = Number.isInteger(produk.harga_diskon) && produk.harga_diskon < produk.harga;
  const teksBadge = produk.badge === "baru" ? "Baru" : produk.badge === "terlaris" ? "Terlaris" : "";

  let produkTerkait = [];
  if (produk.kategori) {
    const { data, error: errorTerkait } = await supabase
      .from("produk")
      .select("*")
      .eq("kategori", produk.kategori)
      .neq("id", id)
      .order("created_at", { ascending: false })
      .limit(4);

    if (errorTerkait) {
      console.error("Gagal mengambil produk terkait:", errorTerkait.message);
    } else {
      produkTerkait = data ?? [];
    }
  }

  return (
    <>
      <article className="grid gap-8 py-8 md:grid-cols-2 md:py-12">
        <GaleriProduk nama={produk.nama} foto={ambilFotoProduk(produk.foto_url)} />
        <div className="flex flex-col gap-4">
          <Link href="/" className="text-sm text-teks-lembut underline underline-offset-4 hover:text-utama">
            Kembali ke katalog
          </Link>
          <p className="text-sm text-teks-lembut">{produk.kategori}</p>
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight">{produk.nama}</h1>
          {teksBadge ? (
            <p className="self-start rounded-md bg-utama px-3 py-1 text-sm font-bold text-white">
              {teksBadge}
            </p>
          ) : null}
          <div className="self-start">
            {adaDiskon ? (
              <p className="text-sm text-teks-lembut line-through">{formatRupiah(produk.harga)}</p>
            ) : null}
            <p className="rounded-md bg-harga-latar px-3 py-1 text-xl font-bold text-harga">
              {formatRupiah(adaDiskon ? produk.harga_diskon : produk.harga)}
            </p>
          </div>
          {produk.stok === 0 ? (
            <p className="self-start rounded-md bg-harga-latar px-3 py-1 text-sm font-bold text-bahaya">
              Habis
            </p>
          ) : null}
          <p className="max-w-prose leading-relaxed text-teks-lembut">{produk.deskripsi}</p>
          <TombolFavorit produk={produk} />
          <BagikanProduk namaProduk={produk.nama} />
          {produk.stok === 0 ? null : (
            <>
              <TombolWhatsApp produk={produk} />
              <TambahKeKeranjang produk={produk} />
            </>
          )}
        </div>
      </article>
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
