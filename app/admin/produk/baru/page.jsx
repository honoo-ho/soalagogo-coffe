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
            : "Produk gagal disimpan. Periksa data dan coba lagi."}
        </p>
      ) : null}
      <FormProduk action={simpanProduk} labelTombol="Simpan produk" />
    </div>
  );
}
