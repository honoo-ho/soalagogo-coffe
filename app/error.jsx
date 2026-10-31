"use client";

export default function Error({ reset }) {
  return (
    <main className="mx-auto flex min-h-[50vh] max-w-5xl flex-col items-center justify-center gap-4 px-4 py-12 text-center">
      <h1 className="text-2xl font-extrabold">Halaman belum dapat dimuat</h1>
      <p className="max-w-prose text-teks-lembut">
        Terjadi kendala saat memuat halaman. Silakan coba lagi beberapa saat.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-lg bg-utama px-5 py-3 font-semibold text-white hover:bg-utama-gelap"
      >
        Coba lagi
      </button>
    </main>
  );
}
