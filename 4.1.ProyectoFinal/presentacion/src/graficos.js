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
const tmin = (s) => (s < 120 ? `${Math.round(s)} s` : `${Math.round(s / 60)} min`);

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

// ---------------- Velocidad mediana por hora y sistema (días hábiles) ----------------
const TIPOS_V = [["troncal", "var(--tm-rojo)", "Troncal"], ["dual", "var(--amarillo)", "Dual"], ["zonal", "var(--azul-tm)", "Zonal"], ["alimentador", "var(--verde-tm)", "Alimentador"]];
const velhora = {
  montar(el) {
    const V = datos.resumen.v_p50_por_hora;
    const w = 860, h = 520, x0 = 64, base = 450, H0 = 5, H1 = 23;
    const x = escala(H0, H1, x0, w - 150), y = escala(0, 32, base, 20);
    let c = `<line class="eje-linea" x1="${x0}" x2="${w - 150}" y1="${base}" y2="${base}"/>`;
    for (const [a, b] of [[6, 8], [17, 19]]) c += `<rect class="franja-pico" x="${x(a)}" y="20" width="${x(b) - x(a)}" height="${base - 20}"/><text x="${(x(a) + x(b)) / 2}" y="38" text-anchor="middle" font-size="18">pico</text>`;
    for (const v of [10, 20, 30]) c += `<line class="rejilla" x1="${x0}" x2="${w - 150}" y1="${y(v)}" y2="${y(v)}"/><text x="${x0 - 10}" y="${y(v) + 5}" text-anchor="end" font-size="19">${v}</text>`;
    c += `<text x="${x0 - 10}" y="${y(32) - 4}" text-anchor="end" font-size="18">km/h</text>`;
    for (let hh = 6; hh <= 22; hh += 2) c += `<text x="${x(hh)}" y="${base + 26}" text-anchor="middle" font-size="19" class="t-mono">${hh}h</text>`;
    // Etiquetas al final de cada línea, separadas al menos 24 px para que no se monten.
    const serie = (k) => Object.entries(V[k] || {}).map(([hh, v]) => [+hh, v]).filter(([hh, v]) => hh >= H0 && hh <= H1 && v != null).sort((a, b) => a[0] - b[0]);
    const finales = TIPOS_V.map(([k], i) => ({ i, y: y(serie(k).at(-1)?.[1] ?? 0) + 5 })).sort((a, b) => a.y - b.y);
    for (let j = 1; j < finales.length; j++) finales[j].y = Math.max(finales[j].y, finales[j - 1].y + 24);
    const yEtq = Object.fromEntries(finales.map((f) => [f.i, f.y]));
    for (const [ti, [k, col, nom]] of TIPOS_V.entries()) {
      const pts = serie(k);
      if (!pts.length) continue;
      const [uh] = pts[pts.length - 1];
      c += `<g class="v-linea"><path d="M${pts.map(([hh, v]) => `${x(hh)},${y(v)}`).join(" L")}" fill="none" stroke="${col}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>${pts.map(([hh, v]) => `<circle cx="${x(hh)}" cy="${y(v)}" r="9" fill="transparent" data-tip="${nom} · ${hh}:00 · <b>${dec(v)} km/h</b>"/>`).join("")}<text x="${x(uh) + 10}" y="${yEtq[ti]}" font-size="20" class="t-fuerte halo" fill="${col}">${nom}</text></g>`;
    }
    lienzo(el).innerHTML = svg(w, h, c);
    conTooltip(el);
  },
};

