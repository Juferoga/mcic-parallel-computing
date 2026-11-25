// Gráficos y diagramas 2D (SVG + GSAP). Los números salen de datos.json (scripts/exportar_datos.py).
import gsap from "gsap";
import datos from "./datos.json";

const reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;
const D = (s) => (reducido ? 0 : s);
const miles = (n) => Math.round(n).toLocaleString("de-DE");
const dec = (v, d = 1) => v.toFixed(d).replace(".", ",");
const DIAS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const FESTIVOS = new Set(["2026-11-16"]);
const fecha = (iso) => new Date(iso + "T12:00:00-05:00");
const etqDia = (iso) => `${DIAS[fecha(iso).getDay()]} ${+iso.slice(8)}`;
const finde = (iso) => [0, 6].includes(fecha(iso).getDay()) || FESTIVOS.has(iso);

const tooltip = document.createElement("div");
tooltip.className = "tooltip";
document.body.appendChild(tooltip);
function conTooltip(raiz) {
  raiz.addEventListener("pointermove", (e) => {
    const t = e.target.closest("[data-tip]");
    if (!t) return (tooltip.style.opacity = 0);
    tooltip.innerHTML = t.dataset.tip;
    tooltip.style.opacity = 1;
    tooltip.style.left = e.clientX + 14 + "px";
    tooltip.style.top = e.clientY + 14 + "px";
  });
  raiz.addEventListener("pointerleave", () => (tooltip.style.opacity = 0));
}
const lienzo = (el, sel = "[data-svg]") => el.querySelector(sel);
const svg = (w, h, cuerpo) => `<svg viewBox="0 0 ${w} ${h}" role="img">${cuerpo}</svg>`;
const escala = (d0, d1, r0, r1) => (v) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);

// ---------------- Capturas por día ----------------
const porDia = {
  montar(el) {
    const filas = datos.archivo.por_dia;
    const w = 1400, h = 420, x0 = 70, base = 360;
    const max = Math.max(...filas.map((f) => f.mb));
    const y = escala(0, max * 1.1, base, 20);
    const bw = (w - x0 - 20) / filas.length;
    let c = `<defs><pattern id="rayas-dia" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="9" height="9" fill="var(--superficie)"/><line x1="0" y1="0" x2="0" y2="9" stroke="var(--gris)" stroke-width="3.5"/></pattern></defs>`;
    for (let v = 100; v <= max * 1.1; v += 100) c += `<line class="rejilla" x1="${x0}" x2="${w}" y1="${y(v)}" y2="${y(v)}"/><text x="${x0 - 10}" y="${y(v) + 5}" text-anchor="end" font-size="15">${v} MB</text>`;
    filas.forEach((f, i) => {
      const x = x0 + i * bw + 8;
      const borde = f.dia === "2026-11-11" || f.dia === "2026-11-24";
      const color = borde ? "url(#rayas-dia)" : finde(f.dia) ? "var(--amarillo)" : "var(--azul-tm)";
      c += `<rect class="barra" data-tip="${etqDia(f.dia)} nov · <b>${miles(f.pos)}</b> capturas de posiciones · <b>${miles(f.mb)} MB</b>" x="${x}" y="${base}" width="${bw - 16}" height="0" data-h="${base - y(f.mb)}" rx="4" fill="${color}"${borde ? ' stroke="var(--gris)" stroke-width="1.5"' : ""}/>`;
      c += `<text x="${x + (bw - 16) / 2}" y="${base + 26}" text-anchor="middle" font-size="16" class="${FESTIVOS.has(f.dia) ? "t-fuerte" : ""}">${etqDia(f.dia)}</text>`;
      if (FESTIVOS.has(f.dia)) c += `<text x="${x + (bw - 16) / 2}" y="${base + 48}" text-anchor="middle" font-size="14" style="fill:var(--amarillo-texto)" font-weight="600">festivo</text>`;
    });
    c += `<line class="eje-linea" x1="${x0}" x2="${w}" y1="${base}" y2="${base}"/>`;
    lienzo(el).innerHTML = svg(w, h + 30, c);
    conTooltip(el);
  },
  entrar(el) {
    el.querySelectorAll("rect.barra").forEach((r, i) => {
      const hh = +r.dataset.h;
      gsap.fromTo(r, { attr: { height: 0, y: 360 } }, { attr: { height: hh, y: 360 - hh }, duration: D(0.9), delay: D(0.2 + i * 0.04), ease: "power3.out" });
    });
  },
};

