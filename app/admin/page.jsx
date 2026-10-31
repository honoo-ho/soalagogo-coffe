import Link from "next/link";
import NavAdmin from "@/components/NavAdmin";
import TabelProduk from "@/components/TabelProduk";
import Tombol from "@/components/Tombol";
import { createSupabaseSessionClient } from "@/lib/supabase/session";

const UKURAN_BATCH = 1000;
const UKURAN_HALAMAN = 20;

export default async function HalamanAdmin({ searchParams }) {
  const params = await searchParams;
  const kataKunci = typeof params.q === "string" ? params.q.trim() : "";
  const angkaHalaman = typeof params.page === "string" ? Number(params.page) : 1;
  const halamanDiminta = Number.isSafeInteger(angkaHalaman) && angkaHalaman > 0 ? angkaHalaman : 1;
  const { error: statusError, status } = params;
  let daftarProduk = [];
  let jumlahProduk = 0;
  let kategoriProduk = [];
  let jumlahHasil = 0;
  let totalHalaman = 1;
  let halamanAktif = halamanDiminta;
  let errorQuery = null;
  let produkTerlaris = [];
  let errorKlik = false;

  try {
    const supabase = await createSupabaseSessionClient();

    // Ringkasan mencakup seluruh produk, tidak terpengaruh pencarian atau paginasi.
    let hasilRingkasan = await supabase
      .from("produk")
      .select("kategori", { count: "exact" })
      .order("id", { ascending: true })
      .range(0, UKURAN_BATCH - 1);

    if (hasilRingkasan.error) throw hasilRingkasan.error;
    jumlahProduk = hasilRingkasan.count ?? 0;
    const hitungKategori = new Map();
    let awalRingkasan = 0;

    while (true) {
      const batch = hasilRingkasan.data ?? [];
      if (batch.length === 0) break;
      for (const produk of batch) {
        const kategori = produk.kategori?.trim() || "Tanpa kategori";
        hitungKategori.set(kategori, (hitungKategori.get(kategori) ?? 0) + 1);
      }
      awalRingkasan += batch.length;
      if (awalRingkasan >= jumlahProduk || batch.length < UKURAN_BATCH) break;

      hasilRingkasan = await supabase
        .from("produk")
        .select("kategori")
        .order("id", { ascending: true })
        .range(awalRingkasan, awalRingkasan + UKURAN_BATCH - 1);
      if (hasilRingkasan.error) throw hasilRingkasan.error;
    }

    kategoriProduk = [...hitungKategori.entries()].sort(([a], [b]) => a.localeCompare(b, "id"));

    function buatQueryDaftar() {
      let query = supabase.from("produk").select("*", { count: "exact" });
      if (kataKunci) {
        const teksAman = kataKunci.replace(/[\\%_*]/g, "\\$&");
        query = query.ilike("nama", `%${teksAman}%`);
      }
      return query.order("id", { ascending: true });
    }

    let hasilDaftar = await buatQueryDaftar().range(
      (halamanDiminta - 1) * UKURAN_HALAMAN,
      halamanDiminta * UKURAN_HALAMAN - 1
    );
    if (hasilDaftar.error) throw hasilDaftar.error;

    jumlahHasil = hasilDaftar.count ?? 0;
    totalHalaman = Math.max(1, Math.ceil(jumlahHasil / UKURAN_HALAMAN));
    halamanAktif = Math.min(halamanDiminta, totalHalaman);

    if (halamanAktif !== halamanDiminta) {
      hasilDaftar = await buatQueryDaftar().range(
        (halamanAktif - 1) * UKURAN_HALAMAN,
        halamanAktif * UKURAN_HALAMAN - 1
      );
      if (hasilDaftar.error) throw hasilDaftar.error;
    }

    daftarProduk = hasilDaftar.data ?? [];

    try {
      let hasilKlik = await supabase
        .from("klik_whatsapp")
        .select("produk_id", { count: "exact" })
        .order("id", { ascending: true })
        .range(0, UKURAN_BATCH - 1);

      if (hasilKlik.error) throw hasilKlik.error;

      const jumlahKlik = hasilKlik.count ?? 0;
      const hitungKlik = new Map();
      let awalKlik = 0;

      while (true) {
        const batch = hasilKlik.data ?? [];
        for (const klik of batch) {
          const id = String(klik.produk_id);
          hitungKlik.set(id, (hitungKlik.get(id) ?? 0) + 1);
        }

        awalKlik += batch.length;
        if (awalKlik >= jumlahKlik || batch.length < UKURAN_BATCH) break;

        hasilKlik = await supabase
          .from("klik_whatsapp")
          .select("produk_id")
          .order("id", { ascending: true })
          .range(awalKlik, awalKlik + UKURAN_BATCH - 1);
        if (hasilKlik.error) throw hasilKlik.error;
      }

      const teratas = [...hitungKlik.entries()]
        .sort(([idA, jumlahA], [idB, jumlahB]) => jumlahB - jumlahA || Number(idA) - Number(idB))
        .slice(0, 5);

      if (teratas.length > 0) {
        const { data: produk, error: errorProduk } = await supabase
          .from("produk")
          .select("id,nama")
          .in("id", teratas.map(([id]) => id));

        if (errorProduk) throw errorProduk;
        const namaProduk = new Map((produk ?? []).map((item) => [String(item.id), item.nama]));
        produkTerlaris = teratas
          .filter(([id]) => namaProduk.has(id))
          .map(([id, jumlah]) => ({ id, nama: namaProduk.get(id), jumlah }));
      }
    } catch (error) {
      console.error("Gagal mengambil ringkasan klik WhatsApp:", error?.message ?? error);
      errorKlik = true;
      produkTerlaris = [];
    }
  } catch (error) {
    console.error("Gagal mengambil daftar produk admin:", error?.message ?? error);
    errorQuery = error;
    daftarProduk = [];
    jumlahProduk = 0;
    jumlahHasil = 0;
    kategoriProduk = [];
  }

  function tautanHalaman(nomor) {
    const query = new URLSearchParams();
    if (kataKunci) query.set("q", kataKunci);
    query.set("page", String(nomor));
    return `/admin?${query.toString()}`;
  }

  return (
    <div className="flex flex-col gap-6 py-8">
      <NavAdmin />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Produk</h1>
        <div className="flex flex-wrap gap-2">
          <a
            href="/admin/produk/ekspor"
            className="inline-flex items-center justify-center rounded-lg border border-garis bg-latar px-4 py-2.5 text-sm font-semibold text-teks transition-colors hover:border-utama hover:text-utama"
          >
            Ekspor CSV
          </a>
          <Tombol href="/admin/produk/baru">Tambah produk</Tombol>
        </div>
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
          Daftar atau ringkasan produk gagal dimuat. Periksa koneksi database lalu muat ulang halaman.
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
          <section aria-labelledby="judul-produk-terlaris" className="flex flex-col gap-4">
            <div>
              <h2 id="judul-produk-terlaris" className="text-xl font-bold">Produk terlaris</h2>
              <p className="mt-1 text-sm text-teks-lembut">Berdasarkan jumlah klik tombol pesan WhatsApp.</p>
            </div>
            {errorKlik ? (
              <p role="alert" className="text-sm text-bahaya">
                Data klik pesan gagal dimuat. Periksa koneksi database lalu muat ulang halaman.
              </p>
            ) : produkTerlaris.length === 0 ? (
              <p className="text-teks-lembut">Belum ada klik pesan WhatsApp yang tercatat.</p>
            ) : (
              <ol className="flex flex-col divide-y divide-garis rounded-xl border border-garis">
                {produkTerlaris.map((produk, index) => (
                  <li key={produk.id} className="flex items-center justify-between gap-4 p-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-permukaan text-sm font-bold">
                        {index + 1}
                      </span>
                      <p className="truncate font-semibold">{produk.nama}</p>
                    </div>
                    <p className="shrink-0 text-sm font-bold text-utama">
                      {produk.jumlah} klik
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </section>
          <section aria-labelledby="judul-daftar-produk" className="flex flex-col gap-4">
            <h2 id="judul-daftar-produk" className="text-xl font-bold">Daftar produk</h2>
            <form action="/admin" method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex max-w-xl flex-1 flex-col gap-1.5 text-sm font-semibold">
                Cari nama produk
                <input
                  type="search"
                  name="q"
                  defaultValue={kataKunci}
                  placeholder="Contoh: kopi"
                  className="w-full rounded-lg border border-garis bg-latar px-3 py-2.5 text-base text-teks placeholder:text-teks-lembut focus:border-utama focus:outline-none"
                />
              </label>
              <div className="flex items-center gap-3">
                <Tombol type="submit">Cari</Tombol>
                {kataKunci ? (
                  <Link href="/admin" className="text-sm font-semibold text-utama hover:text-utama-gelap">
                    Hapus pencarian
                  </Link>
                ) : null}
              </div>
            </form>
            {daftarProduk.length === 0 ? (
              <p className="text-teks-lembut">
                {kataKunci ? "Tidak ada produk yang cocok dengan pencarian." : "Belum ada produk."}
              </p>
            ) : (
              <TabelProduk daftarProduk={daftarProduk} />
            )}
            {jumlahHasil > 0 ? (
              <nav aria-label="Navigasi halaman produk admin" className="flex items-center justify-between gap-4">
                {halamanAktif > 1 ? (
                  <Link href={tautanHalaman(halamanAktif - 1)} className="font-semibold text-utama hover:text-utama-gelap">
                    Sebelumnya
                  </Link>
                ) : (
                  <span aria-disabled="true" className="text-teks-lembut">Sebelumnya</span>
                )}
                <p aria-live="polite" className="text-sm text-teks-lembut">
                  Halaman {halamanAktif} dari {totalHalaman} ({jumlahHasil} produk)
                </p>
                {halamanAktif < totalHalaman ? (
                  <Link href={tautanHalaman(halamanAktif + 1)} className="font-semibold text-utama hover:text-utama-gelap">
                    Berikutnya
                  </Link>
                ) : (
                  <span aria-disabled="true" className="text-teks-lembut">Berikutnya</span>
                )}
              </nav>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
