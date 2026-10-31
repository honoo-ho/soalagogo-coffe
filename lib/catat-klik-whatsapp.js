export function catatKlikWhatsApp(productIds) {
  if (typeof navigator === "undefined") return;

  const productIdsValid = [...new Set(productIds.map((id) => String(id)))].slice(0, 50);
  if (productIdsValid.length === 0 || productIdsValid.some((id) => !/^\d+$/.test(id))) return;

  const isi = JSON.stringify({ productIds: productIdsValid });
  const data = new Blob([isi], { type: "application/json" });

  try {
    if (navigator.sendBeacon("/api/whatsapp-click", data)) return;
  } catch {
    // Jika sendBeacon tidak tersedia, lanjutkan dengan fetch keepalive.
  }

  void fetch("/api/whatsapp-click", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: isi,
    keepalive: true,
  }).catch(() => {
    // Pencatatan bersifat best-effort dan tidak boleh menahan tautan WhatsApp.
  });
}
