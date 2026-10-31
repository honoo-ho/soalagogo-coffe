"use client";

import { useState } from "react";
import Tombol from "@/components/Tombol";

export default function BagikanProduk({ namaProduk }) {
  const [pesan, setPesan] = useState("");

  async function salinLink(url) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      return;
    }

    const areaTeks = document.createElement("textarea");
    areaTeks.value = url;
    areaTeks.setAttribute("readonly", "");
    areaTeks.style.position = "fixed";
    areaTeks.style.opacity = "0";
    document.body.appendChild(areaTeks);
    areaTeks.select();
    const berhasil = document.execCommand("copy");
    document.body.removeChild(areaTeks);
    if (!berhasil) throw new Error("Clipboard tidak tersedia.");
  }

  async function bagikan() {
    const url = window.location.href;
    setPesan("");

    if (navigator.share) {
      try {
        await navigator.share({ title: namaProduk, url });
        setPesan("Link produk berhasil dibagikan.");
        return;
      } catch (error) {
        if (error?.name === "AbortError") return;
      }
    }

    try {
      await salinLink(url);
      setPesan("Link tersalin.");
    } catch {
      setPesan("Link gagal disalin. Salin alamat halaman dari browser.");
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Tombol type="button" varian="garis" onClick={bagikan}>
        Bagikan produk
      </Tombol>
      {pesan ? <p role="status" aria-live="polite" className="text-sm text-teks-lembut">{pesan}</p> : null}
    </div>
  );
}
