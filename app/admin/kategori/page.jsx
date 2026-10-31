import NavAdmin from "@/components/NavAdmin";
import { hapusKategori, tambahKategori, ubahKategori } from "@/app/admin/actions";
import { ambilDaftarKategori } from "@/lib/kategori";
import { createSupabaseSessionClient } from "@/lib/supabase/session";

const PESAN_STATUS = {
  created: "Kategori berhasil ditambahkan.",
  updated: "Nama kategori berhasil diubah. Produk yang memakai kategori ini ikut diperbarui.",
  deleted: "Kategori berhasil dihapus.",
  invalid_name: "Nama kategori wajib diisi dan maksimal 80 karakter.",
  duplicate: "Nama kategori tersebut sudah digunakan.",
  not_found: "Kategori tidak ditemukan. Muat ulang halaman.",
  in_use: "Kategori tidak bisa dihapus karena masih dipakai oleh produk.",
  save_failed: "Kategori gagal disimpan. Periksa nama dan coba lagi.",
  delete_failed: "Kategori gagal dihapus. Coba lagi.",
};

export default async function HalamanKategori({ searchParams }) {
  const { status } = await searchParams;
  const supabase = await createSupabaseSessionClient();
  const kategori = await ambilDaftarKategori(supabase);

  return (
    <div className="flex flex-col gap-6 py-8">
      <NavAdmin />
      <div>
        <h1 className="text-2xl font-extrabold">Kelola kategori</h1>
        <p className="mt-1 text-sm text-teks-lembut">
          Kategori ini tersedia sebagai pilihan saat menambah atau mengubah produk.
        </p>
      </div>
      {PESAN_STATUS[status] ? (
        <p role="status" className={`text-sm ${["created", "updated", "deleted"].includes(status) ? "text-utama" : "text-bahaya"}`}>
          {PESAN_STATUS[status]}
        </p>
      ) : null}

      <form action={tambahKategori} className="flex max-w-xl flex-col items-start gap-3 sm:flex-row sm:items-end">
        <label className="flex w-full flex-col gap-1.5 text-sm font-semibold">
          Nama kategori baru
          <input
            name="nama"
            required
            maxLength={80}
            className="w-full rounded-lg border border-garis bg-latar px-3 py-2.5 text-base text-teks focus:border-utama focus:outline-none"
          />
        </label>
        <button type="submit" className="rounded-lg bg-utama px-4 py-2.5 text-sm font-semibold text-white hover:bg-utama-gelap">
          Tambah kategori
        </button>
      </form>

      <section aria-labelledby="judul-daftar-kategori" className="flex flex-col gap-3">
        <h2 id="judul-daftar-kategori" className="text-xl font-bold">Daftar kategori</h2>
        {kategori.length === 0 ? (
          <p className="text-teks-lembut">Belum ada kategori. Tambahkan kategori untuk dipilih pada form produk.</p>
        ) : (
          <ul className="flex max-w-2xl flex-col gap-3">
            {kategori.map(({ nama }) => (
              <li key={nama} className="flex flex-col gap-3 rounded-xl border border-garis bg-permukaan p-4 sm:flex-row sm:items-end">
                <form action={ubahKategori} className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-end">
                  <input type="hidden" name="nama_lama" value={nama} />
                  <label className="flex flex-1 flex-col gap-1.5 text-sm font-semibold">
                    Nama kategori
                    <input
                      name="nama_baru"
                      required
                      maxLength={80}
                      defaultValue={nama}
                      className="w-full rounded-lg border border-garis bg-latar px-3 py-2.5 text-base text-teks focus:border-utama focus:outline-none"
                    />
                  </label>
                  <button type="submit" className="rounded-lg border border-garis bg-latar px-4 py-2.5 text-sm font-semibold hover:border-utama hover:text-utama">
                    Simpan nama
                  </button>
                </form>
                <form action={hapusKategori}>
                  <input type="hidden" name="nama" value={nama} />
                  <button type="submit" className="rounded-lg border border-bahaya px-4 py-2.5 text-sm font-semibold text-bahaya hover:bg-bahaya hover:text-white">
                    Hapus
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
