import NavAdmin from "@/components/NavAdmin";
import Input from "@/components/Input";
import Tombol from "@/components/Tombol";
import { hapusAdmin, ubahStatusAdmin, undangAdmin } from "@/app/admin/actions";
import { createSupabaseSessionClient } from "@/lib/supabase/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const PESAN_STATUS = {
  invited: { teks: "Undangan admin berhasil dikirim melalui email.", berhasil: true },
  disabled: { teks: "Akun admin berhasil dinonaktifkan.", berhasil: true },
  enabled: { teks: "Akun admin berhasil diaktifkan kembali.", berhasil: true },
  deleted: { teks: "Akun admin berhasil dihapus.", berhasil: true },
  invalid_email: { teks: "Masukkan alamat email yang valid.", berhasil: false },
  invalid_id: { teks: "ID akun tidak valid.", berhasil: false },
  invalid_action: { teks: "Aksi akun tidak valid. Muat ulang halaman lalu coba lagi.", berhasil: false },
  self_action_denied: { teks: "Anda tidak dapat menonaktifkan atau menghapus akun sendiri.", berhasil: false },
  invite_failed: { teks: "Undangan gagal dikirim. Pastikan email belum terdaftar dan konfigurasi email Supabase tersedia.", berhasil: false },
  update_failed: { teks: "Status akun gagal diubah. Muat ulang halaman lalu coba lagi.", berhasil: false },
  delete_failed: { teks: "Akun gagal dihapus. Muat ulang halaman lalu coba lagi.", berhasil: false },
  service_unavailable: { teks: "Pengelolaan akun belum tersedia. Pastikan SUPABASE_SECRET_KEY sudah dikonfigurasi di server.", berhasil: false },
};

function akunDinonaktifkan(akun) {
  return Boolean(akun.banned_until && Date.parse(akun.banned_until) > Date.now());
}

export default async function HalamanAdminAkun({ searchParams }) {
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : "";
  const pesan = PESAN_STATUS[status];
  let idAdminAktif = "";
  let daftarAkun = [];
  let errorQuery = false;

  try {
    const sessionClient = await createSupabaseSessionClient();
    const { data: sesi, error: errorSesi } = await sessionClient.auth.getUser();
    if (errorSesi || !sesi.user) {
      errorQuery = true;
    } else {
      idAdminAktif = sesi.user.id;
      const supabase = createSupabaseServerClient();
      let nomorHalaman = 1;
      while (true) {
        const hasil = await supabase.auth.admin.listUsers({ page: nomorHalaman, perPage: 1000 });
        if (hasil.error) throw hasil.error;
        const akunHalaman = hasil.data.users ?? [];
        daftarAkun.push(...akunHalaman);
        if (akunHalaman.length < 1000) break;
        nomorHalaman += 1;
      }
    }
  } catch (error) {
    console.error("Gagal mengambil daftar akun admin:", error?.message ?? error);
    errorQuery = true;
  }

  return (
    <div className="flex flex-col gap-6 py-8">
      <NavAdmin />
      <div>
        <h1 className="text-2xl font-extrabold">Kelola akun admin</h1>
        <p className="mt-1 text-sm text-teks-lembut">Undang admin melalui email atau kelola akses akun yang sudah ada.</p>
      </div>

      {pesan ? (
        <p role={pesan.berhasil ? "status" : "alert"} className={`text-sm ${pesan.berhasil ? "text-utama" : "text-bahaya"}`}>
          {pesan.teks}
        </p>
      ) : null}

      <section aria-labelledby="judul-undang-admin" className="flex max-w-2xl flex-col gap-4 rounded-xl border border-garis bg-permukaan p-4 sm:p-6">
        <div>
          <h2 id="judul-undang-admin" className="text-xl font-bold">Tambah admin</h2>
          <p className="mt-1 text-sm text-teks-lembut">Supabase Auth akan mengirim email undangan untuk mengatur akses.</p>
        </div>
        <form action={undangAdmin} className="flex flex-col gap-4">
          <Input label="Email admin" name="email" type="email" required maxLength={254} autoComplete="email" />
          <Tombol type="submit">Kirim undangan</Tombol>
        </form>
      </section>

      <section aria-labelledby="judul-daftar-admin" className="flex flex-col gap-4">
        <h2 id="judul-daftar-admin" className="text-xl font-bold">Daftar admin</h2>
        {errorQuery ? (
          <p role="alert" className="text-bahaya">Daftar akun belum dapat dimuat. Silakan coba lagi nanti.</p>
        ) : daftarAkun.length === 0 ? (
          <p className="text-teks-lembut">Belum ada akun admin.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {daftarAkun.map((akun) => {
              const akunSendiri = akun.id === idAdminAktif;
              const nonaktif = akunDinonaktifkan(akun);
              return (
                <li key={akun.id} className="flex flex-col gap-4 rounded-xl border border-garis bg-latar p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="break-all font-semibold">{akun.email ?? "Email belum tersedia"}{akunSendiri ? " (Anda)" : ""}</p>
                    <p className="mt-1 text-sm text-teks-lembut">
                      {nonaktif ? "Nonaktif" : akun.email_confirmed_at ? "Aktif" : "Menunggu konfirmasi email"}
                      {akun.created_at ? ` · Ditambahkan ${new Intl.DateTimeFormat("id-ID", { dateStyle: "medium" }).format(new Date(akun.created_at))}` : ""}
                    </p>
                  </div>
                  {akunSendiri ? (
                    <p className="text-sm text-teks-lembut">Akun Anda tidak dapat dinonaktifkan atau dihapus.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <form action={ubahStatusAdmin}>
                        <input type="hidden" name="id" value={akun.id} />
                        <input type="hidden" name="aksi" value={nonaktif ? "aktifkan" : "nonaktifkan"} />
                        <Tombol type="submit" varian="garis">
                          {nonaktif ? "Aktifkan" : "Nonaktifkan"}
                        </Tombol>
                      </form>
                      <form action={hapusAdmin}>
                        <input type="hidden" name="id" value={akun.id} />
                        <Tombol type="submit" varian="bahaya">Hapus akun</Tombol>
                      </form>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
