import NavAdmin from "@/components/NavAdmin";
import Input from "@/components/Input";
import Tombol from "@/components/Tombol";
import { gantiPasswordAdmin } from "@/app/admin/actions";

const pesanStatus = {
  success: { teks: "Password berhasil diperbarui.", role: "status" },
  too_short: { teks: "Password baru harus terdiri dari minimal 8 karakter.", role: "alert" },
  mismatch: { teks: "Password baru dan konfirmasi tidak sama.", role: "alert" },
  session_error: { teks: "Sesi admin tidak valid. Silakan masuk kembali.", role: "alert" },
  update_error: { teks: "Password gagal diperbarui. Periksa koneksi dan coba lagi.", role: "alert" },
};

export default async function HalamanGantiPassword({ searchParams }) {
  const { status } = await searchParams;
  const pesan = pesanStatus[status];

  return (
    <div className="flex flex-col gap-6 py-8">
      <NavAdmin />
      <div>
        <h1 className="text-2xl font-extrabold">Ganti password</h1>
        <p className="mt-1 text-sm text-teks-lembut">
          Ganti password bawaan segera setelah pertama kali masuk. Minimal 8 karakter.
        </p>
      </div>
      <form action={gantiPasswordAdmin} className="flex max-w-sm flex-col gap-4">
        <Input
          label="Password baru"
          name="password_baru"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <Input
          label="Ulangi password baru"
          name="konfirmasi_password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <Tombol type="submit" className="self-start">
          Simpan password
        </Tombol>
      </form>
      {pesan ? (
        <p role={pesan.role} className={pesan.role === "status" ? "text-sm text-utama" : "text-sm text-bahaya"}>
          {pesan.teks}
        </p>
      ) : null}
    </div>
  );
}