// ---------------- Mapa de calor: buses en servicio por media hora ----------------
const calor = {
  pasos: 3,
  montar(el) {
    const { dias, valores } = datos.calor;
    const w = 1480, h = 590, x0 = 80, y0 = 30, cw = (w - x0 - 10) / 48, ch = (h - y0 - 40) / dias.length;
    const max = Math.max(...valores.flat().filter((v) => v != null));
    let c = `<defs><pattern id="rayas" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="var(--superficie)"/><line x1="0" y1="0" x2="0" y2="8" stroke="var(--gris)" stroke-opacity=".55" stroke-width="2.5"/></pattern></defs>`;
    for (let hh = 0; hh <= 24; hh += 3) c += `<text x="${x0 + hh * 2 * cw}" y="${y0 - 12}" text-anchor="middle" font-size="15" class="t-mono">${String(hh).padStart(2, "0")}h</text>`;
    dias.forEach((d, r) => {
      c += `<text x="${x0 - 12}" y="${y0 + r * ch + ch / 2 + 5}" text-anchor="end" font-size="16" class="${finde(d) ? "" : "t-fuerte"}">${etqDia(d)}</text>`;
      valores[r].forEach((v, s) => {
        const x = x0 + s * cw, y = y0 + r * ch;
        const hora = `${String(s >> 1).padStart(2, "0")}:${s & 1 ? "30" : "00"}`;
        const servicio = s >= 10 && s <= 45; // 05:00–22:30
        const hueco = v == null || (servicio && v < 300);
        const fill = v == null ? "url(#rayas)" : `color-mix(in oklab, var(--celda-tinta) ${Math.round(4 + 88 * (v / max) ** 0.9)}%, var(--celda-base))`;
        c += `<rect class="celda${hueco && servicio ? " hueco" : ""}" data-d="${d}" data-s="${s}" x="${x + 1}" y="${y + 1}" width="${cw - 2}" height="${ch - 2}" rx="2" fill="${fill}" data-tip="${etqDia(d)} · ${hora} · ${v == null ? "<b>sin capturas</b> (feed congelado)" : `<b>${miles(v)}</b> buses reportando`}"/>`;
      });
    });
    // Marcas de los pasos
    // Cada marca lleva una «bala» numerada (como el número de línea) que remite al texto ①②③ de arriba.
    const rect = (d0, s0, d1, s1, clase, texto, n = 0) => {
      const r0 = dias.indexOf(d0), r1 = dias.indexOf(d1);
      const xa = x0 + s0 * cw, ya = y0 + r0 * ch, xb = x0 + (s1 + 1) * cw, yb = y0 + (r1 + 1) * ch;
      let g = `<g class="marca-calor ${clase}"><rect x="${xa - 1}" y="${ya - 1}" width="${xb - xa + 2}" height="${yb - ya + 2}" rx="5"/>`;
      if (n) g += `<circle class="bala" cx="${xb + 20}" cy="${(ya + yb) / 2}" r="14"/><text class="bala-n" x="${xb + 20}" y="${(ya + yb) / 2 + 6}" text-anchor="middle" font-size="17">${n}</text>`;
      if (texto) g += `<rect class="marca-fondo" x="${xb + 36}" y="${(ya + yb) / 2 - 13}" width="${texto.length * 8.6 + 16}" height="26" rx="6"/><text x="${xb + 44}" y="${(ya + yb) / 2 + 6}" font-size="16">${texto}</text>`;
      return g + `</g>`;
    };
    c += rect("2026-11-18", 35, "2026-11-18", 47, "m1", "");
    c += rect("2026-11-19", 0, "2026-11-19", 19, "m1", "16 h con 7 buses «zombis»", 1);
    c += rect("2026-11-20", 1, "2026-11-20", 14, "m2", "", 2);
    c += rect("2026-11-23", 1, "2026-11-23", 15, "m2", "sin pico de la mañana", 2);
    for (const d of ["2026-11-12", "2026-11-13", "2026-11-17"]) c += rect(d, 10, d, 47, "m3", "");
    lienzo(el).innerHTML = svg(w, h, c);
    conTooltip(el);
  },
  paso(el, n) {
    for (const k of [1, 2, 3]) el.querySelectorAll(".m" + k).forEach((g) => gsap.to(g, { opacity: n >= k ? 1 : 0, duration: D(0.5) }));
    el.querySelectorAll(".celda").forEach((r) => {
      const util = ["2026-11-12", "2026-11-13", "2026-11-17"].includes(r.dataset.d);
      gsap.to(r, { opacity: n >= 3 && !util ? 0.3 : 1, duration: D(0.5) });
    });
  },
};

