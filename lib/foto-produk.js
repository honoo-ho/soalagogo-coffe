export function ambilFotoProduk(fotoUrl) {
  if (typeof fotoUrl !== "string") {
    return [];
  }

  return fotoUrl
    .split(/\r?\n/)
    .map((url) => url.trim())
    .filter(Boolean);
}
