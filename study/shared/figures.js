// Figuras das questões: HTML da imagem e ampliação na própria página. A ampliação não
// abre outra aba porque, no modo prova, o cronômetro para quando a página fica oculta.

const figureAttr = s => String(s ?? "").replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const SOURCE_PIXEL_RATIO = 2.2;
const ZOOM = 1.5;

export function figureHtml(img) {
  const minWidth = Number(img.minWidth) || 0;
  const src = figureAttr(img.src);
  return `<a class="q-figure${minWidth ? " wide" : ""}" href="${src}" target="_blank" rel="noopener" aria-label="Ampliar figura"><img src="${src}" alt="${figureAttr(img.alt)}"${minWidth ? ` style="min-width:${minWidth}px"` : ""}></a>${minWidth ? `<span class="q-figure-hint">Arraste para os lados ou toque para ampliar.</span>` : ""}`;
}

let zoomOpener = null;

function closeZoom({ fromHistory = false } = {}) {
  const box = document.getElementById("fig-zoom");
  if (!box) return;
  box.remove();
  document.documentElement.classList.remove("fig-zoom-open");
  if (zoomOpener) zoomOpener.focus({ preventScroll: true });
  zoomOpener = null;
  if (!fromHistory && history.state?.figZoom) history.back();
}

function openZoom(link) {
  const source = link.querySelector("img");
  const width = source.naturalWidth ? Math.round((source.naturalWidth / SOURCE_PIXEL_RATIO) * ZOOM) : null;
  const box = document.createElement("div");
  box.id = "fig-zoom";
  box.className = "fig-zoom";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  box.setAttribute("aria-label", "Figura ampliada");
  box.innerHTML = `<button type="button" class="btn fig-zoom-close">Fechar</button>
    <div class="fig-zoom-scroll" tabindex="0"><img alt=""></div>`;
  const image = box.querySelector("img");
  image.src = source.src;
  image.alt = source.alt;
  if (width) image.style.width = `${width}px`;
  box.querySelector(".fig-zoom-close").addEventListener("click", () => closeZoom());
  document.body.append(box);
  document.documentElement.classList.add("fig-zoom-open");
  zoomOpener = link;
  // O botão Voltar do celular fecha a figura em vez de sair da prova.
  history.pushState({ figZoom: true }, "");
  box.querySelector(".fig-zoom-close").focus();
}

document.addEventListener("click", e => {
  const link = e.target.closest?.("a.q-figure");
  if (!link || e.ctrlKey || e.metaKey || e.shiftKey) return;
  e.preventDefault();
  openZoom(link);
});

// Na fase de captura: com a figura aberta, as teclas não respondem a questão por trás.
document.addEventListener("keydown", e => {
  if (!document.getElementById("fig-zoom")) return;
  if (e.key === "Escape") closeZoom();
  if (e.key !== "Tab") e.stopImmediatePropagation();
}, true);

window.addEventListener("popstate", () => closeZoom({ fromHistory: true }));
