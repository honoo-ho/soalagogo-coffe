"use client";

import { useActionState } from "react";
import { imporProduk } from "@/app/admin/impor/actions";
import Tombol from "@/components/Tombol";

const STATE_AWAL = { message: "", successCount: 0, failedCount: 0, errors: [] };

export default function FormImporProduk() {
  const [state, formAction, pending] = useActionState(imporProduk, STATE_AWAL);

  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-semibold">
        File CSV
        <input
          type="file"
          name="file_csv"
          accept=".csv,text/csv"
          required
          className="w-full rounded-lg border border-garis bg-latar px-3 py-2.5 text-base text-teks file:mr-3 file:rounded-md file:border-0 file:bg-permukaan file:px-3 file:py-2 file:font-semibold file:text-teks"
        />
      </label>
      <p className="text-xs text-teks-lembut">Maksimal 512 KB dan 500 baris produk per impor. Simpan file dengan encoding UTF-8.</p>
      <Tombol type="submit" disabled={pending}>
        {pending ? "Mengimpor produk..." : "Impor produk"}
      </Tombol>

      {state.message ? (
        <div aria-live="polite" className="flex flex-col gap-3 rounded-xl border border-garis bg-permukaan p-4">
          <p role={state.failedCount > 0 || state.successCount === 0 ? "alert" : "status"} className="font-semibold">
            {state.message}
          </p>
          {state.successCount + state.failedCount > 0 ? (
            <p className="text-sm text-teks-lembut">Berhasil: {state.successCount} · Gagal: {state.failedCount}</p>
          ) : null}
          {state.errors?.length > 0 ? (
            <ul className="flex flex-col gap-1 text-sm text-bahaya">
              {state.errors.map((item, index) => (
                <li key={`${item.baris}-${index}`}>Baris {item.baris}: {item.pesan}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