// ---------------- Cruce con el GTFS estático ----------------
const union = {
  pasos: 2,
  montar(el) {
    const f = datos.union_gtfs.filter((d) => d.dia !== "2026-11-11");
    const w = 1400, h = 470, x0 = 70, base = 400;
    const y = escala(0, 100, base, 30);
    const bw = (w - x0 - 20) / f.length;
    let c = `<line class="eje-linea" x1="${x0}" x2="${w}" y1="${base}" y2="${base}"/>`;
    for (const v of [25, 50, 75, 100]) c += `<line class="rejilla" x1="${x0}" x2="${w}" y1="${y(v)}" y2="${y(v)}"/><text x="${x0 - 10}" y="${y(v) + 5}" text-anchor="end" font-size="15">${v} %</text>`;
    f.forEach((d, i) => {
      const x = x0 + i * bw;
      const ww = (bw - 18) / 2;
      c += `<rect class="b-ruta" data-tip="${etqDia(d.dia)} · route_id en el GTFS de hoy: <b>${dec(d.ruta)} %</b>" x="${x + 6}" y="${y(d.ruta)}" width="${ww}" height="${base - y(d.ruta)}" rx="3" fill="var(--verde-tm)"/>`;
      c += `<rect class="b-trip" data-tip="${etqDia(d.dia)} · trip_id en el GTFS de hoy: <b>${dec(d.trip)} %</b>" x="${x + 6 + ww + 4}" y="${y(d.trip)}" width="${ww}" height="${base - y(d.trip)}" rx="3" fill="var(--tm-rojo)"/>`;
      c += `<text class="v-trip t-fuerte" x="${x + 6 + ww * 1.5 + 4}" y="${y(d.trip) - 8}" text-anchor="middle" font-size="15">${dec(d.trip)}</text>`;
      c += `<text x="${x + bw / 2}" y="${base + 26}" text-anchor="middle" font-size="16">${etqDia(d.dia)}</text>`;
    });
    lienzo(el).innerHTML = svg(w, h, c);
    conTooltip(el);
  },
  paso(el, n) {
    gsap.to(el.querySelectorAll(".b-ruta"), { opacity: n >= 2 ? 1 : 0, duration: D(0.6), stagger: D(0.03) });
    gsap.to(el.querySelectorAll(".b-trip, .v-trip"), { opacity: n >= 1 ? 1 : 0, duration: D(0.6), stagger: D(0.03) });
  },
};

// ---------------- Duplicados en la ventana del replay ----------------
const duplicados = {
  montar(el) {
    const r = datos.replay;
    const w = 760, h = 300;
    const x = escala(0, r.filas, 0, w - 20);
    lienzo(el).innerHTML = svg(w, h, `
      <text x="0" y="28" font-size="20" class="t-fuerte">Reportes leídos</text>
      <rect class="d-total" x="0" y="44" width="0" data-w="${x(r.filas)}" height="54" rx="6" fill="var(--gris)"/>
      <text x="16" y="79" font-size="22" style="fill:#fff" class="t-titulo">${miles(r.filas)}</text>
      <text x="0" y="148" font-size="20" class="t-fuerte">Reportes únicos (vehículo, timestamp)</text>
      <rect class="d-unico" x="0" y="164" width="0" data-w="${x(r.unicas)}" height="54" rx="6" fill="var(--tm-rojo)"/>
      <text x="16" y="199" font-size="22" style="fill:#fff" class="t-titulo">${miles(r.unicas)}</text>
      <text x="${x(r.unicas) + 14}" y="200" font-size="24" class="t-fuerte t-titulo">−${dec(r.duplicado_pct)} %</text>
      <text x="0" y="268" font-size="17">${r.capturas} capturas en 90 min · ${r.capturas_sin_nada} no traían ningún reporte nuevo</text>`);
  },
  entrar(el) {
    el.querySelectorAll("[data-w]").forEach((b, i) => gsap.fromTo(b, { attr: { width: 0 } }, { attr: { width: +b.dataset.w }, duration: D(1.1), delay: D(0.3 + i * 0.5), ease: "power3.out" }));
  },
};

