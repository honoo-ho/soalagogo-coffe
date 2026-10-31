import { notFound } from "next/navigation";
import NavAdmin from "@/components/NavAdmin";
import FormProduk from "@/components/FormProduk";
import { ubahProduk } from "@/app/admin/actions";
import { createSupabaseSessionClient } from "@/lib/supabase/session";
import { ambilDaftarKategori } from "@/lib/kategori";

export default async function HalamanUbahProduk({ params, searchParams }) {
  const { id } = await params;
  const { error: statusError } = await searchParams;
  const supabase = await createSupabaseSessionClient();
  const { data: produk, error } = await supabase
    .from("produk")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!produk) {
    notFound();
  }

  const kategori = await ambilDaftarKategori(supabase);

  return (
    <div className="flex flex-col gap-6 py-8">
      <NavAdmin />
      <h1 className="text-2xl font-extrabold">Ubah produk</h1>
      {statusError ? (
        <p role="alert" className="text-sm text-bahaya">
          {statusError === "invalid_data"
            ? "Isi nama produk dan masukkan harga bilangan bulat minimal 0. Harga diskon, jika diisi, harus berupa bilangan bulat di bawah harga normal."
            : statusError === "invalid_image"
              ? "File foto harus berupa JPG, PNG, WebP, atau GIF yang valid."
              : statusError === "image_too_large"
                ? "Ukuran total foto dalam satu kali unggah maksimal 4 MB."
                : statusError === "too_many_images"
                  ? "Pilih maksimal 10 foto dalam satu kali unggah."
                  : statusError === "upload_failed"
                    ? "Foto gagal diunggah. Pastikan bucket foto-produk di Supabase sudah disiapkan."
                    : statusError === "not_found"
                      ? "Produk tidak ditemukan atau sudah dihapus."
                    : statusError === "invalid_category"
                      ? "Pilih kategori yang tersedia atau kosongkan pilihan kategori."
                      : "Perubahan produk gagal disimpan. Periksa data dan coba lagi."}
        </p>
      ) : null}
      <FormProduk action={ubahProduk} produk={produk} kategori={kategori} labelTombol="Simpan perubahan" />
    </div>
  );
}
