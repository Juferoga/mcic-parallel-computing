// Motor tipo Prezi (mismo de la presentación de BI): cada .frame vive en un lienzo grande (#world) y la cámara
// vuela entre ellos. Cada marco es una diapositiva de la plantilla institucional UD; los capítulos («estaciones»)
// se agrupan en islas sobre el lienzo y un filete rojo fino une los marcos en el orden del recorrido.
import "./style.css";
import gsap from "gsap";
import { iniciarFondo } from "./fondo.js";
import { graficos } from "./graficos.js";
import { escenas } from "./tres.js";
import datos from "./datos.json";

// Los números del HTML salen de datos.json: data-dato="archivo.gb" (con data-fmt opcional) se vuelve un contador.
for (const el of document.querySelectorAll("[data-dato]")) {
  const v = el.dataset.dato.split(".").reduce((o, k) => o?.[k], datos);
  if (typeof v !== "number") continue;
  el.dataset[el.dataset.fmt ? "valor" : "cuenta"] = v;
}

const W = 1600, H = 900;
const COLOR_CAP = ["var(--gris)", "var(--azul-tm)", "var(--amarillo)", "var(--verde-tm)", "var(--tm-rojo)", "var(--gris)"];
// Colores heráldicos UD por capítulo (azur, oro, sinople, gules); el texto encima siempre es blanco.
const SOBRE_CAP = ["#fff", "#fff", "#fff", "#fff", "#fff", "#fff"];
const CAPITULOS = ["Inicio", "Los datos", "Calidad", "Ray", "Resultados", "Cierre"];
const ULTIMO = CAPITULOS.length - 1;
const reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;

const stage = document.getElementById("stage");
const world = document.getElementById("world");
const parallax = document.getElementById("parallax");

const frames = [...document.querySelectorAll(".frame")].map((el) => ({
  el,
  id: el.id,
  x: +el.dataset.x,
  y: +el.dataset.y,
  s: +(el.dataset.s || 1),
  r: +(el.dataset.r || 0),
  cap: +el.dataset.cap,
  titulo: el.dataset.titulo,
  pasos: Math.max(0, ...[...el.querySelectorAll("[data-paso]")].map((p) => +p.dataset.paso), (graficos[el.dataset.grafico] || {}).pasos || 0),
  modulo: graficos[el.dataset.grafico] || escenas[el.dataset.tres] || null,
}));

for (const f of frames) {
  f.el.style.setProperty("--linea", COLOR_CAP[f.cap]);
  f.el.style.setProperty("--sobre-linea", SOBRE_CAP[f.cap]);
  f.el.style.transformOrigin = "50% 50%";
  f.el.style.transform = `translate(${f.x - W / 2}px, ${f.y - H / 2}px) rotate(${f.r}deg) scale(${f.s})`;
}

// ---------- camera ----------
const cam = { x: 0, y: 0, z: 1, r: 0 };
const fondo = iniciarFondo(document.getElementById("fondo"));

function vista() {
  return { w: innerWidth, h: innerHeight - 120 }; // room for the HUD bars
}

function encuadre(f) {
  const v = vista();
  const z = Math.min(v.w / (W * f.s), v.h / (H * f.s)) * 0.96;
  return { x: f.x, y: f.y + 6 / z, z, r: f.r };
}

function encuadreGeneral() {
  const xs = frames.flatMap((f) => [f.x - (W * f.s) / 2, f.x + (W * f.s) / 2]);
  const ys = frames.flatMap((f) => [f.y - (H * f.s) / 2, f.y + (H * f.s) / 2]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const v = vista();
  const z = Math.min(v.w / (x1 - x0 + 600), v.h / (y1 - y0 + 600));
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z, r: 0 };
}

function aplicar() {
  const { x, y, z, r } = cam;
  world.style.transform = `translate(${innerWidth / 2}px, ${innerHeight / 2}px) scale(${z}) rotate(${-r}deg) translate(${-x}px, ${-y}px)`;
  fondo.camara(cam);
}

