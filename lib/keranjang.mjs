export function normalisasiItemKeranjang(item) {
  if (!item || item.id == null || typeof item.nama !== "string") return null;

  const harga = Number(item.harga);
  const hargaDiskon = item.harga_diskon == null ? null : Number(item.harga_diskon);
  const stok = item.stok == null ? null : Number(item.stok);
  const stokValid = Number.isInteger(stok) && stok >= 0 ? stok : null;
  const jumlah = Number(item.jumlah);
  if (!Number.isFinite(harga) || harga < 0 || !Number.isInteger(jumlah) || jumlah < 1) return null;

  const namaProduk = typeof item.nama_produk === "string" ? item.nama_produk : item.nama;
  const namaVarian = typeof item.nama_varian === "string" ? item.nama_varian : null;

  return {
    id: String(item.id),
    varian_id: item.varian_id == null || item.varian_id === "" ? null : String(item.varian_id),
    nama: namaProduk,
    nama_produk: namaProduk,
    nama_varian: namaVarian,
    harga,
    harga_diskon: Number.isInteger(hargaDiskon) && hargaDiskon >= 0 ? hargaDiskon : null,
    stok: stokValid,
    jumlah: stokValid === 0 ? 0 : Math.min(jumlah, stokValid ?? jumlah),
  };
}

export function kunciItemKeranjang(item) {
  return JSON.stringify([
    String(item.id),
    item.varian_id == null || item.varian_id === "" ? null : String(item.varian_id),
  ]);
}

export function tambahItemKeranjang(itemKeranjang, produk, jumlah = 1) {
  const itemBaru = normalisasiItemKeranjang({ ...produk, jumlah });
  if (!itemBaru || itemBaru.jumlah === 0) return itemKeranjang;

  const kunciBaru = kunciItemKeranjang(itemBaru);
  const itemAda = itemKeranjang.find((item) => kunciItemKeranjang(item) === kunciBaru);
  if (!itemAda) return [...itemKeranjang, itemBaru];

  const stok = itemBaru.stok ?? itemAda.stok;
  const jumlahGabung = itemAda.jumlah + itemBaru.jumlah;
  return itemKeranjang.map((item) =>
    kunciItemKeranjang(item) === kunciBaru
      ? { ...item, stok, jumlah: Math.min(jumlahGabung, stok ?? jumlahGabung) }
      : item
  );
}

export function ubahJumlahItemKeranjang(itemKeranjang, kunci, jumlah) {
  const nilai = Number(jumlah);
  if (!Number.isInteger(nilai) || nilai < 1) return itemKeranjang;

  return itemKeranjang.map((item) =>
    kunciItemKeranjang(item) === kunci
      ? { ...item, jumlah: Math.min(nilai, item.stok ?? nilai) }
      : item
  );
}

export function hapusItemKeranjang(itemKeranjang, kunci) {
  return itemKeranjang.filter((item) => kunciItemKeranjang(item) !== kunci);
}

export function namaItemKeranjang(item) {
  if (item.nama_varian) return `${item.nama_produk ?? item.nama} — ${item.nama_varian}`;
  return item.nama_produk ?? item.nama;
}

export function hargaAktifItemKeranjang(item) {
  return Number.isInteger(item.harga_diskon) && item.harga_diskon < item.harga
    ? item.harga_diskon
    : item.harga;
}

export function subtotalItemKeranjang(item) {
  return hargaAktifItemKeranjang(item) * item.jumlah;
}

export function totalKeranjang(itemKeranjang) {
  return itemKeranjang.reduce((total, item) => total + subtotalItemKeranjang(item), 0);
}

export function buatPesanKeranjang(itemKeranjang, formatRupiah) {
  const rincian = itemKeranjang.map((item) =>
    `- ${namaItemKeranjang(item)}: ${formatRupiah(hargaAktifItemKeranjang(item))} x ${item.jumlah} = ${formatRupiah(subtotalItemKeranjang(item))}`
  );
  return `Halo, saya ingin memesan:\n${rincian.join("\n")}\n\nTotal: ${formatRupiah(totalKeranjang(itemKeranjang))}.`;
}
