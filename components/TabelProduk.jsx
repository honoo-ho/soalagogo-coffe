import { formatRupiah } from "@/lib/format";
import { ambilFotoProduk } from "@/lib/foto-produk";
import Tombol from "@/components/Tombol";
import FormHapusProduk from "@/components/FormHapusProduk";
import { ubahStatusProduk, ubahUrutanProduk } from "@/app/admin/actions";

export default function TabelProduk({ daftarProduk }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-garis">
      <table className="w-full min-w-[840px] text-left text-sm">
        <thead className="bg-permukaan text-teks-lembut">
          <tr>
            <th className="px-4 py-3 font-semibold">Produk</th>
            <th className="px-4 py-3 font-semibold">Kategori</th>
            <th className="px-4 py-3 font-semibold">Harga</th>
            <th className="px-4 py-3 font-semibold">Status</th>
            <th className="px-4 py-3 font-semibold">Urutan</th>
            <th className="px-4 py-3 font-semibold">
              <span className="sr-only">Aksi</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {daftarProduk.map((produk) => (
            <tr key={produk.id} className="border-t border-garis">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <img
                    src={ambilFotoProduk(produk.foto_url)[0] ?? ""}
                    alt=""
                    className="h-10 w-10 rounded-md object-cover"
                  />
                  <span className="font-semibold">{produk.nama}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-teks-lembut">{produk.kategori}</td>
              <td className="px-4 py-3">{formatRupiah(produk.harga)}</td>
              <td className="px-4 py-3">
                <span className={produk.aktif ? "text-utama" : "text-teks-lembut"}>
                  {produk.aktif ? "Aktif" : "Nonaktif"}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span className="min-w-6 text-center font-semibold">{produk.urutan}</span>
                  <form action={ubahUrutanProduk}>
                    <input type="hidden" name="id" value={produk.id} />
                    <input type="hidden" name="arah" value="naik" />
                    <Tombol type="submit" varian="garis" aria-label={`Naikkan ${produk.nama}`} className="px-2">Naik</Tombol>
                  </form>
                  <form action={ubahUrutanProduk}>
                    <input type="hidden" name="id" value={produk.id} />
                    <input type="hidden" name="arah" value="turun" />
                    <Tombol type="submit" varian="garis" aria-label={`Turunkan ${produk.nama}`} className="px-2">Turun</Tombol>
                  </form>
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-2">
                  <form action={ubahStatusProduk}>
                    <input type="hidden" name="id" value={produk.id} />
                    <Tombol type="submit" varian="garis">
                      {produk.aktif ? "Nonaktifkan" : "Aktifkan"}
                    </Tombol>
                  </form>
                  <Tombol href={`/admin/produk/${produk.id}/ubah`} varian="garis">
                    Ubah
                  </Tombol>
                  <FormHapusProduk produk={produk} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
