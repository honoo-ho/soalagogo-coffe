import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { KeranjangProvider } from "@/components/KeranjangProvider";
import { FavoritProvider } from "@/components/FavoritProvider";
import { ProdukTerakhirDilihatProvider } from "@/components/ProdukTerakhirDilihat";
import { PerbandinganProvider } from "@/components/PerbandinganProvider";
import { PengaturanTokoProvider } from "@/components/PengaturanTokoProvider";
import { ambilPengaturanToko } from "@/lib/pengaturan-toko";
import { toko } from "@/lib/toko";
import Script from "next/script";

const skripTemaAwal = `try {
  const tema = localStorage.getItem("soalagogo-tema-v1");
  document.documentElement.dataset.theme = tema === "gelap" ? "gelap" : "terang";
} catch {
  document.documentElement.dataset.theme = "terang";
}`;

export async function generateMetadata() {
  const pengaturanToko = await ambilPengaturanToko();
  return {
    title: pengaturanToko.nama,
    description: toko.tagline,
    manifest: "/manifest.webmanifest",
  };
}

export const viewport = {
  themeColor: "#1f6b4f",
};

export default async function RootLayout({ children }) {
  const pengaturanToko = await ambilPengaturanToko();

  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap"
        />
      </head>
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: skripTemaAwal }} />
        <PengaturanTokoProvider pengaturan={pengaturanToko}>
          <ProdukTerakhirDilihatProvider>
            <PerbandinganProvider>
              <KeranjangProvider>
                <FavoritProvider>
                  <Header pengaturanToko={pengaturanToko} />
                  <main className="mx-auto w-full max-w-5xl flex-1 px-4">{children}</main>
                  <Footer pengaturanToko={pengaturanToko} />
                </FavoritProvider>
              </KeranjangProvider>
            </PerbandinganProvider>
          </ProdukTerakhirDilihatProvider>
        </PengaturanTokoProvider>
      </body>
    </html>
  );
}
