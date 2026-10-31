"use client";

import Tombol from "@/components/Tombol";
import { hapusProduk } from "@/app/admin/actions";

export default function FormHapusProduk({ produk }) {
  function konfirmasiHapus(event) {
    const yakin = window.confirm(`Hapus produk "${produk.nama}"?`);
    if (!yakin) {
      event.preventDefault();
    }
  }

  return (
    <form action={hapusProduk} onSubmit={konfirmasiHapus}>
      <input type="hidden" name="id" value={produk.id} />
      <Tombol type="submit" varian="bahaya">
        Hapus
      </Tombol>
    </form>
  );
}
