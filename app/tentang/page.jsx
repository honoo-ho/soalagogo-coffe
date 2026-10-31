import { toko } from "@/lib/toko";
import { ambilPengaturanToko } from "@/lib/pengaturan-toko";

export async function generateMetadata() {
  const pengaturanToko = await ambilPengaturanToko();
  return {
    title: `Tentang ${pengaturanToko.nama}`,
    description: `Profil, alamat, jam buka, dan kontak ${pengaturanToko.nama}.`,
  };
}

export default async function HalamanTentang() {
  const pengaturanToko = await ambilPengaturanToko();
  const tautanWhatsApp = `https://wa.me/${pengaturanToko.nomorWhatsApp}`;

  return (
    <article className="flex flex-col gap-8 py-10 sm:py-14">
      <header className="flex flex-col gap-3">
        <p className="text-sm font-semibold text-utama">Profil toko</p>
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
          Tentang {pengaturanToko.nama}
        </h1>
        <p className="max-w-prose text-lg leading-relaxed text-teks-lembut">{toko.tagline}</p>
      </header>

      <section aria-labelledby="judul-informasi-toko" className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-garis bg-latar p-5">
          <h2 id="judul-informasi-toko" className="font-bold">Alamat toko</h2>
          <p className="mt-2 text-teks-lembut">{pengaturanToko.alamat}</p>
        </div>
        <div className="rounded-2xl border border-garis bg-latar p-5">
          <h2 className="font-bold">Jam buka</h2>
          <p className="mt-2 text-teks-lembut">{pengaturanToko.jamBuka}</p>
        </div>
      </section>

      <section aria-labelledby="judul-kontak" className="flex flex-col items-start gap-3">
        <h2 id="judul-kontak" className="text-xl font-bold">Hubungi toko</h2>
        <p className="max-w-prose text-teks-lembut">
          Tanyakan produk atau pesanan langsung kepada {pengaturanToko.nama} melalui WhatsApp.
        </p>
        <a
          href={tautanWhatsApp}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-lg bg-utama px-5 py-3 font-semibold text-white hover:bg-utama-gelap"
        >
          Hubungi via WhatsApp
        </a>
      </section>
    </article>
  );
}