// ---------------- Mapa de calor: buses en servicio por hora y día ----------------
const calor = {
  pasos: 2,
  montar(el) {
    const { dias, valores, buses_antes, buses_despues } = datos.calidad;
    const w = 1480, h = 590, x0 = 80, y0 = 30, cw = (w - x0 - 330) / 24, ch = (h - y0 - 20) / dias.length;
    const max = Math.max(...valores.flat().filter((v) => v != null));
    let c = `<defs><pattern id="rayas" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="8" height="8" fill="var(--superficie)"/><line x1="0" y1="0" x2="0" y2="8" stroke="var(--gris)" stroke-opacity=".55" stroke-width="2.5"/></pattern></defs>`;
    for (let hh = 0; hh <= 24; hh += 3) c += `<text x="${x0 + hh * cw}" y="${y0 - 12}" text-anchor="middle" font-size="15" class="t-mono">${String(hh).padStart(2, "0")}h</text>`;
    dias.forEach((d, r) => {
      c += `<text x="${x0 - 12}" y="${y0 + r * ch + ch / 2 + 5}" text-anchor="end" font-size="16" class="${finde(d) ? "" : "t-fuerte"}">${etqDia(d)}</text>`;
      valores[r].forEach((v, s) => {
        const fill = v == null ? "url(#rayas)" : `color-mix(in oklab, var(--celda-tinta) ${Math.round(4 + 88 * (v / max) ** 0.9)}%, var(--celda-base))`;
        c += `<rect class="celda" data-d="${d}" x="${x0 + s * cw + 1}" y="${y0 + r * ch + 1}" width="${cw - 2}" height="${ch - 2}" rx="2" fill="${fill}" data-tip="${etqDia(d)} · ${String(s).padStart(2, "0")}:00 · ${v == null ? "<b>sin reportes</b>" : `<b>${miles(v)}</b> buses distintos`}"/>`;
      });
    });
    // Cada marca lleva una «bala» numerada que remite al texto ①② de arriba.
    const rect = (d0, d1, clase, texto, n = 0) => {
      const r0 = dias.indexOf(d0), r1 = dias.indexOf(d1);
      const xa = x0, ya = y0 + r0 * ch, xb = x0 + 24 * cw, yb = y0 + (r1 + 1) * ch;
      let g = `<g class="marca-calor ${clase}"><rect x="${xa - 1}" y="${ya - 1}" width="${xb - xa + 2}" height="${yb - ya + 2}" rx="5"/>`;
      if (n) g += `<circle class="bala" cx="${xb + 20}" cy="${(ya + yb) / 2}" r="14"/><text class="bala-n" x="${xb + 20}" y="${(ya + yb) / 2 + 6}" text-anchor="middle" font-size="17">${n}</text>`;
      if (texto) g += `<rect class="marca-fondo" x="${xb + 36}" y="${(ya + yb) / 2 - 13}" width="${texto.length * 8.6 + 16}" height="26" rx="6"/><text x="${xb + 44}" y="${(ya + yb) / 2 + 6}" font-size="16">${texto}</text>`;
      return g + `</g>`;
    };
    c += rect("2026-11-18", dias.at(-1), "m1", `${miles(buses_antes)} → ${miles(buses_despues)} buses`, 1);
    c += rect("2026-11-14", "2026-11-16", "m2", "sáb · dom · festivo", 2);
    c += rect("2026-11-21", "2026-11-22", "m2", "sáb · dom", 2);
    lienzo(el).innerHTML = svg(w, h, c);
    conTooltip(el);
  },
  paso(el, n) {
    for (const k of [1, 2]) el.querySelectorAll(".m" + k).forEach((g) => gsap.to(g, { opacity: n === k ? 1 : 0, duration: D(0.5) }));
    el.querySelectorAll(".celda").forEach((r) => gsap.to(r, { opacity: n === 2 && !finde(r.dataset.d) ? 0.3 : 1, duration: D(0.5) }));
  },
};

// ---------------- Diagrama de cajas del pipeline ----------------
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

