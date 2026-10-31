"use client";

import { useActionState, useEffect, useState } from "react";
import Input from "@/components/Input";
import Tombol from "@/components/Tombol";
import { buatDeskripsiProduk } from "@/app/admin/actions";

function PesanError({ id, children }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="text-sm font-normal text-bahaya">
      {children}
    </p>
  );
}

// Dipakai untuk tambah produk (US-08) dan ubah produk (US-09). Keduanya bonus di jalur offline.
// Nama field sama dengan kolom tabel "produk".
export default function FormProduk({ produk = {}, kategori = [], labelTombol, action }) {
  const [state, formAction, sedangMenyimpan] = useActionState(action, { errors: {}, values: null });
  const errors = state.errors ?? {};
  const [draft, setDraft] = useState({
    nama: produk.nama ?? "",
    harga: produk.harga == null ? "" : String(produk.harga),
    harga_diskon: produk.harga_diskon == null ? "" : String(produk.harga_diskon),
    kategori: produk.kategori ?? "",
    badge: produk.badge ?? "",
    stok: produk.stok == null ? "" : String(produk.stok),
    foto_url: produk.foto_url ?? "",
    deskripsi: produk.deskripsi ?? "",
    varian: (produk.varian_produk ?? []).map((varian) => `${varian.nama}|${varian.harga}`).join("\n"),
  });
  const [sedangMembuat, setSedangMembuat] = useState(false);
  const [pesanAI, setPesanAI] = useState("");

  useEffect(() => {
    if (state.values) setDraft(state.values);
  }, [state.values]);

  function ubahNilai(field, value) {
    setDraft((sebelumnya) => ({ ...sebelumnya, [field]: value }));
  }

  async function buatDeskripsi() {
    const nama = draft.nama;
    const kategori = draft.kategori;

    setSedangMembuat(true);
    setPesanAI("");

    try {
      const hasil = await buatDeskripsiProduk(nama, kategori);
      if (hasil.error) {
        setPesanAI(hasil.error);
      } else {
        ubahNilai("deskripsi", hasil.description);
        setPesanAI("Deskripsi dibuat. Periksa kembali sebelum menyimpan.");
      }
    } catch {
      setPesanAI("Deskripsi gagal dibuat. Silakan coba lagi.");
    } finally {
      setSedangMembuat(false);
    }
  }

  return (
    <form action={formAction} noValidate className="flex max-w-xl flex-col gap-4">
      {produk.id ? <input type="hidden" name="id" value={produk.id} /> : null}
      {errors.form ? <p role="alert" className="text-sm text-bahaya">{errors.form}</p> : null}
      <div className="flex flex-col gap-1.5">
        <Input
          label="Nama produk"
          name="nama"
          value={draft.nama}
          onChange={(event) => ubahNilai("nama", event.target.value)}
          required
          aria-invalid={Boolean(errors.nama)}
          aria-describedby={errors.nama ? "error-nama" : undefined}
        />
        <PesanError id="error-nama">{errors.nama}</PesanError>
      </div>
      <div className="flex flex-col gap-1.5">
        <Input
          label="Harga (Rp)"
          name="harga"
          type="number"
          min="1"
          step="1"
          value={draft.harga}
          onChange={(event) => ubahNilai("harga", event.target.value)}
          required
          aria-invalid={Boolean(errors.harga)}
          aria-describedby={errors.harga ? "error-harga" : undefined}
        />
        <PesanError id="error-harga">{errors.harga}</PesanError>
      </div>
      <div className="flex flex-col gap-1.5">
        <Input
          label="Harga diskon (Rp, opsional)"
          name="harga_diskon"
          type="number"
          min="0"
          step="1"
          placeholder="Harus lebih rendah dari harga normal"
          value={draft.harga_diskon}
          onChange={(event) => ubahNilai("harga_diskon", event.target.value)}
          aria-invalid={Boolean(errors.harga_diskon)}
          aria-describedby={errors.harga_diskon ? "error-harga-diskon" : undefined}
        />
        <PesanError id="error-harga-diskon">{errors.harga_diskon}</PesanError>
      </div>
      <div className="flex flex-col gap-1.5">
        <Input
          label="Varian ukuran dan harga (opsional)"
          name="varian"
          textarea
          placeholder={"250 g|45000\n500 g|85000"}
          value={draft.varian}
          onChange={(event) => ubahNilai("varian", event.target.value)}
          aria-invalid={Boolean(errors.varian)}
          aria-describedby={errors.varian ? "error-varian" : undefined}
        />
        <p className="text-xs text-teks-lembut">Satu varian per baris dengan format nama|harga dalam rupiah. Kosongkan jika produk tidak punya varian.</p>
        <PesanError id="error-varian">{errors.varian}</PesanError>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Kategori
          <select
            name="kategori"
            value={draft.kategori}
            onChange={(event) => ubahNilai("kategori", event.target.value)}
            aria-invalid={Boolean(errors.kategori)}
            aria-describedby={errors.kategori ? "error-kategori" : undefined}
            className="w-full rounded-lg border border-garis bg-latar px-3 py-2.5 text-base text-teks focus:border-utama focus:outline-none"
          >
            <option value="">Tanpa kategori</option>
            {kategori.map(({ nama }) => (
              <option key={nama} value={nama}>{nama}</option>
            ))}
          </select>
        </label>
        <PesanError id="error-kategori">{errors.kategori}</PesanError>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="flex flex-col gap-1.5 text-sm font-semibold">
          Badge produk
          <select
            name="badge"
            value={draft.badge}
            onChange={(event) => ubahNilai("badge", event.target.value)}
            aria-invalid={Boolean(errors.badge)}
            aria-describedby={errors.badge ? "error-badge" : undefined}
            className="w-full rounded-lg border border-garis bg-latar px-3 py-2.5 text-base text-teks focus:border-utama focus:outline-none"
          >
            <option value="">Tanpa badge</option>
            <option value="baru">Baru</option>
            <option value="terlaris">Terlaris</option>
          </select>
        </label>
        <PesanError id="error-badge">{errors.badge}</PesanError>
      </div>
      <div className="flex flex-col gap-1.5">
        <Input
          label="Stok (opsional)"
          name="stok"
          type="number"
          min="0"
          step="1"
          placeholder="Kosongkan jika belum diatur"
          value={draft.stok}
          onChange={(event) => ubahNilai("stok", event.target.value)}
          aria-invalid={Boolean(errors.stok)}
          aria-describedby={errors.stok ? "error-stok" : undefined}
        />
        <PesanError id="error-stok">{errors.stok}</PesanError>
      </div>
      <div className="flex flex-col gap-1.5">
        <Input
          label="Unggah foto produk"
          name="foto_file"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          aria-invalid={Boolean(errors.foto_file)}
          aria-describedby={errors.foto_file ? "error-foto-file" : undefined}
        />
        <p className="text-xs text-teks-lembut">
          JPG, PNG, WebP, atau GIF. Maksimal 4 MB total sekali unggah, hingga 10 foto.
        </p>
        <PesanError id="error-foto-file">{errors.foto_file}</PesanError>
      </div>
      <div className="flex flex-col gap-1.5">
        <Input
          label="Link foto (satu per baris)"
          name="foto_url"
          textarea
          placeholder={"https://.../foto-depan.jpg\nhttps://.../foto-samping.jpg"}
          value={draft.foto_url}
          onChange={(event) => ubahNilai("foto_url", event.target.value)}
        />
      </div>
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
        value={draft.deskripsi}
        onChange={(event) => ubahNilai("deskripsi", event.target.value)}
      />
      <div className="flex gap-3">
        <Tombol type="submit" disabled={sedangMenyimpan}>
          {sedangMenyimpan ? "Menyimpan..." : labelTombol}
        </Tombol>
        <Tombol href="/admin" varian="garis">
          Batal
        </Tombol>
      </div>
    </form>
  );
}
