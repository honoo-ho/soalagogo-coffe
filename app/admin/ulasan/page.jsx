import NavAdmin from "@/components/NavAdmin";
import Tombol from "@/components/Tombol";
import { hapusUlasan, ubahStatusUlasan } from "@/app/admin/actions";
import { createSupabaseSessionClient } from "@/lib/supabase/session";

const PESAN_STATUS = {
  hidden: { teks: "Ulasan disembunyikan dari halaman publik.", role: "status" },
  shown: { teks: "Ulasan kembali ditampilkan di halaman publik.", role: "status" },
  deleted: { teks: "Ulasan berhasil dihapus.", role: "status" },
  invalid_id: { teks: "ID ulasan tidak valid.", role: "alert" },
  not_found: { teks: "Ulasan tidak ditemukan atau sudah dihapus.", role: "alert" },
  update_failed: { teks: "Status ulasan gagal diubah. Muat ulang halaman lalu coba lagi.", role: "alert" },
  update_conflict: { teks: "Status ulasan baru saja berubah. Muat ulang halaman sebelum mencoba lagi.", role: "alert" },
  delete_failed: { teks: "Ulasan gagal dihapus. Muat ulang halaman lalu coba lagi.", role: "alert" },
};

export default async function HalamanAdminUlasan({ searchParams }) {
  const params = await searchParams;
  const pesanStatus = PESAN_STATUS[params.status];
  let daftarUlasan = [];
  let errorQuery = false;

  try {
    const supabase = await createSupabaseSessionClient();
    const { data, error } = await supabase
      .from("ulasan")
      .select("id,produk_id,nama,rating,komentar,ditampilkan,created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;
    daftarUlasan = data ?? [];

    const idProduk = [...new Set(daftarUlasan.map((ulasan) => ulasan.produk_id))];
    if (idProduk.length > 0) {
      const { data: produk, error: errorProduk } = await supabase
        .from("produk")
        .select("id,nama")
        .in("id", idProduk);

      if (errorProduk) throw errorProduk;
      const namaProduk = new Map((produk ?? []).map((item) => [String(item.id), item.nama]));
      daftarUlasan = daftarUlasan.map((ulasan) => ({
        ...ulasan,
        namaProduk: namaProduk.get(String(ulasan.produk_id)) ?? "Produk tidak ditemukan",
      }));
    }
  } catch (error) {
    console.error("Gagal mengambil daftar ulasan admin:", error?.message ?? error);
    errorQuery = true;
    daftarUlasan = [];
  }

  return (
    <div className="flex flex-col gap-6 py-8">
      <NavAdmin />
      <div>
        <h1 className="text-2xl font-extrabold">Moderasi ulasan</h1>
        <p className="mt-1 text-teks-lembut">Sembunyikan ulasan agar tidak tampil di halaman produk, atau hapus secara permanen.</p>
      </div>
      {pesanStatus ? <p role={pesanStatus.role} className={pesanStatus.role === "alert" ? "text-bahaya" : "text-utama"}>{pesanStatus.teks}</p> : null}
      {errorQuery ? (
        <p role="alert" className="text-bahaya">Daftar ulasan gagal dimuat. Periksa koneksi database lalu muat ulang halaman.</p>
      ) : daftarUlasan.length === 0 ? (
        <p className="text-teks-lembut">Belum ada ulasan.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {daftarUlasan.map((ulasan) => (
            <li key={ulasan.id} className="flex flex-col gap-4 rounded-xl border border-garis bg-latar p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold">{ulasan.nama}</p>
                  <p className="text-sm text-teks-lembut">{ulasan.namaProduk}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-harga" aria-label={`Rating ${ulasan.rating} dari 5`}>
                    {"★".repeat(ulasan.rating)}{"☆".repeat(5 - ulasan.rating)}
                  </p>
                  <p className={`text-xs font-semibold ${ulasan.ditampilkan ? "text-utama" : "text-bahaya"}`}>
                    {ulasan.ditampilkan ? "Tampil" : "Disembunyikan"}
                  </p>
                </div>
              </div>
              <p className="whitespace-pre-line text-teks-lembut">{ulasan.komentar}</p>
              <time dateTime={ulasan.created_at} className="text-xs text-teks-lembut">
                {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(ulasan.created_at))}
              </time>
              <div className="flex flex-wrap gap-2 border-t border-garis pt-4">
                <form action={ubahStatusUlasan}>
                  <input type="hidden" name="id" value={ulasan.id} />
                  <Tombol type="submit" varian="garis">
                    {ulasan.ditampilkan ? "Sembunyikan" : "Tampilkan"}
                  </Tombol>
                </form>
                <form action={hapusUlasan}>
                  <input type="hidden" name="id" value={ulasan.id} />
                  <Tombol type="submit" varian="bahaya">Hapus permanen</Tombol>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