const pipeline = {
  pasos: 4,
  grupos: [["pb"], ["etl", "pq"], ["geos", "rec"], ["tramos", "conf"], ["web"]],
  montar(el) {
    const c = datos.completo, t = c.tiempos;
    const N = [
      { id: "pb", x: 0, y: 160, w: 200, h: 150, etq: "entrada", t: [`${miles(c.archivos)}`, ".pb.gz", `${dec(c.gb)} GB · ${c.dias} días`] },
      { id: "etl", x: 250, y: 30, w: 270, h: 150, etq: `Ray Data · ${tmin(t.etl)}`, t: ["read_binary_files", "map_batches: protobuf", "→ Arrow, sin zombis"] },
      { id: "pq", x: 250, y: 260, w: 270, h: 130, etq: "Parquet", t: [`${dec(c.posiciones_m)} M posiciones`, "día × crc32(bus) % 64"] },
      { id: "geos", x: 570, y: 30, w: 260, h: 120, etq: "ray.put()", t: ["shapes del GTFS", "una vez, object store"] },
      { id: "rec", x: 570, y: 220, w: 260, h: 190, etq: `Ray Core · ${tmin(t.recorridos)}`, t: ["tarea por día × parte", "map-matching según", "el sentido de marcha", `${dec(c.recorridos_m)} M recorridos`], clase: "nodo-caro" },
      { id: "tramos", x: 880, y: 30, w: 260, h: 150, etq: `tramos · ${tmin(t.tramos)}`, t: ["tarea por cubo de rutas", "v p20/p50/p80", "retraso vs flujo libre"] },
      { id: "conf", x: 880, y: 250, w: 260, h: 160, etq: `confiabilidad · ${tmin(t.confiabilidad)}`, t: ["tarea por cubo de rutas", "p50/p95 entre paradas", "walk-forward, horario"] },
      { id: "web", x: 1190, y: 160, w: 230, h: 130, etq: "salida", t: ["ranking · mapa", "esta presentación"] },
    ];
    const F = [["pb", "etl"], ["etl", "pq"], ["pq", "rec"], ["geos", "rec"], ["rec", "tramos"], ["rec", "conf"], ["tramos", "web"], ["conf", "web"]];
    lienzo(el).innerHTML = diagrama(N, F, { h: 430 });
    this.textos = el.querySelectorAll("[data-concepto]");
  },
  entrar(el, n) { this.paso(el, n); },
  paso(el, n) {
    enfocar(el, this.grupos, n);
    this.textos.forEach((t) => gsap.to(t, { autoAlpha: +t.dataset.concepto === n ? 1 : 0, duration: D(0.4) }));
  },
};

// ---------------- Speedup: medido si hay corridas «fuerte-local»; si no, la teoría ----------------
const ETAPAS = { etl: "ETL (protobuf → Parquet)", recorridos: "recorridos + map-matching", tramos: "tramos", confiabilidad: "confiabilidad" };
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
    const tabla = el.querySelector("[data-tabla-bench]");
    if (medido) {
      // Speedup contra la línea base honesta: el mismo código en un solo proceso, sin Ray.
      const T0 = b.secuencial.total, pts = b.ray.map((r) => [x(r.workers), y(T0 / r.total), r]);
      const ult = b.ray[b.ray.length - 1], S = T0 / ult.total, n = ult.workers;
      if (n > 1) {
        const p = Math.min(0.999, Math.max(0, (1 - 1 / S) / (1 - 1 / n)));
        c += linea(amdahl(p), "s-a95", `Amdahl con p = ${dec(p, 2)} (estimada)`);
      }
      c += `<g class="s-medido"><path d="M${pts.map((q) => q.slice(0, 2)).join(" L")}" fill="none"/>${pts.map(([px, py, r]) => `<circle cx="${px}" cy="${py}" r="8" data-tip="${r.workers} worker${r.workers > 1 ? "s" : ""} · ${dec(r.total)} s · speedup <b>${dec(T0 / r.total)}×</b> · eficiencia ${Math.round((100 * T0) / r.total / r.workers)} %"/>`).join("")}<text x="${pts[pts.length - 1][0] - 14}" y="${pts[pts.length - 1][1] + 46}" text-anchor="end" font-size="20" class="t-fuerte halo">medido: ${dec(S)}×</text></g>`;
      if (tabla) {
        const fila = (t, a, bb) => `<tr><td>${t}</td><td>${dec(a)} s</td><td>${dec(bb)} s</td><td><b>${dec(a / bb)}×</b></td></tr>`;
        tabla.innerHTML = `<table class="tabla-bench"><thead><tr><th>etapa</th><th>secuencial</th><th>Ray · ${n}</th><th>speedup</th></tr></thead><tbody>
          ${b.etapas.filter((k) => ult[k] != null).map((k) => fila(ETAPAS[k] || k, b.secuencial[k], ult[k])).join("")}${fila("<b>total</b>", T0, ult.total)}</tbody></table>
          <p class="pie">${b.maquina} · ${miles(b.archivos)} capturas (${miles(b.mb)} MB) del ${b.dia_etq}</p>`;
      }
    } else {
      c += linea(amdahl(0.95), "s-a95", "Amdahl p = 0,95");
      c += linea(amdahl(0.8), "s-a80", "Amdahl p = 0,80");
      c += `<g class="s-pendiente"><rect x="${x0 + 30}" y="${y0 + 10}" width="340" height="42" rx="21"/><text x="${x0 + 50}" y="${y0 + 37}" font-size="20">medición pendiente · curva teórica</text></g>`;
      if (tabla) tabla.innerHTML = `<p class="pie"><span class="sello pendiente">en curso</span> La corrida de escalamiento fuerte (secuencial y Ray con 1, 2, 4 y 8 workers sobre un día hábil) todavía no termina.</p>`;
    }
    lienzo(el).innerHTML = svg(w, h + 40, c);
    conTooltip(el);
  },
  paso(el, n) {
    gsap.to(el.querySelectorAll(".s-a95, .s-a80"), { opacity: n >= 1 ? 1 : 0, duration: D(0.5) });
    gsap.to(el.querySelectorAll(".s-medido, [data-tabla-bench]"), { opacity: n >= 2 ? 1 : 0, duration: D(0.5) });
  },
};

