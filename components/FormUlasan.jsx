"use client";

import { useActionState } from "react";
import { kirimUlasan } from "@/app/produk/actions";
import Input from "@/components/Input";
import Tombol from "@/components/Tombol";

const keadaanAwal = { errors: {}, values: {}, success: false };

export default function FormUlasan({ produkId }) {
  const [state, formAction, pending] = useActionState(kirimUlasan, keadaanAwal);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="produk_id" value={produkId} />
      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label htmlFor={`website-${produkId}`}>Jangan isi kolom ini</label>
        <input
          id={`website-${produkId}`}
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <div>
        <Input
          label="Nama"
          name="nama"
          autoComplete="name"
          maxLength={80}
          required
          defaultValue={state.values?.nama ?? ""}
          aria-invalid={Boolean(state.errors?.nama)}
          aria-describedby={state.errors?.nama ? `ulasan-nama-error-${produkId}` : undefined}
        />
        {state.errors?.nama ? (
          <p id={`ulasan-nama-error-${produkId}`} role="alert" className="mt-1 text-sm text-bahaya">
            {state.errors.nama}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor={`rating-${produkId}`} className="flex flex-col gap-1.5 text-sm font-semibold">
          Rating
          <select
            id={`rating-${produkId}`}
            name="rating"
            required
            defaultValue={state.values?.rating ?? ""}
            className="w-full rounded-lg border border-garis bg-latar px-3 py-2.5 text-base text-teks focus:border-utama focus:outline-none"
            aria-invalid={Boolean(state.errors?.rating)}
            aria-describedby={state.errors?.rating ? `ulasan-rating-error-${produkId}` : undefined}
          >
            <option value="" disabled>Pilih rating</option>
            {[1, 2, 3, 4, 5].map((nilai) => (
              <option key={nilai} value={nilai}>{nilai} bintang</option>
            ))}
          </select>
        </label>
        {state.errors?.rating ? (
          <p id={`ulasan-rating-error-${produkId}`} role="alert" className="mt-1 text-sm text-bahaya">
            {state.errors.rating}
          </p>
        ) : null}
      </div>

      <div>
        <Input
          label="Komentar"
          name="komentar"
          textarea
          required
          maxLength={1000}
          defaultValue={state.values?.komentar ?? ""}
          aria-invalid={Boolean(state.errors?.komentar)}
          aria-describedby={state.errors?.komentar ? `ulasan-komentar-error-${produkId}` : undefined}
        />
        {state.errors?.komentar ? (
          <p id={`ulasan-komentar-error-${produkId}`} role="alert" className="mt-1 text-sm text-bahaya">
            {state.errors.komentar}
          </p>
        ) : null}
      </div>

      {state.errors?.form ? <p role="alert" className="text-sm text-bahaya">{state.errors.form}</p> : null}
      {state.success ? <p role="status" className="text-sm text-utama">{state.message}</p> : null}
      <Tombol type="submit" disabled={pending}>
        {pending ? "Mengirim ulasan…" : "Kirim ulasan"}
      </Tombol>
    </form>
  );
}
