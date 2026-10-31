"use client";

import { useActionState } from "react";
import { tanyaAsistenProduk } from "@/app/produk/actions";
import Tombol from "@/components/Tombol";

const keadaanAwal = { values: {}, answer: "", error: "" };

export default function AsistenProduk({ produkId }) {
  const [state, formAction, pending] = useActionState(tanyaAsistenProduk, keadaanAwal);

  return (
    <section aria-labelledby="judul-asisten-produk" className="flex flex-col gap-4 border-t border-garis py-8">
      <div>
        <h2 id="judul-asisten-produk" className="text-2xl font-extrabold">Tanya tentang produk</h2>
        <p className="mt-1 text-sm text-teks-lembut">Asisten menjawab berdasarkan informasi produk yang tersedia.</p>
      </div>
      <form action={formAction} className="flex max-w-2xl flex-col items-start gap-3">
        <input type="hidden" name="produk_id" value={produkId} />
        <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
          <label htmlFor={`website-asisten-${produkId}`}>Kosongkan kolom ini</label>
          <input id={`website-asisten-${produkId}`} name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>
        <label htmlFor={`pertanyaan-asisten-${produkId}`} className="flex w-full flex-col gap-1.5 text-sm font-semibold">
          Pertanyaan
          <textarea
            id={`pertanyaan-asisten-${produkId}`}
            name="pertanyaan"
            rows={3}
            minLength={3}
            maxLength={500}
            required
            defaultValue={state.values?.pertanyaan ?? ""}
            placeholder="Contoh: Berapa ukuran kemasannya?"
            aria-invalid={Boolean(state.error)}
            className="w-full rounded-lg border border-garis bg-latar px-3 py-2.5 text-base font-normal text-teks placeholder:text-teks-lembut focus:border-utama focus:outline-none"
          />
          <span className="text-xs font-normal text-teks-lembut">Maksimal 500 karakter.</span>
        </label>
        {state.error ? <p role="alert" className="text-sm text-bahaya">{state.error}</p> : null}
        <Tombol type="submit" disabled={pending}>
          {pending ? "Menyiapkan jawaban..." : "Kirim pertanyaan"}
        </Tombol>
      </form>
      {state.answer ? (
        <div className="max-w-prose rounded-xl border border-garis bg-permukaan p-4" aria-live="polite">
          <h3 className="font-bold">Jawaban asisten</h3>
          <p className="mt-2 whitespace-pre-line text-teks-lembut">{state.answer}</p>
        </div>
      ) : null}
    </section>
  );
}
