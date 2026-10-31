import NavAdmin from "@/components/NavAdmin";
import FormProduk from "@/components/FormProduk";
import { simpanProduk } from "@/app/admin/actions";

export default async function HalamanTambahProduk({ searchParams }) {
  const { error } = await searchParams;

  return (
    <div className="flex flex-col gap-6 py-8">
      <NavAdmin />
      <h1 className="text-2xl font-extrabold">Tambah produk</h1>
      {error ? (
        <p role="alert" className="text-sm text-bahaya">
          {error === "invalid_data"
            ? "Isi nama produk dan masukkan harga bilangan bulat minimal 0. Harga diskon, jika diisi, harus berupa bilangan bulat di bawah harga normal."
            : error === "invalid_image"
              ? "File foto harus berupa JPG, PNG, WebP, atau GIF yang valid."
              : error === "image_too_large"
                ? "Ukuran total foto dalam satu kali unggah maksimal 4 MB."
                : error === "too_many_images"
                  ? "Pilih maksimal 10 foto dalam satu kali unggah."
                  : error === "upload_failed"
                    ? "Foto gagal diunggah. Pastikan bucket foto-produk di Supabase sudah disiapkan."
                    : "Produk gagal disimpan. Periksa data dan coba lagi."}
        </p>
      ) : null}
      <FormProduk action={simpanProduk} labelTombol="Simpan produk" />
    </div>
  );
}