// ---------------- Ranking de celdas por bus-horas de retraso, con su ubicación ----------------
// Izquierda: las 10 primeras con su intervalo del 95 % (bootstrap por días). Derecha: las 20 primeras sobre las troncales.
function ranking(clave) {
  return {
    pasos: 1,
    montar(el) {
      const R = datos.ranking[clave];
      const w = 1420, h = 560, filas = R.slice(0, 10), alto = 54;
      const xb0 = 430, xb1 = 840;
      const max = Math.max(...filas.map((f) => f.ic[1]));
      const xv = escala(0, max, xb0, xb1);
      let c = `<text x="0" y="18" font-size="16" class="t-fuerte">celda · rutas · velocidad en el pico</text><text x="${xb0}" y="18" font-size="16" class="t-fuerte">bus-horas por día hábil</text>`;
      filas.forEach((f, i) => {
        const y = 40 + i * alto;
        const tip = `#${f.puesto} · <b>${dec(f.h)} bus-h/día</b> (IC 95 % ${dec(f.ic[0])}–${dec(f.ic[1])}) · ${f.rutas} rutas · ${f.sis}${f.v != null ? ` · ${dec(f.v)} km/h en el pico` : ""}`;
        c += `<g data-tip="${tip}"><text x="0" y="${y + 20}" font-size="19" class="t-fuerte">#${f.puesto} · ${f.rutas} rutas${f.v != null ? ` · ${dec(f.v)} km/h` : ""}</text>`;
        c += `<text x="0" y="${y + 42}" font-size="15" class="t-mono">${f.top}</text>`;
        c += `<rect class="r-barra" x="${xb0}" y="${y + 8}" width="0" data-w="${xv(f.h) - xb0}" height="26" rx="4" fill="var(--tm-rojo)"/>`;
        c += `<g class="r-ic" opacity="0"><line x1="${xv(f.ic[0])}" x2="${xv(f.ic[1])}" y1="${y + 21}" y2="${y + 21}" stroke="var(--ud-sable)" stroke-width="2.5"/><line x1="${xv(f.ic[0])}" x2="${xv(f.ic[0])}" y1="${y + 13}" y2="${y + 29}" stroke="var(--ud-sable)" stroke-width="2.5"/><line x1="${xv(f.ic[1])}" x2="${xv(f.ic[1])}" y1="${y + 13}" y2="${y + 29}" stroke="var(--ud-sable)" stroke-width="2.5"/></g>`;
        c += `<text class="r-valor t-fuerte" x="${xv(f.ic[1]) + 10}" y="${y + 27}" font-size="18">${dec(f.h)}</text></g>`;
      });
      // Minimapa, norte arriba: troncales en gris y las 20 primeras celdas en rojo (área ∝ retraso).
      const LON0 = -74.23, LON1 = -74.0, LAT0 = 4.47, LAT1 = 4.79, cosl = Math.cos((4.63 * Math.PI) / 180);
      const mx0 = 900, mw = 520, mh = 540;
      const k = Math.min(mw / ((LON1 - LON0) * cosl), mh / (LAT1 - LAT0));
      const ox = mx0 + (mw - (LON1 - LON0) * cosl * k) / 2;
      const px = (lon) => ox + (lon - LON0) * cosl * k, py = (lat) => 10 + (LAT1 - lat) * k;
      c += `<g class="r-mapa">` + datos.troncales.map((t) => `<path d="M${t.p.map(([lo, la]) => `${px(lo).toFixed(1)},${py(la).toFixed(1)}`).join(" L")}" fill="none" stroke="var(--ud-plata)" stroke-width="2" stroke-opacity=".6" stroke-linejoin="round"/>`).join("");
      const maxH = R[0].h;
      [...R].reverse().forEach((f) => {
        const r = 5 + 12 * Math.sqrt(f.h / maxH);
        c += `<circle cx="${px(f.lon)}" cy="${py(f.lat)}" r="${r}" fill="var(--tm-rojo)" fill-opacity="${f.puesto <= 10 ? 0.85 : 0.4}" stroke="#fff" stroke-width="1.5" data-tip="#${f.puesto} · <b>${dec(f.h)} bus-h/día</b> · ${f.top}"/>`;
        if (f.puesto <= 10) c += `<text x="${px(f.lon) + r + 3}" y="${py(f.lat) + 5}" font-size="15" class="t-fuerte halo">${f.puesto}</text>`;
      });
      c += `<text x="${mx0 + mw - 6}" y="${mh - 4}" text-anchor="end" font-size="15">N ↑ · líneas: troncales</text></g>`;
      lienzo(el).innerHTML = svg(w, h, c);
      conTooltip(el);
    },
    entrar(el) {
      el.querySelectorAll(".r-barra").forEach((b, i) => gsap.fromTo(b, { attr: { width: 0 } }, { attr: { width: +b.dataset.w }, duration: D(0.9), delay: D(0.3 + i * 0.05), ease: "power3.out" }));
    },
    paso(el, n) {
      gsap.to(el.querySelectorAll(".r-ic"), { opacity: n >= 1 ? 1 : 0, duration: D(0.5) });
    },
  };
}

