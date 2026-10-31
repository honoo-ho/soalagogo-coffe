import NavAdmin from "@/components/NavAdmin";
import Input from "@/components/Input";
import Tombol from "@/components/Tombol";
import { simpanPengaturanToko } from "@/app/admin/actions";
import { createSupabaseSessionClient } from "@/lib/supabase/session";
import { toko } from "@/lib/toko";
import { logServerError } from "@/lib/log-error";

const PESAN_STATUS = {
  saved: { teks: "Pengaturan toko berhasil disimpan.", berhasil: true },
  invalid_name: { teks: "Nama toko wajib diisi dan maksimal 120 karakter.", berhasil: false },
  invalid_phone: { teks: "Nomor WhatsApp harus 8–15 digit dalam format internasional tanpa tanda +, misalnya 6281234567890.", berhasil: false },
  invalid_hours: { teks: "Jam buka wajib diisi dan maksimal 120 karakter.", berhasil: false },
  invalid_address: { teks: "Alamat wajib diisi dan maksimal 250 karakter.", berhasil: false },
  save_failed: { teks: "Pengaturan gagal disimpan. Periksa koneksi database lalu coba lagi.", berhasil: false },
};

export default async function HalamanPengaturanToko({ searchParams }) {
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : "";
  const pesanStatus = PESAN_STATUS[status];
  let pengaturan = toko;
  let errorQuery = false;

  try {
    const supabase = await createSupabaseSessionClient();
    const { data, error } = await supabase
      .from("pengaturan_toko")
      .select("nama_toko,nomor_whatsapp,jam_buka,alamat")
      .eq("id", 1)
      .maybeSingle();

    if (error) throw error;
    if (data) {
      pengaturan = {
        ...toko,
        nama: data.nama_toko,
        nomorWhatsApp: data.nomor_whatsapp,
        jamBuka: data.jam_buka,
        alamat: data.alamat,
      };
    }
  } catch (error) {
    logServerError("Gagal mengambil pengaturan admin toko:", error);
    errorQuery = true;
  }

  return (
    <div className="flex flex-col gap-6 py-8">
      <NavAdmin />
      <div>
        <h1 className="text-2xl font-extrabold">Pengaturan toko</h1>
        <p className="mt-1 text-sm text-teks-lembut">Informasi ini dipakai di halaman publik dan tautan WhatsApp.</p>
      </div>
      {pesanStatus ? (
        <p role={pesanStatus.berhasil ? "status" : "alert"} className={`text-sm ${pesanStatus.berhasil ? "text-utama" : "text-bahaya"}`}>
          {pesanStatus.teks}
        </p>
      ) : null}
      {errorQuery ? (
        <p role="alert" className="text-sm text-bahaya">Pengaturan saat ini gagal dimuat. Nilai cadangan ditampilkan; pastikan tabel pengaturan_toko tersedia.</p>
      ) : null}

      <form action={simpanPengaturanToko} className="flex max-w-2xl flex-col gap-4">
        <Input label="Nama toko" name="nama_toko" required maxLength={120} defaultValue={pengaturan.nama} />
        <Input
          label="Nomor WhatsApp"
          name="nomor_whatsapp"
          type="tel"
          inputMode="numeric"
          pattern="[1-9][0-9]{7,14}"
          title="Masukkan 8 sampai 15 digit format internasional tanpa tanda +."
          required
          maxLength={15}
          defaultValue={pengaturan.nomorWhatsApp}
        />
        <Input label="Jam buka" name="jam_buka" required maxLength={120} defaultValue={pengaturan.jamBuka} />
        <Input label="Alamat" name="alamat" textarea required maxLength={250} defaultValue={pengaturan.alamat} />
        <Tombol type="submit">Simpan pengaturan</Tombol>
      </form>
    </div>
  );
}
