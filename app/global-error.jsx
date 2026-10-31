"use client";

export default function GlobalError({ reset }) {
  return (
    <html lang="id">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-4 text-center text-gray-900">
        <h1 className="text-2xl font-bold">Terjadi kendala</h1>
        <p className="max-w-prose text-gray-600">
          Halaman belum dapat dimuat. Silakan coba lagi beberapa saat.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-lg bg-green-800 px-5 py-3 font-semibold text-white"
        >
          Coba lagi
        </button>
      </body>
    </html>
  );
}
