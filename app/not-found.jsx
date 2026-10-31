import Tombol from "@/components/Tombol";

export default function NotFound() {
  return (
    <section className="flex min-h-[50vh] flex-col items-start justify-center gap-4 py-12">
      <p className="text-sm font-semibold text-utama">404</p>
      <h1 className="text-3xl font-extrabold tracking-tight">Halaman tidak ditemukan</h1>
      <p className="max-w-prose text-teks-lembut">
        Halaman yang kamu cari mungkin sudah dipindahkan atau alamatnya tidak tepat.
      </p>
      <Tombol href="/">Kembali ke beranda</Tombol>
    </section>
  );
}
