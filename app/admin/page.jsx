import NavAdmin from "@/components/NavAdmin";
import TabelProduk from "@/components/TabelProduk";
import Tombol from "@/components/Tombol";
import { createSupabaseSessionClient } from "@/lib/supabase/session";

const UKURAN_BATCH = 1000;

export default async function HalamanAdmin({ searchParams }) {
  const { error: statusError, status } = await searchParams;
  let daftarProduk = [];
  let jumlahProduk = 0;
  let kategoriProduk = [];
  let errorQuery = null;

  try {
    const supabase = await createSupabaseSessionClient();
    let hasil = await supabase
      .from("produk")
      .select("*", { count: "exact" })
      .order("id", { ascending: true })
      .range(0, UKURAN_BATCH - 1);

    if (hasil.error) throw hasil.error;
    const jumlahTepat = hasil.count;
    jumlahProduk = jumlahTepat ?? 0;

    let awal = 0;
    while (true) {
      const batch = hasil.data ?? [];
      if (batch.length === 0) break;
      daftarProduk.push(...batch);
      awal += batch.length;

      if (jumlahTepat !== null && jumlahTepat !== undefined) {
        if (awal >= jumlahTepat) break;
      } else if (batch.length < UKURAN_BATCH) {
        break;
      }

      hasil = await supabase
        .from("produk")
        .select("*")
        .order("id", { ascending: true })
        .range(awal, awal + UKURAN_BATCH - 1);

      if (hasil.error) throw hasil.error;
    }

    if (jumlahTepat === null || jumlahTepat === undefined) {
      jumlahProduk = daftarProduk.length;
    }

    const hitungKategori = new Map();
    for (const produk of daftarProduk) {
      const kategori = produk.kategori?.trim() || "Tanpa kategori";
      hitungKategori.set(kategori, (hitungKategori.get(kategori) ?? 0) + 1);
    }
    kategoriProduk = [...hitungKategori.entries()].sort(([a], [b]) => a.localeCompare(b, "id"));
  } catch (error) {
    console.error("Gagal mengambil ringkasan produk admin:", error?.message ?? error);
    errorQuery = error;
    daftarProduk = [];
    jumlahProduk = 0;
    kategoriProduk = [];
  }

  return (
    <div className="flex flex-col gap-6 py-8">
      <NavAdmin />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Produk</h1>
        {/* US-08 (bonus): tambah produk */}
        <Tombol href="/admin/produk/baru">Tambah produk</Tombol>
      </div>
      {statusError ? (
        <p role="alert" className="text-sm text-bahaya">
          {statusError === "not_found"
            ? "Produk tidak ditemukan atau sudah dihapus."
            : statusError === "invalid_id"
              ? "ID produk tidak valid."
              : statusError === "status_conflict"
                ? "Status produk baru saja berubah. Muat ulang halaman sebelum mencoba lagi."
                : statusError === "status_failed"
                  ? "Status produk gagal diubah. Muat ulang halaman dan coba lagi."
                  : "Produk gagal dihapus. Muat ulang halaman dan coba lagi."}
        </p>
      ) : null}
      {status === "status_updated" ? (
        <p role="status" className="text-sm text-utama">Status produk berhasil diperbarui.</p>
      ) : null}
      {errorQuery ? (
        <p role="alert" className="text-bahaya">
          Ringkasan produk gagal dimuat. Periksa koneksi database lalu muat ulang halaman.
        </p>
      ) : (
        <>
          <section aria-labelledby="judul-ringkasan" className="flex flex-col gap-4">
            <h2 id="judul-ringkasan" className="text-xl font-bold">Ringkasan toko</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <article className="rounded-xl border border-garis bg-permukaan p-4">
                <p className="text-sm text-teks-lembut">Jumlah produk</p>
                <p className="mt-1 text-2xl font-extrabold">{jumlahProduk}</p>
              </article>
              {kategoriProduk.map(([kategori, jumlah]) => (
                <article key={kategori} className="rounded-xl border border-garis bg-permukaan p-4">
                  <p className="text-sm text-teks-lembut">{kategori}</p>
                  <p className="mt-1 text-2xl font-extrabold">{jumlah}</p>
                  <p className="text-xs text-teks-lembut">produk</p>
                </article>
              ))}
            </div>
          </section>
          <section aria-labelledby="judul-daftar-produk" className="flex flex-col gap-4">
            <h2 id="judul-daftar-produk" className="text-xl font-bold">Daftar produk</h2>
            {daftarProduk.length === 0 ? (
              <p className="text-teks-lembut">Belum ada produk.</p>
            ) : (
              <TabelProduk daftarProduk={daftarProduk} />
            )}
          </section>
        </>
      )}
    </div>
  );
}
