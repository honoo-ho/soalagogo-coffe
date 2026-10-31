"use client";

import Link from "next/link";
import { useFavorit } from "@/components/FavoritProvider";

export default function TautanFavorit() {
  const { produkFavorit, siap } = useFavorit();

  return (
    <Link href="/favorit" className="text-sm font-semibold text-utama hover:text-utama-gelap">
      Favorit ({siap ? produkFavorit.length : 0})
    </Link>
  );
}
