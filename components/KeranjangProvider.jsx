"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

const KUNCI_KERANJANG = "soalagogo-keranjang-v1";
const KeranjangContext = createContext(null);

function normalisasiItem(item) {
  if (!item || item.id == null || typeof item.nama !== "string") return null;
  const harga = Number(item.harga);
  const hargaDiskon = item.harga_diskon == null ? null : Number(item.harga_diskon);
  const stok = item.stok == null ? null : Number(item.stok);
  const stokValid = Number.isInteger(stok) && stok >= 0 ? stok : null;
  const jumlah = Number(item.jumlah);
  if (!Number.isFinite(harga) || harga < 0 || !Number.isInteger(jumlah) || jumlah < 1) return null;
  return {
    id: String(item.id),
    nama: item.nama,
    harga,
    harga_diskon: Number.isInteger(hargaDiskon) && hargaDiskon >= 0 ? hargaDiskon : null,
    stok: stokValid,
    jumlah: stokValid === 0 ? 0 : Math.min(jumlah, stokValid ?? jumlah),
  };
}

export function KeranjangProvider({ children }) {
  const [itemKeranjang, setItemKeranjang] = useState([]);
  const [siap, setSiap] = useState(false);

  useEffect(() => {
    try {
      const tersimpan = JSON.parse(window.localStorage.getItem(KUNCI_KERANJANG) ?? "[]");
      if (Array.isArray(tersimpan)) {
        setItemKeranjang(tersimpan.map(normalisasiItem).filter((item) => item && item.jumlah > 0));
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
    const itemBaru = normalisasiItem({ ...produk, jumlah });
    if (!itemBaru || itemBaru.jumlah === 0) return false;

    setItemKeranjang((saatIni) => {
      const ada = saatIni.find((item) => item.id === itemBaru.id);
      if (!ada) return [...saatIni, itemBaru];
      return saatIni.map((item) => {
        if (item.id !== itemBaru.id) return item;
        const stok = itemBaru.stok ?? item.stok;
        const jumlahGabung = item.jumlah + itemBaru.jumlah;
        return { ...itemBaru, jumlah: Math.min(jumlahGabung, stok ?? jumlahGabung) };
      });
    });
    return true;
  }

  function ubahJumlah(id, jumlah) {
    const nilai = Number(jumlah);
    if (!Number.isInteger(nilai) || nilai < 1) return;
    setItemKeranjang((saatIni) =>
      saatIni.map((item) =>
        item.id === String(id)
          ? { ...item, jumlah: Math.min(nilai, item.stok ?? nilai) }
          : item
      )
    );
  }

  function hapus(id) {
    setItemKeranjang((saatIni) => saatIni.filter((item) => item.id !== String(id)));
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