// ---------------- Carriles: velocidad dentro y fuera del carril, en las mismas rutas ----------------
const carriles = {
  montar(el) {
    const C = datos.carriles;
    const grupos = [["septima", "Séptima · Cl 28–100"], ["carrera13", "Carrera 13 · Cl 19–67"]];
    const w = 860, h = 500, x0 = 60, base = 420;
    const y = escala(0, 18, base, 20);
    let c = `<line class="eje-linea" x1="${x0}" x2="${w}" y1="${base}" y2="${base}"/>`;
    for (const v of [5, 10, 15]) c += `<line class="rejilla" x1="${x0}" x2="${w}" y1="${y(v)}" y2="${y(v)}"/><text x="${x0 - 10}" y="${y(v) + 5}" text-anchor="end" font-size="19">${v}</text>`;
    c += `<text x="${x0 - 10}" y="${y(18) + 5}" text-anchor="end" font-size="18">km/h</text>`;
    const gw = (w - x0) / 2, bw = 62;
    grupos.forEach(([k, nom], gi) => {
      const g = C[k];
      if (!g) return;
      const gx = x0 + gi * gw;
      ["pico", "valle"].forEach((f, fi) => {
        const fx = gx + 30 + fi * (gw / 2);
        ["dentro", "fuera"].forEach((lado, li) => {
          const d = g[f][lado], bx = fx + li * (bw + 8);
          c += `<rect class="c-barra" x="${bx}" y="${base}" width="${bw}" height="0" data-h="${base - y(d.v_p50)}" rx="4" fill="${lado === "dentro" ? "var(--tm-rojo)" : "var(--ud-plata)"}" data-tip="${nom} · ${f} · ${lado} del carril · <b>${dec(d.v_p50)} km/h</b> · ${Math.round(100 * d.v_rel)} % de su flujo libre · ${miles(d.tramos)} tramo-hora"/>`;
          c += `<text x="${bx + bw / 2}" y="${y(d.v_p50) - 8}" text-anchor="middle" font-size="18" class="t-fuerte">${dec(d.v_p50)}</text>`;
        });
        c += `<text x="${fx + bw + 4}" y="${base + 26}" text-anchor="middle" font-size="18">${f}</text>`;
      });
      c += `<text x="${gx + gw / 2}" y="${base + 58}" text-anchor="middle" font-size="20" class="t-fuerte">${nom}</text><text x="${gx + gw / 2}" y="${base + 80}" text-anchor="middle" font-size="16">${g.rutas} rutas</text>`;
    });
    lienzo(el).innerHTML = svg(w, h + 90, c);
    conTooltip(el);
  },
  entrar(el) {
    el.querySelectorAll(".c-barra").forEach((r, i) => {
      const hh = +r.dataset.h;
      gsap.fromTo(r, { attr: { height: 0, y: 420 } }, { attr: { height: hh, y: 420 - hh }, duration: D(0.9), delay: D(0.2 + i * 0.06), ease: "power3.out" });
    });
  },
};

