import NavAdmin from "@/components/NavAdmin";
import { logServerError } from "@/lib/log-error";
import { createSupabaseSessionClient } from "@/lib/supabase/session";
import { redirect } from "next/navigation";

const LABEL_AKSI = {
  tambah_produk: "Menambahkan produk",
  ubah_produk: "Mengubah produk",
  hapus_produk: "Menghapus produk",
};

export default async function HalamanAktivitasAdmin() {
  let daftarLog = [];
  let gagalMemuat = false;
  const supabase = await createSupabaseSessionClient();
  const { data: sesi, error: errorSesi } = await supabase.auth.getUser();
  if (errorSesi || !sesi.user) redirect("/admin/login");

  try {
    const { data, error } = await supabase
      .from("log_aktivitas_admin")
      .select("id,admin_id,admin_email,aksi,produk_id,nama_produk,created_at")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(50);

    if (error) throw error;
    daftarLog = data ?? [];
  } catch (error) {
    logServerError("Gagal mengambil log aktivitas admin:", error);
    gagalMemuat = true;
  }

  return (
    <div className="flex flex-col gap-6 py-8">
      <NavAdmin />
      <div>
        <h1 className="text-2xl font-extrabold">Log aktivitas admin</h1>
        <p className="mt-1 text-sm text-teks-lembut">50 perubahan produk terbaru.</p>
      </div>

      {gagalMemuat ? (
        <p role="alert" className="text-bahaya">Log aktivitas gagal dimuat. Pastikan skema database terbaru sudah diterapkan, lalu muat ulang halaman.</p>
      ) : daftarLog.length === 0 ? (
        <p className="text-teks-lembut">Belum ada aktivitas produk yang tercatat.</p>
      ) : (
        <ol className="flex flex-col divide-y divide-garis rounded-xl border border-garis bg-latar">
          {daftarLog.map((log) => (
            <li key={log.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <div>
                <p className="font-semibold">{LABEL_AKSI[log.aksi] ?? "Mengubah produk"}: {log.nama_produk}</p>
                <p className="text-sm text-teks-lembut">
                  {log.admin_email || `Admin ${log.admin_id ?? "tidak diketahui"}`} · ID produk {log.produk_id}
                </p>
              </div>
              <time dateTime={log.created_at} className="shrink-0 text-sm text-teks-lembut">
                {new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(log.created_at))}
              </time>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
