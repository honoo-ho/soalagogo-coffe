"use client";

import { useMemo } from "react";
import { formatRupiah } from "@/lib/format";
import { catatKlikWhatsApp } from "@/lib/catat-klik-whatsapp";
import { useKeranjang } from "@/components/KeranjangProvider";
import { usePengaturanToko } from "@/components/PengaturanTokoProvider";
import { toko } from "@/lib/toko";
import Tombol from "@/components/Tombol";
import {
  buatPesanKeranjang,
  hargaAktifItemKeranjang,
  kunciItemKeranjang,
  namaItemKeranjang,
  subtotalItemKeranjang,
  totalKeranjang,
} from "@/lib/keranjang.mjs";

export default function HalamanKeranjang() {
  const { itemKeranjang, siap, ubahJumlah, hapus } = useKeranjang();
  const pengaturanToko = usePengaturanToko();
  const total = totalKeranjang(itemKeranjang);
  const pesan = useMemo(() => buatPesanKeranjang(itemKeranjang, formatRupiah), [itemKeranjang]);
  const nomorWhatsApp = pengaturanToko?.nomorWhatsApp || toko.nomorWhatsApp;
  const tautanWhatsApp = `https://wa.me/${nomorWhatsApp}?text=${encodeURIComponent(pesan)}`;

  if (!siap) {
    return <section className="py-8"><h1 className="text-2xl font-extrabold">Keranjang</h1></section>;
  }

  return (
    <section className="flex flex-col gap-6 py-8">
      <h1 className="text-2xl font-extrabold">Keranjang</h1>
      {itemKeranjang.length === 0 ? (
        <p className="text-teks-lembut">Keranjang masih kosong.</p>
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-garis border-y border-garis">
            {itemKeranjang.map((item) => {
              const kunci = kunciItemKeranjang(item);
              return (
                <li key={kunci} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-semibold">{namaItemKeranjang(item)}</h2>
                    <p className="text-sm text-teks-lembut">
                      {formatRupiah(hargaAktifItemKeranjang(item))} per item
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm">
                      Jumlah
                      <input
                        type="number"
                        min="1"
                        max={item.stok ?? undefined}
                        value={item.jumlah}
                        onChange={(event) => ubahJumlah(kunci, event.target.value)}
                        className="w-20 rounded-lg border border-garis bg-latar px-2 py-2 text-teks"
                      />
                    </label>
                    <p className="min-w-28 text-right font-bold">{formatRupiah(subtotalItemKeranjang(item))}</p>
                    <button
                      type="button"
                      onClick={() => hapus(kunci)}
                      className="text-sm font-semibold text-bahaya hover:underline"
                    >
                      Hapus
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="self-end text-lg font-extrabold">Total: {formatRupiah(total)}</p>
          <a
            href={tautanWhatsApp}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => catatKlikWhatsApp(itemKeranjang.map((item) => item.id))}
            className="inline-flex self-start items-center justify-center rounded-lg bg-utama px-5 py-3 font-semibold text-white hover:bg-utama-gelap"
          >
            Pesan semua via WhatsApp
          </a>
          <Tombol href="/" varian="garis" className="self-start">Lanjut belanja</Tombol>
        </>
      )}
    </section>
  );
}