// ---------------- Diagramas de cajas (archivador y pipeline) ----------------
let nDiagrama = 0;
function diagrama(nodos, flechas, { w = 1420, h = 520 } = {}) {
  const id = "pt" + ++nDiagrama; // un marcador por diagrama
  // Punta de flecha rellena en rojo UD, como el estilo «flecha» de la plantilla (-{Latex}).
  let c = `<defs><marker id="${id}" viewBox="0 0 10 10" refX="6" refY="5" markerUnits="userSpaceOnUse" markerWidth="16" markerHeight="16" orient="auto"><path d="M0,0.5 L10,5 L0,9.5 z" fill="#ED3237"/></marker></defs>`;
  for (const [a, b, clase = ""] of flechas) {
    const A = nodos.find((n) => n.id === a), B = nodos.find((n) => n.id === b);
    const lado = B.x >= A.x + A.w - 1; // B a la derecha de A: flecha horizontal; si no, vertical
    let d;
    if (lado) {
      const [x1, y1, x2, y2] = [A.x + A.w, A.y + A.h / 2, B.x - 10, B.y + B.h / 2];
      d = `M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`;
    } else {
      const abajo = B.y > A.y;
      const [x1, y1, x2, y2] = [A.x + A.w / 2, A.y + (abajo ? A.h : 0), B.x + B.w / 2, B.y + (abajo ? -10 : B.h + 10)];
      d = `M${x1},${y1} C${x1},${(y1 + y2) / 2} ${x2},${(y1 + y2) / 2} ${x2},${y2}`;
    }
    c += `<path class="flecha-d ${clase}" data-g="${b}" d="${d}" marker-end="url(#${id})"/>`;
  }
  for (const n of nodos) {
    c += `<g class="nodo ${n.clase || ""}" data-n="${n.id}"><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="8"/>`;
    if (n.etq) c += `<text x="${n.x + 18}" y="${n.y + 30}" font-size="17" class="nodo-etq">${n.etq}</text>`;
    n.t.forEach((l, i) => (c += `<text x="${n.x + 18}" y="${n.y + (n.etq ? 58 : 36) + i * 26}" font-size="${i === 0 ? 21 : 17}" class="${i === 0 ? "t-fuerte" : ""}">${l}</text>`));
    c += `</g>`;
  }
  return svg(w, h, c);
}
function enfocar(el, grupos, n) {
  const activos = new Set(grupos.slice(0, n + 1).flat());
  const foco = new Set(grupos[n] || []);
  el.querySelectorAll(".nodo, .flecha-d").forEach((g) => {
    const id = g.dataset.n || g.dataset.g;
    gsap.to(g, { opacity: activos.has(id) ? (foco.has(id) || n === grupos.length - 1 ? 1 : 0.45) : 0.08, duration: D(0.5) });
  });
}

const archivador = {
  pasos: 3,
  grupos: [["cron", "flock"], ["curl", "cmp", "gz", "raw"], ["git"], ["ciego"]],
  montar(el) {
    const N = [
      { id: "cron", x: 0, y: 40, w: 230, h: 120, etq: "cron · cada minuto", t: ["Lo revive", "si se cae o reinicia"] },
      { id: "flock", x: 0, y: 220, w: 230, h: 120, etq: "flock -n", t: ["Una sola copia", "del proceso"] },
      { id: "curl", x: 300, y: 130, w: 240, h: 120, etq: "curl · cada 10 s", t: ["positions.pb", "2 reintentos"] },
      { id: "cmp", x: 600, y: 130, w: 240, h: 120, etq: "cmp con .last", t: ["¿Cambió el", "archivo?"] },
      { id: "gz", x: 900, y: 130, w: 230, h: 120, etq: "gzip → .part → mv", t: ["Escritura", "atómica"] },
      { id: "raw", x: 1190, y: 130, w: 230, h: 120, etq: "raw/AAAA/MM/DD", t: ["~128 KB", "por captura"] },
      { id: "git", x: 1190, y: 330, w: 230, h: 120, etq: "00:30 · git push", t: ["GitHub", "una vez al día"], clase: "nodo-git" },
      { id: "ciego", x: 520, y: 330, w: 400, h: 150, etq: "punto ciego", t: ["cmp compara bytes, no buses:", "un feed con 7 buses de hace", "semanas también «cambió»"], clase: "nodo-alerta" },
    ];
    const F = [["cron", "flock"], ["flock", "curl"], ["curl", "cmp"], ["cmp", "gz"], ["gz", "raw"], ["raw", "git"], ["cmp", "ciego", "alerta"]];
    lienzo(el).innerHTML = diagrama(N, F, { h: 500 });
  },
  entrar(el, n) { this.paso(el, n); },
  paso(el, n) { enfocar(el, this.grupos, n); },
};

