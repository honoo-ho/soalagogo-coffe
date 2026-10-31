"use client";

import { useState } from "react";
import Tombol from "@/components/Tombol";
import { usePerbandingan } from "@/components/PerbandinganProvider";

export default function TombolBandingkan({ produk }) {
  const { idProduk, siap, toggle } = usePerbandingan();
  const dipilih = idProduk.includes(String(produk.id));
  const [pesan, setPesan] = useState("");

  function ubahPilihan() {
    const hasil = toggle(produk.id);
    setPesan(
      hasil === "added"
        ? "Produk ditambahkan ke perbandingan."
        : hasil === "removed"
          ? "Produk dihapus dari perbandingan."
          : hasil === "limit"
            ? "Maksimal dua produk. Hapus salah satu pilihan terlebih dahulu."
            : "ID produk tidak valid."
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Tombol type="button" varian="garis" onClick={ubahPilihan} disabled={!siap} aria-pressed={dipilih}>
        {dipilih ? "Hapus dari perbandingan" : "Bandingkan produk"}
      </Tombol>
      {pesan ? <p role="status" className="text-sm text-teks-lembut">{pesan}</p> : null}
    </div>
  );
}
