"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const KUNCI_PERBANDINGAN = "soalagogo-bandingkan-v1";
const BATAS_PERBANDINGAN = 2;
const PerbandinganContext = createContext(null);

function normalisasiId(id) {
  const nilai = String(id ?? "");
  return /^\d+$/.test(nilai) ? nilai : null;
}

export function PerbandinganProvider({ children }) {
  const [idProduk, setIdProduk] = useState([]);
  const [siap, setSiap] = useState(false);

  useEffect(() => {
    try {
      const tersimpan = JSON.parse(window.localStorage.getItem(KUNCI_PERBANDINGAN) ?? "[]");
      if (Array.isArray(tersimpan)) {
        setIdProduk([...new Set(tersimpan.map(normalisasiId).filter(Boolean))].slice(0, BATAS_PERBANDINGAN));
      }
    } catch {
      setIdProduk([]);
    }
    setSiap(true);
  }, []);

  useEffect(() => {
    if (!siap) return;
    try {
      window.localStorage.setItem(KUNCI_PERBANDINGAN, JSON.stringify(idProduk));
    } catch {
      // Pilihan tetap tersedia selama halaman ini terbuka jika penyimpanan browser penuh.
    }
  }, [idProduk, siap]);

  const toggle = useCallback((id) => {
    const idValid = normalisasiId(id);
    if (!idValid) return "invalid";

    if (idProduk.includes(idValid)) {
      setIdProduk((saatIni) => saatIni.filter((item) => item !== idValid));
      return "removed";
    }

    if (idProduk.length >= BATAS_PERBANDINGAN) return "limit";
    setIdProduk((saatIni) => {
      if (saatIni.includes(idValid) || saatIni.length >= BATAS_PERBANDINGAN) return saatIni;
      return [...saatIni, idValid];
    });
    return "added";
  }, [idProduk]);

  const nilai = useMemo(() => ({ idProduk, siap, toggle }), [idProduk, siap, toggle]);
  return <PerbandinganContext.Provider value={nilai}>{children}</PerbandinganContext.Provider>;
}

export function usePerbandingan() {
  const context = useContext(PerbandinganContext);
  if (!context) throw new Error("usePerbandingan harus digunakan di dalam PerbandinganProvider.");
  return context;
}