const pipeline = {
  pasos: 4,
  grupos: [["pb"], ["leer", "parse"], ["pq", "grp"], ["shapes", "mm"], ["agg", "web"]],
  montar(el) {
    const N = [
      { id: "pb", x: 0, y: 170, w: 200, h: 150, etq: "entrada", t: ["28.958", ".pb.gz", "4,07 GB"] },
      { id: "leer", x: 250, y: 60, w: 260, h: 120, etq: "Ray Data", t: ["read_binary_files", "un bloque por archivo"] },
      { id: "parse", x: 250, y: 260, w: 260, h: 150, etq: "map_batches · tareas", t: ["protobuf → Arrow", "dedup (bus, ts)", "filtro de zombis"] },
      { id: "pq", x: 560, y: 60, w: 250, h: 120, etq: "Parquet", t: ["por día y por", "hash(vehicle_id) % 64"] },
      { id: "grp", x: 560, y: 260, w: 250, h: 150, etq: "@ray.remote · partición", t: ["ordenar y deduplicar", "Δt, Δd, velocidad", "una tarea por parte"] },
      { id: "shapes", x: 860, y: 60, w: 260, h: 120, etq: "ray.put()", t: ["shapes.txt una vez", "en el object store"] },
      { id: "mm", x: 860, y: 260, w: 260, h: 150, etq: "map-matching", t: ["punto → tramo", "de su ruta", "kernel CPU caro"], clase: "nodo-caro" },
      { id: "agg", x: 1170, y: 160, w: 250, h: 130, etq: "agregados", t: ["tramo × hora:", "velocidad, headway"] },
      { id: "web", x: 1170, y: 340, w: 250, h: 110, etq: "salida", t: ["bunching · replay", "esta presentación"] },
    ];
    const F = [["pb", "leer"], ["leer", "parse"], ["parse", "pq"], ["pq", "grp"], ["grp", "mm"], ["shapes", "mm"], ["mm", "agg"], ["agg", "web"]];
    lienzo(el).innerHTML = diagrama(N, F, { h: 470 });
    this.textos = el.querySelectorAll("[data-concepto]");
  },
  entrar(el, n) { this.paso(el, n); },
  paso(el, n) {
    enfocar(el, this.grupos, n);
    this.textos.forEach((t) => gsap.to(t, { autoAlpha: +t.dataset.concepto === n ? 1 : 0, duration: D(0.4) }));
  },
};

