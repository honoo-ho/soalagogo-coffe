"use client";

import { useState } from "react";
import { formatRupiah } from "@/lib/format";
import TombolWhatsApp from "@/components/TombolWhatsApp";
import TambahKeKeranjang from "@/components/TambahKeKeranjang";

export default function PilihanVarianProduk({ produk, varian = [] }) {
  const [varianId, setVarianId] = useState(varian[0]?.id ? String(varian[0].id) : "");
  const varianDipilih = varian.find((item) => String(item.id) === varianId) ?? null;
  const hargaAktif = varianDipilih?.harga ?? (
    Number.isInteger(produk.harga_diskon) && produk.harga_diskon < produk.harga
      ? produk.harga_diskon
      : produk.harga
  );
  const produkUntukKeranjang = varianDipilih
    ? { ...produk, harga: varianDipilih.harga, harga_diskon: null, nama: `${produk.nama} (${varianDipilih.nama})` }
    : produk;

  return (
    <div className="flex flex-col items-start gap-4">
      {varian.length > 0 ? (
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Pilih ukuran
          <select
            value={varianId}
            onChange={(event) => setVarianId(event.target.value)}
            className="rounded-lg border border-garis bg-latar px-3 py-2.5 text-base text-teks focus:border-utama focus:outline-none"
          >
            {varian.map((item) => (
              <option key={item.id} value={item.id}>{item.nama} — {formatRupiah(item.harga)}</option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="self-start">
        {!varianDipilih && Number.isInteger(produk.harga_diskon) && produk.harga_diskon < produk.harga ? (
          <p className="text-sm text-teks-lembut line-through">{formatRupiah(produk.harga)}</p>
        ) : null}
        <p className="rounded-md bg-harga-latar px-3 py-1 text-xl font-bold text-harga">
          {formatRupiah(hargaAktif)}
        </p>
      </div>
      <TombolWhatsApp produk={produk} varian={varianDipilih} />
      <TambahKeKeranjang produk={produkUntukKeranjang} />
    </div>
  );
}
