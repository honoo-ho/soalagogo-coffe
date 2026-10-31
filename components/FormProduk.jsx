"use client";

import { useRef, useState } from "react";
import Input from "@/components/Input";
import Tombol from "@/components/Tombol";
import { buatDeskripsiProduk } from "@/app/admin/actions";

// Dipakai untuk tambah produk (US-08) dan ubah produk (US-09). Keduanya bonus di jalur offline.
// Nama field sama dengan kolom tabel "produk".
export default function FormProduk({ produk = {}, labelTombol, action }) {
  const formRef = useRef(null);
  const [deskripsi, setDeskripsi] = useState(produk.deskripsi ?? "");
  const [sedangMembuat, setSedangMembuat] = useState(false);
  const [pesanAI, setPesanAI] = useState("");

  async function buatDeskripsi() {
    const formData = new FormData(formRef.current);
    const nama = String(formData.get("nama") ?? "");
    const kategori = String(formData.get("kategori") ?? "");

    setSedangMembuat(true);
    setPesanAI("");

    try {
      const hasil = await buatDeskripsiProduk(nama, kategori);
      if (hasil.error) {
        setPesanAI(hasil.error);
      } else {
        setDeskripsi(hasil.description);
        setPesanAI("Deskripsi dibuat. Periksa kembali sebelum menyimpan.");
      }
    } catch {
      setPesanAI("Deskripsi gagal dibuat. Silakan coba lagi.");
    } finally {
      setSedangMembuat(false);
    }
  }

  return (
    <form ref={formRef} action={action} className="flex max-w-xl flex-col gap-4">
      {produk.id ? <input type="hidden" name="id" value={produk.id} /> : null}
      <Input label="Nama produk" name="nama" defaultValue={produk.nama} required />
      <Input
        label="Harga (Rp)"
        name="harga"
        type="number"
        min="0"
        defaultValue={produk.harga}
        required
      />
      <Input label="Kategori" name="kategori" defaultValue={produk.kategori} />
      <Input
        label="Stok (opsional)"
        name="stok"
        type="number"
        min="0"
        step="1"
        placeholder="Kosongkan jika belum diatur"
        defaultValue={produk.stok ?? ""}
      />
      <Input
        label="Link foto (satu per baris)"
        name="foto_url"
        textarea
        placeholder={"https://.../foto-depan.jpg\nhttps://.../foto-samping.jpg"}
        defaultValue={produk.foto_url}
      />
      <div className="flex flex-col items-start gap-2">
        <Tombol
          type="button"
          varian="garis"
          onClick={buatDeskripsi}
          disabled={sedangMembuat}
        >
          {sedangMembuat ? "Membuat deskripsi..." : "Buat deskripsi dengan AI"}
        </Tombol>
        {pesanAI ? (
          <p role="status" className="text-sm text-teks-lembut">
            {pesanAI}
          </p>
        ) : null}
      </div>
      <Input
        label="Deskripsi"
        name="deskripsi"
        textarea
        value={deskripsi}
        onChange={(event) => setDeskripsi(event.target.value)}
      />
      <div className="flex gap-3">
        <Tombol type="submit">{labelTombol}</Tombol>
        <Tombol href="/admin" varian="garis">
          Batal
        </Tombol>
      </div>
    </form>
  );
}