// ---------------- Workers: el ETL como paralelismo de datos ----------------
// Diagrama de Gantt con un eje de tiempo fijo: el mismo trabajo (48 lotes) repartido entre 1, 4 y 16 workers.
// La línea «ahora» avanza a la misma velocidad en los tres casos, así que con más workers termina antes.
const workers = {
  pasos: 2,
  LOTES: 48,
  CONF: [1, 4, 16],
  montar(el) {
    const w = 1400, h = 548;
    const G = { x0: 250, x1: 1110, top: 52, alto: 384 };
    G.tw = (G.x1 - G.x0) / this.LOTES;
    let c = `<text x="0" y="24" font-size="17" class="t-titulo t-fuerte">Cola · ${this.LOTES} lotes</text>`;
    for (let i = 0; i < this.LOTES; i++) c += `<rect class="w-lote" x="${(i % 6) * 26}" y="${G.top + Math.floor(i / 6) * 26}" width="20" height="20" rx="4"/>`;
    c += `<text x="${G.x0}" y="24" font-size="17" class="t-titulo t-fuerte">Workers trabajando en paralelo</text>`;
    c += `<g class="carriles"></g><g class="tareas"></g>`;
    const ya = G.top + G.alto + 14;
    c += `<line class="eje-linea" x1="${G.x0}" x2="${G.x1}" y1="${ya}" y2="${ya}"/>`;
    for (const n of this.CONF) {
      const x = G.x0 + (G.x1 - G.x0) / n;
      c += `<g class="w-meta-g" data-meta="${n}"><line class="w-meta" x1="${x}" x2="${x}" y1="${G.top - 8}" y2="${ya}"/><text x="${x}" y="${ya + 24}" text-anchor="middle" font-size="16" class="t-fuerte">${n === 1 ? "T" : "T/" + n}</text></g>`;
    }
    c += `<text x="${G.x0}" y="${ya + 24}" font-size="16" text-anchor="middle">0</text><text x="${G.x1}" y="${ya + 46}" text-anchor="end" font-size="15">tiempo →</text>`;
    c += `<line class="w-ahora" x1="${G.x0}" x2="${G.x0}" y1="${G.top - 12}" y2="${ya}"/>`;
    const rx = 1170;
    c += `<text x="${rx}" y="24" font-size="17" class="t-titulo t-fuerte">Tiempo total</text>`;
    this.CONF.forEach((n, k) => {
      const y = G.top + 20 + k * 92;
      c += `<g class="w-res" data-n="${n}" opacity="0"><text x="${rx}" y="${y}" font-size="17" class="t-fuerte">${n} worker${n > 1 ? "s" : ""}</text>`;
      c += `<rect class="w-barra" x="${rx}" y="${y + 12}" width="0" data-w="${220 / n}" height="22" rx="4"/>`;
      c += `<text x="${rx + 220 / n + 10}" y="${y + 29}" font-size="16">${n === 1 ? "T" : "T/" + n}</text></g>`;
    });
    c += `<text class="reloj-w t-titulo t-fuerte" x="${G.x0}" y="${h - 4}" font-size="22"></text>`;
    lienzo(el).innerHTML = svg(w, h, c);
    this.G = G;
  },
  correr(el, k) {
    this.tl?.kill();
    const nw = this.CONF[k], G = this.G, N = this.LOTES;
    const rondas = Math.ceil(N / nw);
    const rh = Math.min(64, G.alto / nw);
    let carr = "", tar = "";
    for (let r = 0; r < nw; r++) {
      const y = G.top + r * rh;
      carr += `<rect class="w-carril" x="${G.x0}" y="${y + 1}" width="${G.x1 - G.x0}" height="${rh - 2}" rx="3"/>`;
      if (nw <= 4 || r % 3 === 0 || r === nw - 1) carr += `<text x="${G.x0 - 12}" y="${y + rh / 2 + 5}" text-anchor="end" font-size="${nw > 4 ? 13 : 16}">worker ${r + 1}</text>`;
    }
    for (let i = 0; i < N; i++) {
      const r = i % nw, j = Math.floor(i / nw);
      tar += `<rect class="w-tarea" data-j="${j}" x="${G.x0 + j * G.tw + 1}" y="${G.top + r * rh + 3}" width="0" height="${rh - 6}" rx="2"/>`;
    }
    el.querySelector(".carriles").innerHTML = carr;
    el.querySelector(".tareas").innerHTML = tar;
    const tareas = [...el.querySelectorAll(".w-tarea")];
    const lotes = [...el.querySelectorAll(".w-lote")];
    const ahora = el.querySelector(".w-ahora");
    el.querySelector(".reloj-w").textContent = `${nw} worker${nw > 1 ? "s" : ""} · ${rondas} ronda${rondas > 1 ? "s" : ""} de ${nw} tarea${nw > 1 ? "s" : ""} a la vez · tiempo ideal ${nw === 1 ? "T" : "T/" + nw}`;
    el.querySelectorAll(".w-meta-g").forEach((m) => gsap.to(m, { opacity: +m.dataset.meta === nw ? 1 : 0.3, duration: D(0.3) }));
    // Resumen: las configuraciones anteriores quedan fijas; la actual crece con el tiempo.
    const res = [...el.querySelectorAll(".w-res")];
    res.forEach((g, kk) => {
      const b = g.querySelector(".w-barra");
      gsap.to(g, { opacity: kk <= k ? 1 : 0, duration: D(0.4) });
      b.classList.toggle("previa", kk < k);
      if (kk < k) b.setAttribute("width", +b.dataset.w);
    });
    const barra = res[k].querySelector(".w-barra");
    const st = { t: 0 };
    const pintar = () => {
      const t = st.t;
      tareas.forEach((r) => {
        const f = Math.max(0, Math.min(1, t - +r.dataset.j));
        r.setAttribute("width", Math.max(0, f * (G.tw - 2)));
        r.classList.toggle("w-hecha", f >= 1);
      });
      const empezadas = Math.min(N, Math.ceil(t) * nw);
      lotes.forEach((l, i) => l.setAttribute("opacity", i < empezadas ? 0.15 : 1));
      const x = G.x0 + t * G.tw;
      ahora.setAttribute("x1", x);
      ahora.setAttribute("x2", x);
      barra.setAttribute("width", (+barra.dataset.w * t) / rondas);
    };
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 2.4, delay: 0.4 });
    tl.to(st, { t: rondas, duration: rondas * 0.24, ease: "none", onUpdate: pintar });
    if (reducido) { st.t = rondas; tl.pause(); }
    this.tl = tl;
    pintar();
  },
  entrar(el, n) { this.paso(el, n); },
  salir() { this.tl?.pause(); },
  paso(el, n) { this.correr(el, Math.min(n, 2)); },
};

