import { createHmac, randomBytes } from "node:crypto";

const kunciPrivasi = randomBytes(32);
const buckets = new Map();
const JUMLAH_MAKS_BUCKET = 10_000;

function identitas(headers) {
  const ip = headers.get("x-real-ip") || headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  return createHmac("sha256", kunciPrivasi).update(ip).digest("hex");
}

export function cekBatasPermintaan(headers, ruangLingkup, batas, periodeMs, sekarang = Date.now()) {
  const kunci = `${ruangLingkup}:${identitas(headers)}`;
  let bucket = buckets.get(kunci);

  if (!bucket || sekarang >= bucket.resetAt) {
    if (buckets.size >= JUMLAH_MAKS_BUCKET) {
      for (const [id, nilai] of buckets) {
        if (sekarang >= nilai.resetAt) buckets.delete(id);
      }
    }

    if (buckets.size >= JUMLAH_MAKS_BUCKET) {
      return { allowed: false, retryAfter: Math.max(1, Math.ceil(periodeMs / 1000)) };
    }

    bucket = { jumlah: 0, resetAt: sekarang + periodeMs };
    buckets.set(kunci, bucket);
  }

  if (bucket.jumlah >= batas) {
    return { allowed: false, retryAfter: Math.max(1, Math.ceil((bucket.resetAt - sekarang) / 1000)) };
  }

  bucket.jumlah += 1;
  return { allowed: true, retryAfter: 0 };
}
