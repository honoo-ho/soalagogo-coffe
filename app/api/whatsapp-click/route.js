import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const JUMLAH_MAKS_PRODUK = 50;

export async function POST(request) {
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return NextResponse.json({ error: "Format permintaan tidak valid." }, { status: 415 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Format permintaan tidak valid." }, { status: 400 });
  }

  if (!Array.isArray(body?.productIds) || body.productIds.length < 1 || body.productIds.length > JUMLAH_MAKS_PRODUK) {
    return NextResponse.json({ error: "Daftar produk tidak valid." }, { status: 400 });
  }

  const idProduk = [...new Set(body.productIds.map((id) => String(id)))];
  if (idProduk.some((id) => !/^\d+$/.test(id) || !Number.isSafeInteger(Number(id)))) {
    return NextResponse.json({ error: "ID produk tidak valid." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseServerClient();
    const { data: produkAktif, error: errorProduk } = await supabase
      .from("produk")
      .select("id")
      .in("id", idProduk)
      .eq("aktif", true);

    if (errorProduk) {
      console.error("Gagal memeriksa produk untuk pencatatan WhatsApp:", errorProduk.message);
      return NextResponse.json({ error: "Pencatatan belum dapat dilakukan." }, { status: 503 });
    }

    const idAktif = new Set((produkAktif ?? []).map((produk) => String(produk.id)));
    const catatan = idProduk
      .filter((id) => idAktif.has(id))
      .map((id) => ({ produk_id: Number(id) }));

    if (catatan.length > 0) {
      const { error } = await supabase.from("klik_whatsapp").insert(catatan);
      if (error) {
        console.error("Gagal menyimpan pencatatan klik WhatsApp:", error.message);
        return NextResponse.json({ error: "Pencatatan belum dapat dilakukan." }, { status: 503 });
      }
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Gagal mencatat klik WhatsApp:", error?.message ?? error);
    return NextResponse.json({ error: "Pencatatan belum dapat dilakukan." }, { status: 503 });
  }
}
