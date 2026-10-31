import NavAdmin from "@/components/NavAdmin";
import FormProduk from "@/components/FormProduk";
import { simpanProduk } from "@/app/admin/actions";
import { createSupabaseSessionClient } from "@/lib/supabase/session";
import { ambilDaftarKategori } from "@/lib/kategori";

export default async function HalamanTambahProduk({ searchParams }) {
  const { error } = await searchParams;
  const supabase = await createSupabaseSessionClient();
  const kategori = await ambilDaftarKategori(supabase);

  return (
    <div className="flex flex-col gap-6 py-8">
      <NavAdmin />
      <h1 className="text-2xl font-extrabold">Tambah produk</h1>
      {error ? (
        <p role="alert" className="text-sm text-bahaya">
          {error === "invalid_data"
            ? "Nama produk wajib diisi dan harga harus bilangan bulat positif. Harga diskon, jika diisi, harus lebih rendah dari harga normal."
            : error === "invalid_image"
              ? "File foto harus berupa JPG, PNG, WebP, atau GIF yang valid."
              : error === "image_too_large"
                ? "Ukuran total foto dalam satu kali unggah maksimal 4 MB."
                : error === "too_many_images"
                  ? "Pilih maksimal 10 foto dalam satu kali unggah."
                  : error === "upload_failed"
                    ? "Foto gagal diunggah. Pastikan bucket foto-produk di Supabase sudah disiapkan."
            : error === "invalid_category"
              ? "Pilih kategori yang tersedia atau kosongkan pilihan kategori."
              : "Produk gagal disimpan. Periksa data dan coba lagi."}
        </p>
      ) : null}
      <FormProduk action={simpanProduk} kategori={kategori} labelTombol="Simpan produk" />
    </div>
  );
}
