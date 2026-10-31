"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import KartuProduk from "@/components/KartuProduk";

const KUNCI_TERAKHIR_DILIHAT = "soalagogo-terakhir-dilihat-v1";
const BATAS_TERAKHIR_DILIHAT = 6;
const TerakhirDilihatContext = createContext(null);

function normalisasiProduk(produk) {
  if (!produk || produk.id == null || typeof produk.nama !== "string") return null;
  const harga = Number(produk.harga);
  if (!Number.isFinite(harga) || harga < 0) return null;

  const hargaDiskon = produk.harga_diskon == null ? null : Number(produk.harga_diskon);
  const stok = produk.stok == null ? null : Number(produk.stok);
  return {
    id: String(produk.id),
    nama: produk.nama,
    harga,
    harga_diskon: Number.isInteger(hargaDiskon) && hargaDiskon >= 0 ? hargaDiskon : null,
    badge: ["baru", "terlaris"].includes(produk.badge) ? produk.badge : null,
    foto_url: typeof produk.foto_url === "string" ? produk.foto_url : null,
    kategori: typeof produk.kategori === "string" ? produk.kategori : null,
    stok: Number.isInteger(stok) && stok >= 0 ? stok : null,
  };
}

export function ProdukTerakhirDilihatProvider({ children }) {
  const [daftar, setDaftar] = useState([]);
  const [siap, setSiap] = useState(false);

  useEffect(() => {
    try {
      const tersimpan = JSON.parse(window.localStorage.getItem(KUNCI_TERAKHIR_DILIHAT) ?? "[]");
      if (Array.isArray(tersimpan)) {
        setDaftar(tersimpan.map(normalisasiProduk).filter(Boolean).slice(0, BATAS_TERAKHIR_DILIHAT));
      }
    } catch {
      setDaftar([]);
    }
    setSiap(true);
  }, []);

  useEffect(() => {
    if (!siap) return;
    try {
      window.localStorage.setItem(KUNCI_TERAKHIR_DILIHAT, JSON.stringify(daftar));
    } catch {
      // Daftar tetap tersedia selama halaman ini terbuka jika penyimpanan browser penuh.
    }
  }, [daftar, siap]);

  const catat = useCallback((produk) => {
    const produkBaru = normalisasiProduk(produk);
    if (!produkBaru) return;
    setDaftar((saatIni) => [produkBaru, ...saatIni.filter((item) => item.id !== produkBaru.id)]
      .slice(0, BATAS_TERAKHIR_DILIHAT));
  }, []);

  const nilai = useMemo(() => ({ daftar, siap, catat }), [daftar, siap, catat]);
  return <TerakhirDilihatContext.Provider value={nilai}>{children}</TerakhirDilihatContext.Provider>;
}

export function CatatProdukDilihat({ produk }) {
  const context = useContext(TerakhirDilihatContext);
  if (!context) throw new Error("CatatProdukDilihat harus digunakan di dalam provider-nya.");
  const { catat } = context;
  const dataProduk = useMemo(
    () => ({
      id: produk.id,
      nama: produk.nama,
      harga: produk.harga,
      harga_diskon: produk.harga_diskon,
      badge: produk.badge,
      foto_url: produk.foto_url,
      kategori: produk.kategori,
      stok: produk.stok,
    }),
    [produk.id, produk.nama, produk.harga, produk.harga_diskon, produk.badge, produk.foto_url, produk.kategori, produk.stok]
  );

  useEffect(() => {
    catat(dataProduk);
  }, [catat, dataProduk]);

  return null;
}

export function BagianTerakhirDilihat() {
  const context = useContext(TerakhirDilihatContext);
  if (!context) throw new Error("BagianTerakhirDilihat harus digunakan di dalam provider-nya.");
  const { daftar, siap } = context;

  if (!siap || daftar.length === 0) return null;

  return (
    <section aria-labelledby="judul-terakhir-dilihat" className="flex flex-col gap-5 py-8">
      <h2 id="judul-terakhir-dilihat" className="text-xl font-bold">Terakhir dilihat</h2>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {daftar.map((produk) => <KartuProduk key={produk.id} produk={produk} />)}
      </div>
    </section>
  );
}
