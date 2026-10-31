try {
  const tema = localStorage.getItem("soalagogo-tema-v1");
  document.documentElement.dataset.theme = tema === "gelap" ? "gelap" : "terang";
} catch {
  document.documentElement.dataset.theme = "terang";
}
