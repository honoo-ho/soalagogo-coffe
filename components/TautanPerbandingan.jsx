"use client";

import Link from "next/link";
import { usePerbandingan } from "@/components/PerbandinganProvider";

export default function TautanPerbandingan() {
  const { idProduk, siap } = usePerbandingan();
  if (!siap || idProduk.length === 0) return null;

  const query = new URLSearchParams();
  for (const id of idProduk) query.append("id", id);

  return (
    <Link href={`/bandingkan?${query.toString()}`} className="text-sm font-semibold text-teks hover:text-utama">
      Bandingkan ({idProduk.length}/2)
    </Link>
  );
}
