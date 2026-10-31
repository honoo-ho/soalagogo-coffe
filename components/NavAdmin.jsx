import Link from "next/link";
import { keluarAdmin } from "@/app/admin/actions";

export default function NavAdmin() {
  return (
    <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-garis pb-4 text-sm">
      <Link href="/admin" className="font-semibold hover:text-utama">
        Produk
      </Link>
      <Link href="/admin/kategori" className="font-semibold hover:text-utama">
        Kategori
      </Link>
      <Link href="/admin/ulasan" className="font-semibold hover:text-utama">
        Ulasan
      </Link>
      <Link href="/admin/banner" className="font-semibold hover:text-utama">
        Banner promo
      </Link>
      <Link href="/admin/pengaturan" className="font-semibold hover:text-utama">
        Pengaturan toko
      </Link>
      <Link href="/admin/password" className="font-semibold hover:text-utama">
        Ganti password
      </Link>
      <form action={keluarAdmin} className="ml-auto">
        <button type="submit" className="text-teks-lembut hover:text-bahaya">
          Keluar
        </button>
      </form>
    </nav>
  );
}
