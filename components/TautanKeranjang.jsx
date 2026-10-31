"use client";

import Link from "next/link";
import { useKeranjang } from "@/components/KeranjangProvider";

export default function TautanKeranjang() {
  const { itemKeranjang, siap } = useKeranjang();
  const jumlah = itemKeranjang.reduce((total, item) => total + item.jumlah, 0);

  return (
    <Link href="/keranjang" className="text-sm font-semibold text-utama hover:text-utama-gelap">
      Keranjang ({siap ? jumlah : 0})
    </Link>
  );
}