// ---------------- Cuánto reservar: BTI por sistema y los pares menos confiables ----------------
const reservar = {
  montar(el) {
    const bti = datos.resumen.confiabilidad.bti_mediana_pico;
    const max = Math.max(...Object.values(bti));
    el.querySelector("[data-bti]").innerHTML = TIPOS_V.filter(([k]) => bti[k] != null).map(([k, col, nom]) =>
      `<div class="vd" data-tip="${nom} · BTI mediano en el pico: <b>${dec(bti[k], 3)}</b>"><span>${nom}</span><i style="width:${(100 * bti[k]) / max}%;background:${col}"></i><b>+${Math.round(100 * bti[k])} %</b></div>`).join("");
    for (const g of ["mixto", "exclusivo"]) {
      const filas = datos.confiables[g].map((p) => `<tr><td><b>${p.ruta}</b></td><td>${p.desde} → ${p.hasta}</td><td>${p.hora}h</td><td>${p.p50} min</td><td><b>${p.p95} min</b></td></tr>`).join("");
      el.querySelector(`[data-pares="${g}"]`).innerHTML = `<table class="tabla-bench tabla-pares"><thead><tr><th>ruta</th><th>de → a</th><th>hora</th><th>p50</th><th>p95</th></tr></thead><tbody>${filas}</tbody></table>`;
    }
    conTooltip(el);
  },
};