// ---------------- Speedup: medido si existe resultados/benchmark.json; si no, la teoría ----------------
const speedup = {
  pasos: 2,
  montar(el) {
    const b = datos.benchmark;
    const medido = b?.ray?.length && b.secuencial;
    const MAXN = medido ? Math.max(8, ...b.ray.map((r) => r.workers)) : 32;
    const w = 860, h = 560, x0 = 70, y0 = 20, base = 500;
    const x = escala(0, MAXN, x0, w - 20), y = escala(0, MAXN, base, y0);
    const marcas = MAXN <= 8 ? [1, 2, 4, 6, 8] : [1, 4, 8, 16, 24, 32];
    let c = `<line class="eje-linea" x1="${x0}" x2="${w - 20}" y1="${base}" y2="${base}"/><line class="eje-linea" x1="${x0}" x2="${x0}" y1="${y0}" y2="${base}"/>`;
    for (const v of marcas) c += `<text x="${x(v)}" y="${base + 26}" text-anchor="middle" font-size="19">${v}</text><line class="rejilla" x1="${x0}" x2="${w - 20}" y1="${y(v)}" y2="${y(v)}"/><text x="${x0 - 10}" y="${y(v) + 5}" text-anchor="end" font-size="19">${v}×</text>`;
    c += `<text x="${(x0 + w) / 2}" y="${base + 54}" text-anchor="middle" font-size="20">workers (núcleos)</text>`;
    const linea = (f, clase, etq) => {
      const pts = Array.from({ length: MAXN * 4 }, (_, i) => 1 + (i * (MAXN - 1)) / (MAXN * 4 - 1)).map((n) => [x(n), y(f(n))]);
      const [lx, ly] = pts[pts.length - 1];
      return `<g class="${clase}"><path d="M${pts.join(" L")}" fill="none"/><text x="${lx - 6}" y="${ly - 12}" text-anchor="end" font-size="20" class="t-fuerte halo">${etq}</text></g>`;
    };
    const amdahl = (p) => (n) => 1 / (1 - p + p / n);
    c += linea((n) => n, "s-ideal", "ideal (lineal)");
    if (medido) {
      // Speedup contra la línea base honesta: el mismo código en un solo proceso, sin Ray.
      const T0 = b.secuencial.total, pts = b.ray.map((r) => [x(r.workers), y(T0 / r.total), r]);
      const ult = b.ray[b.ray.length - 1], S = T0 / ult.total, n = ult.workers;
      const p = Math.min(0.999, Math.max(0, (1 - 1 / S) / (1 - 1 / n)));
      this.p = p;
      c += linea(amdahl(p), "s-a95", `Amdahl con p = ${dec(p, 2)} (estimada)`);
      c += `<g class="s-medido"><path d="M${pts.map((q) => q.slice(0, 2)).join(" L")}" fill="none"/>${pts.map(([px, py, r]) => `<circle cx="${px}" cy="${py}" r="8" data-tip="${r.workers} worker${r.workers > 1 ? "s" : ""} · ${dec(r.total)} s · speedup <b>${dec(T0 / r.total)}×</b> · eficiencia ${Math.round((100 * T0) / r.total / r.workers)} %"/>`).join("")}<text x="${pts[pts.length - 1][0] - 14}" y="${pts[pts.length - 1][1] + 46}" text-anchor="end" font-size="20" class="t-fuerte halo">medido: ${dec(S)}×</text></g>`;
      const tabla = el.querySelector("[data-tabla-bench]");
      if (tabla) {
        const fila = (t, a, bb) => `<tr><td>${t}</td><td>${dec(a)} s</td><td>${dec(bb)} s</td><td><b>${dec(a / bb)}×</b></td></tr>`;
        tabla.innerHTML = `<table class="tabla-bench"><thead><tr><th>etapa</th><th>secuencial</th><th>Ray · ${n}</th><th>speedup</th></tr></thead><tbody>
          ${fila("ETL (protobuf → Parquet)", b.secuencial.etl, ult.etl)}${fila("trayectorias + map-matching", b.secuencial.trayectorias, ult.trayectorias)}${fila("headways", b.secuencial.headways, ult.headways)}${fila("<b>total</b>", T0, ult.total)}</tbody></table>
          <p class="pie">${b.maquina} · ${miles(b.archivos)} capturas (${miles(b.mb)} MB) del ${b.dia_etq}</p>`;
      }
    } else {
      c += linea(amdahl(0.95), "s-a95", "Amdahl p = 0,95");
      c += linea(amdahl(0.8), "s-a80", "Amdahl p = 0,80");
      c += `<g class="s-pendiente"><rect x="${x0 + 30}" y="${y0 + 10}" width="340" height="42" rx="21"/><text x="${x0 + 50}" y="${y0 + 37}" font-size="20">medición pendiente · curva teórica</text></g>`;
    }
    lienzo(el).innerHTML = svg(w, h + 40, c);
    conTooltip(el);
  },
  paso(el, n) {
    gsap.to(el.querySelectorAll(".s-a95, .s-a80"), { opacity: n >= 1 ? 1 : 0, duration: D(0.5) });
    gsap.to(el.querySelectorAll(".s-medido, [data-tabla-bench]"), { opacity: n >= 2 ? 1 : 0, duration: D(0.5) });
  },
};

