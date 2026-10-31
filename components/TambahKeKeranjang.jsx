"use client";

import { useState } from "react";
import Tombol from "@/components/Tombol";
import { useKeranjang } from "@/components/KeranjangProvider";

export default function TambahKeKeranjang({ produk }) {
  const { tambah } = useKeranjang();
  const [pesan, setPesan] = useState("");

  function tambahkan() {
    const berhasil = tambah(produk);
    setPesan(berhasil ? "Ditambahkan ke keranjang." : "Produk ini sedang habis.");
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Tombol type="button" varian="garis" onClick={tambahkan} disabled={produk.stok === 0}>
        Tambah ke keranjang
      </Tombol>
      {pesan ? <p role="status" className="text-sm text-teks-lembut">{pesan}</p> : null}
    </div>
  );
}
