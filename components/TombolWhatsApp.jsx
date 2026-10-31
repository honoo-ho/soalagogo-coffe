"use client";

import { useState } from "react";
import { formatRupiah } from "@/lib/format";
import { toko } from "@/lib/toko";

export default function TombolWhatsApp({ produk }) {
  const [jumlah, setJumlah] = useState(1);
  const hargaAktif =
    Number.isInteger(produk.harga_diskon) && produk.harga_diskon < produk.harga
      ? produk.harga_diskon
      : produk.harga;
  const totalHarga = hargaAktif * jumlah;
  const pesan = `Halo, saya ingin memesan ${produk.nama}. Jumlah: ${jumlah}. Harga satuan: ${formatRupiah(hargaAktif)}. Total: ${formatRupiah(totalHarga)}.`;
  const tautanWhatsApp = `https://wa.me/${toko.nomorWhatsApp}?text=${encodeURIComponent(pesan)}`;

  return (
    <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-end">
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        Jumlah
        <select
          value={jumlah}
          onChange={(event) => setJumlah(Number(event.target.value))}
          className="rounded-lg border border-garis bg-latar px-3 py-2.5 text-base text-teks focus:border-utama focus:outline-none"
        >
          {Array.from({ length: 20 }, (_, index) => index + 1).map((nilai) => (
            <option key={nilai} value={nilai}>
              {nilai}
            </option>
          ))}
        </select>
      </label>
      <a
        href={tautanWhatsApp}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-full items-center justify-center rounded-lg bg-utama px-5 py-3 font-semibold text-white hover:bg-utama-gelap sm:w-auto"
      >
        Pesan via WhatsApp
      </a>
    </div>
  );
}