// ---------------- Velocidad comercial por hora y tipo de servicio (salida del pipeline) ----------------
const TIPOS_V = [["troncal", "var(--tm-rojo)", "Troncal"], ["dual", "var(--amarillo)", "Dual"], ["zonal", "var(--azul-tm)", "Zonal"], ["alimentador", "var(--verde-tm)", "Alimentador"]];
const velhora = {
  pasos: 1,
  montar(el) {
    const m = datos.metricas;
    if (!m) { lienzo(el).innerHTML = `<p class="muted">Sin resultados del pipeline todavía.</p>`; return; }
    const V = m.velocidad_hora_tipo;
    const w = 860, h = 520, x0 = 64, base = 450, H0 = 5, H1 = 22;
    const x = escala(H0, H1, x0, w - 150), y = escala(0, 30, base, 20);
    let c = `<line class="eje-linea" x1="${x0}" x2="${w - 150}" y1="${base}" y2="${base}"/>`;
    for (const v of [10, 20, 30]) c += `<line class="rejilla" x1="${x0}" x2="${w - 150}" y1="${y(v)}" y2="${y(v)}"/><text x="${x0 - 10}" y="${y(v) + 5}" text-anchor="end" font-size="19">${v}</text>`;
    c += `<text x="${x0 - 10}" y="${y(30) - 14}" text-anchor="end" font-size="18">km/h</text>`;
    for (let hh = 6; hh <= 22; hh += 2) c += `<text x="${x(hh)}" y="${base + 26}" text-anchor="middle" font-size="19" class="t-mono">${hh}h</text>`;
    c += `<rect class="franja-pico" x="${x(6)}" y="20" width="${x(8) - x(6)}" height="${base - 20}"/><text x="${(x(6) + x(8)) / 2}" y="38" text-anchor="middle" font-size="18">pico</text>`;
    // Etiquetas al final de cada línea, separadas al menos 20 px para que no se monten.
    const finales = TIPOS_V.map(([k]) => Object.entries(V[k] || {}).filter(([hh, v]) => +hh >= H0 && +hh <= H1 && v != null).sort((a, b) => a[0] - b[0]).pop())
      .map((u, i) => (u ? { i, y: y(u[1]) + 5 } : null)).filter(Boolean).sort((a, b) => a.y - b.y);
    for (let j = 1; j < finales.length; j++) finales[j].y = Math.max(finales[j].y, finales[j - 1].y + 24);
    const yEtq = Object.fromEntries(finales.map((f) => [f.i, f.y]));
    for (const [ti, [k, col, nom]] of TIPOS_V.entries()) {
      const pts = Object.entries(V[k] || {}).map(([hh, v]) => [+hh, v]).filter(([hh, v]) => hh >= H0 && hh <= H1 && v != null).sort((a, b) => a[0] - b[0]);
      if (!pts.length) continue;
      const d = "M" + pts.map(([hh, v]) => `${x(hh)},${y(v)}`).join(" L");
      const [uh, uv] = pts[pts.length - 1];
      c += `<g class="v-linea" style="--col:${col}"><path d="${d}" fill="none" stroke="${col}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>${pts.map(([hh, v]) => `<circle cx="${x(hh)}" cy="${y(v)}" r="9" fill="transparent" data-tip="${nom} · ${hh}:00 · <b>${dec(v)} km/h</b>"/>`).join("")}<text x="${x(uh) + 10}" y="${yEtq[ti]}" font-size="20" class="t-fuerte halo" fill="${col}">${nom}</text></g>`;
    }
    lienzo(el).innerHTML = svg(w, h, c);
    // Paso 1: velocidad comercial de cada día (6–20 h), hábiles vs fin de semana.
    const dias = (m.velocidad_dia || []).filter((d) => d.v_comercial != null && !["2026-11-11", "2026-11-24"].includes(d.dia));
    const zona = el.querySelector("[data-por-dia]");
    if (zona && dias.length) {
      const max = Math.max(...dias.map((d) => d.v_comercial));
      zona.innerHTML = dias.map((d) => `<div class="vd${finde(d.dia) ? " finde" : ""}" data-tip="${etqDia(d.dia)} · <b>${dec(d.v_comercial)} km/h</b>"><span>${etqDia(d.dia)}</span><i style="width:${(100 * d.v_comercial) / max}%"></i><b>${dec(d.v_comercial)}</b></div>`).join("");
    }
    conTooltip(el);
  },
  paso(el, n) {
    gsap.to(el.querySelectorAll("[data-por-dia]"), { autoAlpha: n >= 1 ? 1 : 0, duration: D(0.5) });
  },
};

// ---------------- Anatomía de un mensaje GTFS-RT ----------------
const mensaje = {
  pasos: 3,
  paso(el, n) {
    el.querySelector(".codigo")?.classList.toggle("con-foco", n > 0);
    el.querySelectorAll("[data-campo]").forEach((l) => l.classList.toggle("resaltado", +l.dataset.campo === n));
  },
  entrar(el, n) { this.paso(el, n); },
};

export const graficos = { porDia, calor, union, duplicados, archivador, pipeline, workers, speedup, mensaje, velhora };