let vuelo = null;
function volar(dest, duracion) {
  vuelo?.kill();
  const a = { ...cam };
  const dist = Math.hypot(dest.x - a.x, dest.y - a.y);
  const medio = Math.sqrt(a.z * dest.z);
  // Prezi move: if both frames don't fit at the geometric mid-zoom, zoom out on the way.
  const ambos = innerWidth / (dist + W * 1.4);
  const caida = Math.min(1, ambos / medio);
  let dr = dest.r - a.r;
  dr = ((dr + 540) % 360) - 180;
  const p = { t: 0 };
  const dur = reducido ? 0.01 : duracion ?? Math.min(2.2, 0.9 + dist / 5000 + Math.abs(Math.log(a.z / dest.z)) * 0.25);
  world.classList.add("moviendo");
  vuelo = gsap.to(p, {
    t: 1,
    duration: dur,
    ease: "power2.inOut",
    onUpdate() {
      const t = p.t;
      cam.x = a.x + (dest.x - a.x) * t;
      cam.y = a.y + (dest.y - a.y) * t;
      cam.r = a.r + dr * t;
      cam.z = Math.exp(Math.log(a.z) + (Math.log(dest.z) - Math.log(a.z)) * t) * Math.pow(caida, Math.sin(Math.PI * t));
      aplicar();
    },
    onComplete() {
      world.classList.remove("moviendo");
    },
  });
}

// ---------- state ----------
let actual = -1;
let paso = 0;
let general = false;

function mostrarPasos(f, n, animar = true) {
  const nuevos = [];
  for (const el of f.el.querySelectorAll("[data-paso]")) {
    const ver = +el.dataset.paso <= n;
    if (ver && +el.dataset.paso === n && animar) nuevos.push(el);
    else gsap.to(el, { autoAlpha: ver ? 1 : 0, y: ver ? 0 : 16, duration: animar && !reducido ? 0.35 : 0, ease: "power2.out", overwrite: true });
  }
  // Lo que revela este paso entra igual en todos los marcos: sube y aparece, uno tras otro.
  if (nuevos.length) gsap.to(nuevos, { autoAlpha: 1, y: 0, duration: reducido ? 0 : 0.55, ease: "power3.out", stagger: reducido ? 0 : 0.08, overwrite: true });
  f.modulo?.paso?.(f.el, n);
}

// Entrada de un marco: el contenido fijo sube y aparece en cascada mientras la cámara llega.
function entrada(f, n) {
  if (reducido) return;
  // Bloques visibles en el paso actual (los pasos ya revelados también, p. ej. al volver con ←).
  const hijos = [...f.el.querySelectorAll(".frame-in > *, .frame-in > .texto > *")].filter((el) => !el.classList.contains("texto") && (!el.dataset.paso || +el.dataset.paso <= n));
  gsap.fromTo(hijos, { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: 0.7, ease: "power3.out", stagger: 0.06, delay: 0.45, overwrite: true, clearProps: "transform" });
  const lc = f.el.querySelectorAll(".linea-cap .est");
  if (lc.length) gsap.fromTo(lc, { autoAlpha: 0, x: -24 }, { autoAlpha: 1, x: 0, duration: 0.5, ease: "power2.out", stagger: 0.08, delay: 0.9 });
}

function ir(i, { pasoInicial = 0 } = {}) {
  i = Math.max(0, Math.min(frames.length - 1, i));
  salirGeneral(false);
  const f = frames[i];
  if (i !== actual) {
    const prev = frames[actual];
    if (prev) {
      prev.el.classList.remove("activo");
      prev.modulo?.salir?.(prev.el);
    }
    actual = i;
    f.el.classList.add("activo");
    paso = Math.min(pasoInicial, f.pasos);
    mostrarPasos(f, paso, false);
    f.modulo?.entrar?.(f.el, paso);
    entrada(f, paso);
    contar(f.el);
    history.replaceState(null, "", "#" + f.id);
  }
  volar(encuadre(f));
  actualizarHud();
}

function siguiente() {
  if (general) return ir(Math.max(actual, 0));
  const f = frames[actual];
  if (paso < f.pasos) {
    paso += 1;
    mostrarPasos(f, paso);
    actualizarHud();
  } else ir(actual + 1);
}

function anterior() {
  if (general) return ir(Math.max(actual, 0));
  if (actual === 0) return;
  ir(actual - 1, { pasoInicial: 99 });
}

function entrarGeneral() {
  general = true;
  document.body.classList.add("vista-general");
  volar(encuadreGeneral(), 1.6);
  actualizarHud();
}
function salirGeneral(volver = true) {
  if (!general) return;
  general = false;
  document.body.classList.remove("vista-general");
  if (volver) ir(actual);
}

