"use client";

import { useState } from "react";

export default function GaleriProduk({ nama, foto }) {
  const [fotoAktif, setFotoAktif] = useState(0);
  const fotoUtama = foto[fotoAktif] ?? foto[0] ?? "";

  return (
    <div className="flex flex-col gap-3">
      <img
        src={fotoUtama}
        alt={nama}
        className="aspect-square w-full rounded-2xl border border-garis bg-permukaan object-cover"
      />
      {foto.length > 1 ? (
        <div role="group" aria-label={`Galeri foto ${nama}`} className="flex flex-wrap gap-2">
          {foto.map((url, index) => (
            <button
              key={`${url}-${index}`}
              type="button"
              onClick={() => setFotoAktif(index)}
              aria-label={`Tampilkan foto ${index + 1} ${nama}`}
              aria-pressed={fotoAktif === index}
              className={`overflow-hidden rounded-lg border ${fotoAktif === index ? "border-utama" : "border-garis"}`}
            >
              <img src={url} alt="" className="h-16 w-16 object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
