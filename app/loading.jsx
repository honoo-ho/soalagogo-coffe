export default function Loading() {
  return (
    <section
      aria-busy="true"
      aria-live="polite"
      className="flex min-h-[50vh] flex-col items-start justify-center gap-4 py-12"
    >
      <p className="text-lg font-semibold text-teks">Memuat halaman...</p>
      <p className="text-sm text-teks-lembut">Sebentar, kami sedang menyiapkan kontennya.</p>
    </section>
  );
}
