"use client";

import { useMemo } from "react";
import { formatRupiah } from "@/lib/format";
import { toko } from "@/lib/toko";
import { catatKlikWhatsApp } from "@/lib/catat-klik-whatsapp";
import { useKeranjang } from "@/components/KeranjangProvider";
import Tombol from "@/components/Tombol";

function hargaAktif(item) {
  return Number.isInteger(item.harga_diskon) && item.harga_diskon < item.harga
    ? item.harga_diskon
    : item.harga;
}

export default function HalamanKeranjang() {
  const { itemKeranjang, siap, ubahJumlah, hapus } = useKeranjang();
  const total = itemKeranjang.reduce((jumlah, item) => jumlah + hargaAktif(item) * item.jumlah, 0);
  const pesan = useMemo(() => {
    const rincian = itemKeranjang.map((item) => {
      const harga = hargaAktif(item);
      return `- ${item.nama} x${item.jumlah}: ${formatRupiah(harga)} x ${item.jumlah} = ${formatRupiah(harga * item.jumlah)}`;
    });
    return `Halo, saya ingin memesan:\n${rincian.join("\n")}\n\nTotal: ${formatRupiah(total)}.`;
  }, [itemKeranjang, total]);
  const tautanWhatsApp = `https://wa.me/${toko.nomorWhatsApp}?text=${encodeURIComponent(pesan)}`;

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
            {itemKeranjang.map((item) => (
              <li key={item.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-semibold">{item.nama}</h2>
                  <p className="text-sm text-teks-lembut">
                    {formatRupiah(hargaAktif(item))} per item
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
                      onChange={(event) => ubahJumlah(item.id, event.target.value)}
                      className="w-20 rounded-lg border border-garis bg-latar px-2 py-2 text-teks"
                    />
                  </label>
                  <p className="min-w-28 text-right font-bold">{formatRupiah(hargaAktif(item) * item.jumlah)}</p>
                  <button type="button" onClick={() => hapus(item.id)} className="text-sm font-semibold text-bahaya hover:underline">
                    Hapus
                  </button>
                </div>
              </li>
            ))}
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
