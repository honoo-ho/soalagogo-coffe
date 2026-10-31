"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

const KUNCI_FAVORIT = "soalagogo-favorit-v1";
const FavoritContext = createContext(null);

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

export function FavoritProvider({ children }) {
  const [produkFavorit, setProdukFavorit] = useState([]);
  const [siap, setSiap] = useState(false);

  useEffect(() => {
    try {
      const tersimpan = JSON.parse(window.localStorage.getItem(KUNCI_FAVORIT) ?? "[]");
      if (Array.isArray(tersimpan)) {
        setProdukFavorit(tersimpan.map(normalisasiProduk).filter(Boolean));
      }
    } catch {
      setProdukFavorit([]);
    }
    setSiap(true);
  }, []);

  useEffect(() => {
    if (!siap) return;
    try {
      window.localStorage.setItem(KUNCI_FAVORIT, JSON.stringify(produkFavorit));
    } catch {
      // Favorit tetap tersedia selama halaman ini terbuka jika penyimpanan browser penuh.
    }
  }, [produkFavorit, siap]);

  function toggle(produk) {
    const produkBaru = normalisasiProduk(produk);
    if (!produkBaru) return false;
    const sudahAda = produkFavorit.some((item) => item.id === produkBaru.id);

    setProdukFavorit((saatIni) => {
      const sudahAda = saatIni.some((item) => item.id === produkBaru.id);
      return sudahAda
        ? saatIni.filter((item) => item.id !== produkBaru.id)
        : [...saatIni, produkBaru];
    });

    return !sudahAda;
  }

  function hapus(id) {
    setProdukFavorit((saatIni) => saatIni.filter((item) => item.id !== String(id)));
  }

  const nilai = useMemo(
    () => ({ produkFavorit, siap, toggle, hapus }),
    [produkFavorit, siap]
  );

  return <FavoritContext.Provider value={nilai}>{children}</FavoritContext.Provider>;
}

export function useFavorit() {
  const context = useContext(FavoritContext);
  if (!context) throw new Error("useFavorit harus digunakan di dalam FavoritProvider.");
  return context;
}
