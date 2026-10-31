"use client";

import { useState } from "react";
import Tombol from "@/components/Tombol";
import { useFavorit } from "@/components/FavoritProvider";

export default function TombolFavorit({ produk }) {
  const { produkFavorit, siap, toggle } = useFavorit();
  const sudahFavorit = produkFavorit.some((item) => item.id === String(produk.id));
  const [pesan, setPesan] = useState("");

  function ubahFavorit() {
    const ditambahkan = toggle(produk);
    setPesan(ditambahkan ? "Ditambahkan ke favorit." : "Dihapus dari favorit.");
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Tombol type="button" varian="garis" onClick={ubahFavorit} disabled={!siap} aria-pressed={sudahFavorit}>
        {sudahFavorit ? "Hapus dari favorit" : "Tambah ke favorit"}
      </Tombol>
      {pesan ? <p role="status" className="text-sm text-teks-lembut">{pesan}</p> : null}
    </div>
  );
}
