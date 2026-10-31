import NavAdmin from "@/components/NavAdmin";
import FormImporProduk from "@/components/FormImporProduk";

export default function HalamanImporProduk() {
  return (
    <div className="flex flex-col gap-6 py-8">
      <NavAdmin />
      <div>
        <h1 className="text-2xl font-extrabold">Impor produk dari CSV</h1>
        <p className="mt-1 max-w-prose text-sm text-teks-lembut">
          Kolom wajib: <code>nama</code> dan <code>harga</code>. Kolom opsional: <code>harga_diskon</code>, <code>badge</code>, <code>deskripsi</code>, <code>foto_url</code>, <code>kategori</code>, <code>stok</code>, dan <code>aktif</code>.
        </p>
        <p className="mt-2 max-w-prose text-sm text-teks-lembut">
          Contoh header: <code>nama,harga,kategori,deskripsi,foto_url</code>. Teks yang berisi koma atau kutip harus mengikuti format CSV dengan tanda kutip ganda.
        </p>
      </div>
      <FormImporProduk />
    </div>
  );
}
