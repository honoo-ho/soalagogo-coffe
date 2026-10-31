import NavAdmin from "@/components/NavAdmin";
import { logServerError } from "@/lib/log-error";
import Input from "@/components/Input";
import Tombol from "@/components/Tombol";
import { simpanBannerPromo, ubahStatusBannerPromo } from "@/app/admin/actions";
import { createSupabaseSessionClient } from "@/lib/supabase/session";

const PESAN_STATUS = {
  created: "Banner berhasil dibuat.",
  updated: "Perubahan banner berhasil disimpan.",
  enabled: "Banner diaktifkan dan akan tampil di beranda.",
  disabled: "Banner dinonaktifkan dan tidak tampil di beranda.",
  invalid: "Periksa kembali judul, teks, URL gambar, dan tautan. URL harus valid dan menggunakan HTTP atau HTTPS.",
  invalid_id: "ID banner tidak valid.",
  not_found: "Banner tidak ditemukan. Muat ulang halaman.",
  save_failed: "Banner gagal disimpan. Periksa data dan coba lagi.",
  update_failed: "Status banner gagal diubah. Muat ulang halaman lalu coba lagi.",
  update_conflict: "Status banner baru saja berubah. Muat ulang halaman sebelum mencoba lagi.",
};

export default async function HalamanAdminBanner({ searchParams }) {
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : "";
  const pesanStatus = PESAN_STATUS[status];
  const statusBerhasil = ["created", "updated", "enabled", "disabled"].includes(status);
  const statusPerluPerhatian = ["invalid", "invalid_id", "not_found", "save_failed", "update_failed", "update_conflict"].includes(status);
  let daftarBanner = [];
  let errorQuery = false;

  try {
    const supabase = await createSupabaseSessionClient();
    const { data, error } = await supabase
      .from("banner_promo")
      .select("id,judul,teks,gambar_url,tautan,aktif,created_at")
      .order("created_at", { ascending: false });

    if (error) throw error;
    daftarBanner = data ?? [];
  } catch (error) {
    logServerError("Gagal mengambil banner admin:", error);
    errorQuery = true;
  }

  return (
    <div className="flex flex-col gap-6 py-8">
      <NavAdmin />
      <div>
        <h1 className="text-2xl font-extrabold">Banner promo</h1>
        <p className="mt-1 text-sm text-teks-lembut">Banner aktif tampil di beranda katalog.</p>
      </div>
      {pesanStatus ? (
        <p role={statusPerluPerhatian ? "alert" : "status"}
          className={`text-sm ${statusBerhasil ? "text-utama" : "text-bahaya"}`}>
          {pesanStatus}
        </p>
      ) : null}

      <section aria-labelledby="judul-tambah-banner" className="flex max-w-2xl flex-col gap-4 rounded-xl border border-garis bg-permukaan p-4 sm:p-6">
        <h2 id="judul-tambah-banner" className="text-xl font-bold">Buat banner</h2>
        <form action={simpanBannerPromo} className="flex flex-col gap-4">
          <Input label="Judul" name="judul" required maxLength={120} />
          <Input label="Teks promo" name="teks" textarea required maxLength={500} />
          <Input label="URL gambar" name="gambar_url" type="url" required maxLength={2048} placeholder="https://..." />
          <Input label="Tautan promo" name="tautan" type="url" required maxLength={2048} placeholder="https://..." />
          <Tombol type="submit">Simpan banner</Tombol>
        </form>
      </section>

      <section aria-labelledby="judul-daftar-banner" className="flex flex-col gap-4">
        <h2 id="judul-daftar-banner" className="text-xl font-bold">Daftar banner</h2>
        {errorQuery ? (
          <p role="alert" className="text-bahaya">Daftar banner gagal dimuat. Periksa koneksi database lalu muat ulang halaman.</p>
        ) : daftarBanner.length === 0 ? (
          <p className="text-teks-lembut">Belum ada banner promo.</p>
        ) : (
          <ul className="flex flex-col gap-5">
            {daftarBanner.map((banner) => (
              <li key={banner.id} className="grid gap-5 rounded-xl border border-garis bg-latar p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:p-6">
                <div className="flex flex-col gap-3">
                  <img src={banner.gambar_url} alt={banner.judul} className="aspect-[16/7] w-full rounded-lg bg-permukaan object-cover" />
                  <p className={`self-start rounded-full px-3 py-1 text-xs font-bold ${banner.aktif ? "bg-utama text-white" : "bg-permukaan text-teks-lembut"}`}>
                    {banner.aktif ? "Aktif" : "Nonaktif"}
                  </p>
                  <a href={banner.tautan} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-utama hover:underline">
                    Buka tautan promo
                  </a>
                </div>
                <div className="flex flex-col gap-4">
                  <form action={simpanBannerPromo} className="flex flex-col gap-4">
                    <input type="hidden" name="id" value={banner.id} />
                    <Input label="Judul" name="judul" required maxLength={120} defaultValue={banner.judul} />
                    <Input label="Teks promo" name="teks" textarea required maxLength={500} defaultValue={banner.teks} />
                    <Input label="URL gambar" name="gambar_url" type="url" required maxLength={2048} defaultValue={banner.gambar_url} />
                    <Input label="Tautan promo" name="tautan" type="url" required maxLength={2048} defaultValue={banner.tautan} />
                    <Tombol type="submit" varian="garis">Simpan perubahan</Tombol>
                  </form>
                  <form action={ubahStatusBannerPromo}>
                    <input type="hidden" name="id" value={banner.id} />
                    <Tombol type="submit" varian={banner.aktif ? "bahaya" : "utama"}>
                      {banner.aktif ? "Nonaktifkan banner" : "Aktifkan banner"}
                    </Tombol>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
