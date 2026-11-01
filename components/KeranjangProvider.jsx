"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  hapusItemKeranjang,
  kunciItemKeranjang,
  normalisasiItemKeranjang,
  tambahItemKeranjang,
  ubahJumlahItemKeranjang,
} from "@/lib/keranjang.mjs";

const KUNCI_KERANJANG = "soalagogo-keranjang-v1";
const KeranjangContext = createContext(null);

export function KeranjangProvider({ children }) {
  const [itemKeranjang, setItemKeranjang] = useState([]);
  const [siap, setSiap] = useState(false);

  useEffect(() => {
    try {
      const tersimpan = JSON.parse(window.localStorage.getItem(KUNCI_KERANJANG) ?? "[]");
      if (Array.isArray(tersimpan)) {
        const itemTervalidasi = tersimpan
          .map(normalisasiItemKeranjang)
          .filter((item) => item && item.jumlah > 0);

        const itemUnik = itemTervalidasi.reduce((daftar, item) => {
          const kunci = kunciItemKeranjang(item);
          const indexAda = daftar.findIndex((d) => kunciItemKeranjang(d) === kunci);
          if (indexAda !== -1) {
            const saatIni = daftar[indexAda];
            const stok = item.stok ?? saatIni.stok;
            const jumlahGabung = saatIni.jumlah + item.jumlah;
            daftar[indexAda] = {
              ...saatIni,
              stok,
              jumlah: Math.min(jumlahGabung, stok ?? jumlahGabung),
            };
            return daftar;
          }
          return [...daftar, item];
        }, []);

        setItemKeranjang(itemUnik);
      }
    } catch {
      setItemKeranjang([]);
    }
    setSiap(true);
  }, []);

  useEffect(() => {
    if (siap) window.localStorage.setItem(KUNCI_KERANJANG, JSON.stringify(itemKeranjang));
  }, [itemKeranjang, siap]);

  function tambah(produk, jumlah = 1) {
    const itemBaru = normalisasiItemKeranjang({ ...produk, jumlah });
    if (!itemBaru || itemBaru.jumlah === 0) return false;

    setItemKeranjang((saatIni) => tambahItemKeranjang(saatIni, itemBaru, itemBaru.jumlah));
    return true;
  }

  function ubahJumlah(kunci, jumlah) {
    setItemKeranjang((saatIni) => ubahJumlahItemKeranjang(saatIni, kunci, jumlah));
  }

  function hapus(kunci) {
    setItemKeranjang((saatIni) => hapusItemKeranjang(saatIni, kunci));
  }

  const nilai = useMemo(
    () => ({ itemKeranjang, siap, tambah, ubahJumlah, hapus }),
    [itemKeranjang, siap]
  );

  return <KeranjangContext.Provider value={nilai}>{children}</KeranjangContext.Provider>;
}

export function useKeranjang() {
  const context = useContext(KeranjangContext);
  if (!context) throw new Error("useKeranjang harus digunakan di dalam KeranjangProvider.");
  return context;
}