// ---------- HUD ----------
const pista = document.querySelector("[data-pista]");
const porCap = CAPITULOS.map((_, c) => frames.filter((f) => f.cap === c));
// Una sola línea continua con una parada por marco; el inicio de cada capítulo lleva una marca más alta.
const PICTO_BUS = `<svg viewBox="0 0 12 8"><path d="M0 0h12L6 8z"/></svg>`;
const xParada = (i) => ((i + 0.5) / frames.length) * 100;
pista.innerHTML = `<span class="linea"></span><span class="relleno"></span>` +
  frames.map((f, i) => `<button class="parada${i === 0 || frames[i - 1].cap !== f.cap ? " inicio-cap" : ""}" style="left:${xParada(i)}%" data-i="${i}" title="${f.titulo}" aria-label="${f.titulo}"></button>`).join("") +
  `<div class="bus-hud" aria-hidden="true">${PICTO_BUS}</div>`;
pista.addEventListener("click", (e) => {
  const b = e.target.closest(".parada");
  if (b) ir(+b.dataset.i);
});

// Tells other windows of this site (the presenter's script, web/guion.html) where we are.
const canal = "BroadcastChannel" in window ? new BroadcastChannel("presentacion") : null;
canal?.addEventListener("message", (e) => { if (e.data?.pedir) avisar(); });
function avisar() {
  const f = frames[actual];
  if (f) canal?.postMessage({ id: f.id, paso, general });
}

function actualizarHud() {
  avisar();
  const f = frames[actual];
  document.body.style.setProperty("--linea-actual", COLOR_CAP[f.cap]);
  document.querySelector("[data-hud-cap]").textContent = general ? "Vista general" : f.cap > 0 && f.cap < ULTIMO ? `Estación ${f.cap} · ${CAPITULOS[f.cap]}` : CAPITULOS[f.cap];
  document.querySelector("[data-hud-titulo]").textContent = general ? "Haz clic en un marco" : f.titulo + (f.pasos ? `  ·  ${paso}/${f.pasos}` : "");
  document.querySelector("[data-contador]").textContent = `${String(actual + 1).padStart(2, "0")} / ${frames.length}`;
  document.querySelector("[data-nota]").textContent = f.el.querySelector(".nota")?.textContent ?? "";
  pista.querySelector(".relleno").style.width = `${xParada(actual)}%`;
  pista.querySelectorAll(".parada").forEach((b, j) => {
    b.classList.toggle("pasada", j <= actual);
    b.classList.toggle("aqui", j === actual);
  });
  // El triángulo rojo se para sobre el marco actual.
  gsap.to(pista.querySelector(".bus-hud"), { left: `${xParada(actual)}%`, duration: reducido ? 0 : 0.7, ease: "power2.inOut" });
}

// ---------- number counters ----------
const fmtMiles = (n) => Math.round(n).toLocaleString("de-DE");
const FORMATOS = {
  pct1: (v) => v.toFixed(1).replace(".", ",") + " %",
  pct0: (v) => Math.round(v) + " %",
  dec1: (v) => v.toFixed(1).replace(".", ","),
  dec2: (v) => v.toFixed(2).replace(".", ","),
  dec3: (v) => v.toFixed(3).replace(".", ","),
};
function contar(raiz) {
  for (const el of raiz.querySelectorAll("[data-cuenta], [data-valor]")) {
    const fin = +(el.dataset.cuenta ?? el.dataset.valor);
    const fmt = el.dataset.cuenta ? fmtMiles : FORMATOS[el.dataset.fmt];
    const o = { v: 0 };
    gsap.to(o, { v: fin, duration: reducido ? 0 : 1.6, ease: "power2.out", delay: 0.3, onUpdate: () => (el.textContent = fmt(o.v)) });
  }
}

// ---------- decoración del mundo: islas por capítulo y el filete que une los marcos ----------
// Polilínea ortogonal entre marcos.
function tramo(A, B) {
  const pts = [[A.x, A.y]];
  if (A.x !== B.x && A.y !== B.y) {
    const abajo = B.y > A.y;
    const ym = abajo ? (A.y + (H * A.s) / 2 + B.y - (H * B.s) / 2) / 2 : (A.y - (H * A.s) / 2 + B.y + (H * B.s) / 2) / 2;
    pts.push([A.x, ym], [B.x, ym]);
  }
  pts.push([B.x, B.y]);
  return "M" + pts.map((p) => p.join(",")).join(" L");
}

