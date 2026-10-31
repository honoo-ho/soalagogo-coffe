import Link from "next/link";
import { toko } from "@/lib/toko";
import TautanKeranjang from "@/components/TautanKeranjang";
import TautanFavorit from "@/components/TautanFavorit";
import TombolTema from "@/components/TombolTema";
import TautanPerbandingan from "@/components/TautanPerbandingan";

export default function Header() {
  return (
    <header className="border-b border-garis bg-latar">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-extrabold tracking-tight text-utama">
          {toko.nama}
        </Link>
        <nav aria-label="Navigasi utama" className="flex items-center gap-2 sm:gap-4">
          <Link href="/tentang" className="text-sm font-semibold text-teks hover:text-utama">
            Tentang
          </Link>
          <TautanFavorit />
          <TautanPerbandingan />
          <TautanKeranjang />
          <TombolTema />
        </nav>
      </div>
    </header>
  );
}