// ---------------- Walk-forward: cobertura del p95 por hora, y holgura del horario ----------------
const walkforward = {
  montar(el) {
    const wf = datos.walkforward;
    const H = Object.entries(wf.cobertura_por_hora).map(([h, v]) => [+h, v]).sort((a, b) => a[0] - b[0]);
    const w = 860, h = 500, x0 = 70, base = 430;
    const y = escala(0, 1, base, 20);
    const bw = (w - x0 - 20) / H.length;
    let c = `<line class="eje-linea" x1="${x0}" x2="${w}" y1="${base}" y2="${base}"/>`;
    for (const v of [0, 0.25, 0.5, 0.75, 1]) c += `<line class="rejilla" x1="${x0}" x2="${w}" y1="${y(v)}" y2="${y(v)}"/><text x="${x0 - 10}" y="${y(v) + 5}" text-anchor="end" font-size="19">${Math.round(100 * v)} %</text>`;
    H.forEach(([hh, v], i) => {
      const x = x0 + i * bw + 5;
      c += `<rect class="wf-barra" x="${x}" y="${base}" width="${bw - 10}" height="0" data-h="${base - y(v)}" rx="3" fill="var(--azul-tm)" data-tip="${hh}:00 · <b>${dec(100 * v)} %</b> de los viajes de prueba dentro del p95"/>`;
      if (hh % 2 === 1) c += `<text x="${x + (bw - 10) / 2}" y="${base + 26}" text-anchor="middle" font-size="17" class="t-mono">${hh}h</text>`;
    });
    c += `<line x1="${x0}" x2="${w}" y1="${y(0.95)}" y2="${y(0.95)}" stroke="var(--tm-rojo)" stroke-width="3" stroke-dasharray="8 6"/><text x="${w - 4}" y="${y(0.95) - 10}" text-anchor="end" font-size="22" class="t-fuerte halo">meta: 95 %</text>`;
    c += `<line x1="${x0}" x2="${w}" y1="${y(wf.cobertura)}" y2="${y(wf.cobertura)}" stroke="var(--ud-sable)" stroke-width="2"/><text x="${w - 4}" y="${y(wf.cobertura) + 28}" text-anchor="end" font-size="22" class="t-fuerte halo">total: ${dec(100 * wf.cobertura)} %</text>`;
    lienzo(el).innerHTML = svg(w, h, c);
    // Holgura del horario por sistema (días hábiles): corto, ok, sobra.
    const hol = datos.resumen.confiabilidad.holgura_dia_habil;
    const PARTES = [["corto", "var(--tm-rojo)", "se queda corto"], ["ok", "var(--verde-tm)", "acierta"], ["sobra", "var(--amarillo)", "le sobra"]];
    el.querySelector("[data-holgura]").innerHTML = TIPOS_V.filter(([k]) => hol[k]).map(([k, , nom]) =>
      `<div class="holgura"><span>${nom}</span><i>${PARTES.map(([p, col, txt]) => `<em style="width:${100 * (hol[k][p] || 0)}%;background:${col}" data-tip="${nom} · el horario ${txt}: <b>${Math.round(100 * (hol[k][p] || 0))} %</b> de los pares × hora"></em>`).join("")}</i><b style="color:var(--tm-rojo)">${Math.round(100 * (hol[k].corto || 0))} %</b></div>`).join("") +
      `<p class="leyenda-linea">${PARTES.map(([, col, txt]) => `<span><span class="sw" style="background:${col}"></span> ${txt}</span>`).join("")}</p>`;
    conTooltip(el);
  },
  entrar(el) {
    el.querySelectorAll(".wf-barra").forEach((r, i) => {
      const hh = +r.dataset.h;
      gsap.fromTo(r, { attr: { height: 0, y: 430 } }, { attr: { height: hh, y: 430 - hh }, duration: D(0.8), delay: D(0.2 + i * 0.03), ease: "power3.out" });
    });
  },
};

// ---------------- Accesibilidad: % de empleos alcanzables en 60 min por estrato, horario frente a observado ----------------
const ESC_A = [["programado", "var(--ud-sable)", "horario"], ["observado", "var(--azul-tm)", "observado típico"], ["observado_lento", "var(--tm-rojo)", "observado lento (p80)"]];
const accesibilidad = {
  montar(el) {
    const a = datos.accesibilidad;
    if (!a) return;
    const filas = a.por_estrato.filter((r) => r.estrato >= 1 && r.estrato <= 6);
    const max = Math.max(...filas.flatMap((r) => ESC_A.map(([k]) => r[`${k}_60_pct`])));
    el.querySelector("[data-acceso]").innerHTML = filas.map((r) =>
      `<div class="acceso-fila"><span>Estrato ${r.estrato}</span><div>${ESC_A.map(([k, col, nom]) =>
        `<div class="vd" data-tip="Estrato ${r.estrato} · ${nom}: <b>${dec(r[`${k}_60_pct`])} %</b> de los empleos en 60 min (mediana de ${r.zonas} zonas)"><i style="width:${(100 * r[`${k}_60_pct`]) / max}%;background:${col}"></i><b>${dec(r[`${k}_60_pct`])} %</b></div>`).join("")}</div></div>`).join("") +
      `<p class="leyenda-linea">${ESC_A.map(([, col, nom]) => `<span><span class="sw" style="background:${col}"></span> ${nom}</span>`).join("")}</p>`;
    conTooltip(el);
  },
};

export const graficos = {
  velhora, calor, pipeline, speedup, carriles, reservar, walkforward, accesibilidad,
  rankingMixto: ranking("mixto"), rankingExclusivo: ranking("exclusivo"),
};