// Mapa de Bogotá (las 108 rutas troncales del GTFS) en el mismo lienzo que los marcos: se acerca y se aleja con la
// cámara, y en la vista general se ve completo y centrado detrás de todo el recorrido. Norte a la derecha.
function mapaBogota() {
  const xs = frames.flatMap((f) => [f.x - (W * f.s) / 2, f.x + (W * f.s) / 2]);
  const ys = frames.flatMap((f) => [f.y - (H * f.s) / 2, f.y + (H * f.s) / 2]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const pts = datos.troncales.flatMap((t) => t.p);
  const la = pts.map((p) => p[1]), lo = pts.map((p) => p[0]);
  const [la0, la1, lo0, lo1] = [Math.min(...la), Math.max(...la), Math.min(...lo), Math.max(...lo)];
  const k = Math.min((x1 - x0 + 500) / (la1 - la0), (y1 - y0 + 500) / (lo1 - lo0));
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, mla = (la0 + la1) / 2, mlo = (lo0 + lo1) / 2;
  const a = ([lon, lat]) => `${Math.round(cx + (lat - mla) * k)},${Math.round(cy + (lon - mlo) * k)}`;
  const d = datos.troncales.map((t) => "M" + t.p.map(a).join("L"));
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.id = "mapa-bog";
  svg.setAttribute("aria-hidden", "true");
  const fy = y1 + 120;
  svg.innerHTML = `<path class="via" d="${d.join("")}"/>` +
    `<text class="mapa-rotulo" x="${x0}" y="${fy}">Bogotá D.C. · rutas troncales de TransMilenio (GTFS) · norte →</text>`;
  world.prepend(svg);
}

function decorar() {
  mapaBogota();
  const svg = document.getElementById("ruta");
  const NS = "http://www.w3.org/2000/svg";
  let zonas = "", lineas = "";
  porCap.forEach((fs, c) => {
    if (c === 0 || c === ULTIMO || !fs.length) return;
    const pad = 200;
    const x0 = Math.min(...fs.map((f) => f.x - (W * f.s) / 2)) - pad;
    const x1 = Math.max(...fs.map((f) => f.x + (W * f.s) / 2)) + pad;
    const y0 = Math.min(...fs.map((f) => f.y - (H * f.s) / 2)) - pad - 300;
    const y1 = Math.max(...fs.map((f) => f.y + (H * f.s) / 2)) + pad;
    zonas += `<g><rect class="zona" x="${x0}" y="${y0}" width="${x1 - x0}" height="${y1 - y0}"/>`;
    // Filetes rojos finos desplazados de la esquina, como los recuadros de la plantilla UD.
    zonas += `<path class="zona-filete" d="M${x0 - 90},${y0 + 520} V${y0 - 90} H${x0 + 900}"/><path class="zona-filete" d="M${x1 + 90},${y1 - 520} V${y1 + 90} H${x1 - 900}"/>`;
    // Rótulo arriba a la derecha: la línea entra a cada zona por la izquierda y no lo tapa.
    zonas += `<text class="zona-sub" x="${x1 - 160}" y="${y0 + 170}" text-anchor="end">Estación ${c}</text>`;
    zonas += `<text class="zona-nombre" x="${x1 - 160}" y="${y0 + 350}" text-anchor="end">${CAPITULOS[c]}</text></g>`;
  });
  for (let i = 0; i < frames.length - 1; i++) {
    const d = tramo(frames[i], frames[i + 1]);
    lineas += `<path class="tramo" d="${d}"/>`;
  }
  svg.innerHTML = zonas + lineas;
  svg.setAttribute("xmlns", NS);

  // En cada portada de capítulo, el diagrama de la línea con las estaciones que vienen.
  for (const f of frames) {
    if (!f.el.classList.contains("capitulo")) continue;
    const est = porCap[f.cap].filter((x) => x !== f);
    const div = document.createElement("div");
    div.className = "linea-cap";
    div.setAttribute("aria-hidden", "true");
    div.innerHTML = `<p class="linea-cap-etq">En esta estación</p>` + est.map((x) => `<div class="est"><span>${x.titulo}</span></div>`).join("");
    f.el.appendChild(div);
  }
  // Folio «n / N» de la plantilla, salvo en portada y cierre (que en beamer son marcos «plain»).
  frames.forEach((f, i) => {
    if (i === 0 || i === frames.length - 1) return;
    const s = document.createElement("span");
    s.className = "folio";
    s.setAttribute("aria-hidden", "true");
    s.textContent = `${i + 1} / ${frames.length}`;
    f.el.appendChild(s);
  });
}

// ---------- input ----------
function porId(id) {
  return frames.findIndex((f) => f.id === id);
}

document.addEventListener("click", (e) => {
  const boton = e.target.closest("[data-accion], [data-ir]");
  if (boton) {
    e.stopPropagation();
    const a = boton.dataset.accion;
    if (boton.dataset.ir === "mapa" || a === "mapa") return general ? salirGeneral() : entrarGeneral();
    if (boton.dataset.ir) return ir(porId(boton.dataset.ir));
    if (a === "siguiente") siguiente();
    if (a === "anterior") anterior();
    if (a === "notas") document.getElementById("notas").hidden ^= true;
    if (a === "tema") alternarTema();
    if (a === "ayuda") document.getElementById("ayuda").hidden ^= true;
    if (a === "pantalla") document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
    return;
  }
  const frame = e.target.closest(".frame");
  if (frame && (general || !frame.classList.contains("activo"))) ir(frames.findIndex((f) => f.el === frame));
});

document.addEventListener("keydown", (e) => {
  if (e.target.matches("input, textarea")) return;
  const k = e.key;
  if (["ArrowRight", "PageDown", " ", "Enter"].includes(k)) { e.preventDefault(); siguiente(); }
  else if (["ArrowLeft", "PageUp", "Backspace"].includes(k)) { e.preventDefault(); anterior(); }
  else if (k === "ArrowDown") { e.preventDefault(); siguiente(); }
  else if (k === "ArrowUp") { e.preventDefault(); anterior(); }
  else if (k === "o" || k === "O" || k === "Escape") general ? salirGeneral() : k !== "Escape" && entrarGeneral();
  else if (k === "n" || k === "N") document.getElementById("notas").hidden ^= true;
  else if (k === "f" || k === "F") document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.();
  else if (k === "t" || k === "T") alternarTema();
  else if (k === "?") document.getElementById("ayuda").hidden ^= true;
  else if (k === "Home") ir(0);
  else if (k === "End") ir(frames.length - 1);
  else if (/^[1-5]$/.test(k)) ir(frames.findIndex((f) => f.cap === +k));
  else if (k === "g" || k === "G") window.open("guion.html", "guion");
});

// Wheel / trackpad: one gesture = one step.
let acumulado = 0, bloqueo = 0;
stage.addEventListener("wheel", (e) => {
  if (e.target.closest(".lienzo")) return; // 3D canvases zoom themselves
  e.preventDefault();
  const ahora = performance.now();
  if (ahora < bloqueo) return;
  acumulado += Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
  if (Math.abs(acumulado) > 50) {
    acumulado > 0 ? siguiente() : anterior();
    acumulado = 0;
    bloqueo = ahora + 750;
  }
}, { passive: false });

let toque = null;
stage.addEventListener("touchstart", (e) => {
  toque = e.target.closest(".lienzo, input") ? null : [e.touches[0].clientX, e.touches[0].clientY];
}, { passive: true });
stage.addEventListener("touchend", (e) => {
  if (!toque) return;
  const dx = e.changedTouches[0].clientX - toque[0], dy = e.changedTouches[0].clientY - toque[1];
  if (Math.max(Math.abs(dx), Math.abs(dy)) > 50) (Math.abs(dx) > Math.abs(dy) ? dx : dy) < 0 ? siguiente() : anterior();
  toque = null;
});

addEventListener("resize", () => {
  if (general) {
    Object.assign(cam, encuadreGeneral());
  } else Object.assign(cam, encuadre(frames[actual]));
  aplicar();
});

// ---------- theme ----------
function aplicarTema(t) {
  document.documentElement.dataset.theme = t;
  fondo.tema(t === "dark");
  try { localStorage.setItem("tema", t); } catch (e) {}
}
function alternarTema() {
  aplicarTema(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
}
let temaGuardado = null;
try { temaGuardado = localStorage.getItem("tema"); } catch (e) {}
aplicarTema(temaGuardado || "light");

// ---------- boot ----------
decorar();
for (const f of frames) f.modulo?.montar?.(f.el);
for (const f of frames) mostrarPasos(f, 0, false);
const inicio = Math.max(0, porId(location.hash.slice(1)));
Object.assign(cam, encuadreGeneral());
aplicar();
setTimeout(() => ir(inicio), reducido ? 0 : 400);

// Desde la consola: presentacion.ir("calor"), presentacion.ir("pipeline", 3).
window.presentacion = { ir: (id, n = 0) => ir(porId(id), { pasoInicial: n }), siguiente, anterior, marcos: frames.map((f) => f.id) };

