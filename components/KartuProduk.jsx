import Link from "next/link";
import { formatRupiah } from "@/lib/format";
import { ambilFotoProduk } from "@/lib/foto-produk";

export default function KartuProduk({ produk }) {
  const fotoUtama = ambilFotoProduk(produk.foto_url)[0] ?? "";
  const adaDiskon = Number.isInteger(produk.harga_diskon) && produk.harga_diskon < produk.harga;
  const teksBadge = produk.badge === "baru" ? "Baru" : produk.badge === "terlaris" ? "Terlaris" : "";

  return (
    <Link
      href={`/produk/${produk.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-garis bg-latar"
    >
      <img
        src={fotoUtama}
        alt={produk.nama}
        className="aspect-square w-full bg-permukaan object-cover"
      />
      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="text-xs text-teks-lembut">{produk.kategori}</p>
        <h3 className="font-semibold leading-snug group-hover:text-utama">{produk.nama}</h3>
        {teksBadge ? (
          <p className="self-start rounded-md bg-utama px-2 py-0.5 text-xs font-bold text-white">
            {teksBadge}
          </p>
        ) : null}
        {produk.stok === 0 ? (
          <p className="self-start rounded-md bg-harga-latar px-2 py-0.5 text-xs font-bold text-bahaya">
            Habis
          </p>
        ) : null}
        <div className="mt-auto self-start">
          {adaDiskon ? (
            <p className="text-xs text-teks-lembut line-through">{formatRupiah(produk.harga)}</p>
          ) : null}
          <p className="rounded-md bg-harga-latar px-2 py-0.5 text-sm font-bold text-harga">
            {formatRupiah(adaDiskon ? produk.harga_diskon : produk.harga)}
          </p>
        </div>
      </div>
    </Link>
  );
}
