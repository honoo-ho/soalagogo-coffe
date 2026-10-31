import { notFound } from "next/navigation";
import NavAdmin from "@/components/NavAdmin";
import FormProduk from "@/components/FormProduk";
import { ubahProduk } from "@/app/admin/actions";
import { createSupabaseSessionClient } from "@/lib/supabase/session";

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

  return (
    <div className="flex flex-col gap-6 py-8">
      <NavAdmin />
      <h1 className="text-2xl font-extrabold">Ubah produk</h1>
      {statusError ? (
        <p role="alert" className="text-sm text-bahaya">
          {statusError === "invalid_data"
            ? "Isi nama produk dan masukkan harga berupa bilangan bulat minimal 0."
            : statusError === "not_found"
              ? "Produk tidak ditemukan atau sudah dihapus."
              : "Perubahan produk gagal disimpan. Periksa data dan coba lagi."}
        </p>
      ) : null}
      <FormProduk action={ubahProduk} produk={produk} labelTombol="Simpan perubahan" />
    </div>
  );
}
