"use client";

import KartuProduk from "@/components/KartuProduk";
import { useFavorit } from "@/components/FavoritProvider";

export default function HalamanFavorit() {
  const { produkFavorit, siap, hapus } = useFavorit();

  return (
    <section className="flex flex-col gap-5 py-8">
      <h1 className="text-2xl font-extrabold">Produk favorit</h1>
      {!siap ? (
        <p className="text-teks-lembut">Memuat favorit...</p>
      ) : produkFavorit.length === 0 ? (
        <p className="text-teks-lembut">Belum ada produk favorit.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {produkFavorit.map((produk) => (
            <div key={produk.id} className="flex flex-col gap-2">
              <KartuProduk produk={produk} />
              <button
                type="button"
                onClick={() => hapus(produk.id)}
                className="self-start text-sm font-semibold text-bahaya hover:underline"
              >
                Hapus dari favorit
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
