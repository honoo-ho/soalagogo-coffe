import NavAdmin from "@/components/NavAdmin";
import TabelProduk from "@/components/TabelProduk";
import Tombol from "@/components/Tombol";
import { createSupabaseSessionClient } from "@/lib/supabase/session";

export default async function HalamanAdmin() {
  const supabase = await createSupabaseSessionClient();
  const { data, error } = await supabase.from("produk").select("*");
  const daftarProduk = data ?? [];

  if (error) {
    console.error("Gagal mengambil daftar produk admin:", error.message);
  }

  return (
    <div className="flex flex-col gap-6 py-8">
      <NavAdmin />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Produk</h1>
        {/* US-08 (bonus): tambah produk */}
        <Tombol href="/admin/produk/baru">Tambah produk</Tombol>
      </div>
      {error ? (
        <p role="alert" className="text-bahaya">
          Daftar produk gagal dimuat. Silakan muat ulang halaman atau coba lagi nanti.
        </p>
      ) : daftarProduk.length === 0 ? (
        <p className="text-teks-lembut">Belum ada produk.</p>
      ) : (
        <TabelProduk daftarProduk={daftarProduk} />
      )}
    </div>
  );
}
