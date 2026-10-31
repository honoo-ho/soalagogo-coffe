"use client";

import { useEffect, useState } from "react";

const KUNCI_TEMA = "soalagogo-tema-v1";

export default function TombolTema() {
  const [temaGelap, setTemaGelap] = useState(false);

  useEffect(() => {
    let gelap = false;
    try {
      gelap = window.localStorage.getItem(KUNCI_TEMA) === "gelap";
    } catch {
      gelap = document.documentElement.dataset.theme === "gelap";
    }
    setTemaGelap(gelap);
    document.documentElement.dataset.theme = gelap ? "gelap" : "terang";
  }, []);

  function gantiTema() {
    const temaBerikutnya = temaGelap ? "terang" : "gelap";
    setTemaGelap(temaBerikutnya === "gelap");
    document.documentElement.dataset.theme = temaBerikutnya;
    try {
      window.localStorage.setItem(KUNCI_TEMA, temaBerikutnya);
    } catch {
      // Tema tetap berubah selama halaman terbuka jika penyimpanan browser tidak tersedia.
    }
  }

  return (
    <button
      type="button"
      onClick={gantiTema}
      aria-label={`Aktifkan mode ${temaGelap ? "terang" : "gelap"}`}
      className="rounded-lg border border-garis px-2.5 py-2 text-xs font-semibold text-teks hover:border-utama hover:text-utama sm:text-sm"
    >
      {temaGelap ? "Terang" : "Gelap"}
    </button>
  );
}
