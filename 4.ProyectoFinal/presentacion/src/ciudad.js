// Fondo de todas las diapositivas: Bogotá dibujada con las calles por donde pasa algún bus (todas las shapes del
// GTFS, src/mapa.json), las troncales en rojo UD, las 160 estaciones y los 1.600 buses reales del replay del martes 17
// (6:15 a 7:45) moviéndose en bucle. Vive en el mismo sistema de coordenadas que los marcos: se acerca y se aleja con
// la cámara y en la vista general se ve completa detrás del recorrido. Norte a la derecha.
//
// Dos canvas 2D para no gastar máquina: el mapa solo se repinta cuando la cámara se mueve; los buses, a 30 fps, y se
// detienen si la pestaña está oculta o el sistema pide menos movimiento.
import mapa from "./mapa.json";
import datos from "./datos.json";

const COLOR_BUS = { troncal: "#ED3237", zonal: "#1291C0", alimentador: "#00A859", dual: "#B49739" };
const VELOCIDAD = 45;   // s del replay por segundo real: la hora y media dura 2 minutos
const VIDA = 240;       // s: un bus sin reportes más de esto se esconde

export function iniciarCiudad(cvMapa, cvBuses, caja) {
  // Proyección: lat -> x, lon -> y. Ajusta la red completa dentro de la caja de los marcos (con margen), centrada.
  const { lon0, lat0, q } = mapa;
  const todas = [...mapa.red, ...mapa.troncal];
  // Encuadre por percentiles (2–98 %): las colas rurales (Soacha, vía a La Calera) no descentran la ciudad.
  const lx = [], ly = [];
  for (const l of todas) for (let i = 0; i < l.length; i += 2) { lx.push(l[i]); ly.push(l[i + 1]); }
  const pct = (a, p) => a.sort((u, v) => u - v)[Math.floor(p * (a.length - 1))];
  const xmin = pct(lx, 0.02), xmax = pct(lx, 0.98), ymin = pct(ly, 0.02), ymax = pct(ly, 0.98);
  const mlo = lon0 + ((xmin + xmax) / 2) * q, mla = lat0 + ((ymin + ymax) / 2) * q;
  const k = Math.min((caja.x1 - caja.x0 - 400) / ((ymax - ymin) * q), (caja.y1 - caja.y0 - 400) / ((xmax - xmin) * q));
  const cx = (caja.x0 + caja.x1) / 2, cy = (caja.y0 + caja.y1) / 2;
  const px = (lon, lat) => cx + (lat - mla) * k;
  const py = (lon, lat) => cy + (lon - mlo) * k;

  const camino = (lineas) => {
    const p = new Path2D();
    for (const l of lineas) {
      for (let i = 0; i < l.length; i += 2) {
        const lon = lon0 + l[i] * q, lat = lat0 + l[i + 1] * q;
        i ? p.lineTo(px(lon, lat), py(lon, lat)) : p.moveTo(px(lon, lat), py(lon, lat));
      }
    }
    return p;
  };
  const red = camino(mapa.red), troncal = camino(mapa.troncal);
  const estaciones = mapa.estaciones.map(([lon, lat]) => [px(lon, lat), py(lon, lat)]);

  // Buses: coordenadas del lienzo precalculadas; cada uno guarda en qué punto de su trayectoria va.
  const buses = datos.replay.buses.map((b) => ({
    c: COLOR_BUS[b.k] || "#98999A",
    t: Float32Array.from(b.p, (p) => p[0]),
    x: Float32Array.from(b.p, (p) => px(p[1], p[2])),
    y: Float32Array.from(b.p, (p) => py(p[1], p[2])),
    j: 0,
  }));
  const T0 = 0, T1 = 5400;

  const cxM = cvMapa.getContext("2d"), cxB = cvBuses.getContext("2d");
  let cam = { x: cx, y: cy, z: 0.1, r: 0 }, oscuro = false, dpr = 1, sucio = true;
  const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;

  function tamano() {
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    for (const c of [cvMapa, cvBuses]) { c.width = innerWidth * dpr; c.height = innerHeight * dpr; }
    sucio = true;
  }
  addEventListener("resize", tamano);
  tamano();

  // Misma transformación que #world: translate(centro) scale(z) rotate(-r) translate(-x, -y).
  function matriz() {
    const th = (-cam.r * Math.PI) / 180, z = cam.z * dpr;
    const a = z * Math.cos(th), b = z * Math.sin(th), c = -b, d = a;
    const ox = (innerWidth / 2) * dpr, oy = (innerHeight / 2) * dpr;
    return [a, b, c, d, ox - (a * cam.x + c * cam.y), oy - (b * cam.x + d * cam.y)];
  }

  function pintarMapa() {
    const m = matriz();
    cxM.setTransform(1, 0, 0, 1, 0, 0);
    cxM.clearRect(0, 0, cvMapa.width, cvMapa.height);
    cxM.setTransform(...m);
    const z = cam.z * dpr;
    cxM.lineJoin = cxM.lineCap = "round";
    cxM.strokeStyle = oscuro ? "rgba(200,196,197,0.20)" : "rgba(55,52,53,0.17)";
    cxM.lineWidth = (1.1 * dpr) / z;
    cxM.stroke(red);
    cxM.strokeStyle = oscuro ? "rgba(237,50,55,0.55)" : "rgba(237,50,55,0.45)";
    cxM.lineWidth = (2.6 * dpr) / z;
    cxM.stroke(troncal);
    // Estaciones: cuadritos de tamaño fijo en pantalla.
    cxM.setTransform(1, 0, 0, 1, 0, 0);
    cxM.fillStyle = oscuro ? "#1F1D1E" : "#fff";
    cxM.strokeStyle = "rgba(237,50,55,0.8)";
    cxM.lineWidth = 1.2 * dpr;
    const s = 3.2 * dpr;
    for (const [x, y] of estaciones) {
      const X = m[0] * x + m[2] * y + m[4], Y = m[1] * x + m[3] * y + m[5];
      if (X < -10 || Y < -10 || X > cvMapa.width + 10 || Y > cvMapa.height + 10) continue;
      cxM.fillRect(X - s / 2, Y - s / 2, s, s);
      cxM.strokeRect(X - s / 2, Y - s / 2, s, s);
    }
  }

  let reloj = 2400, previo = performance.now(), ultimo = 0, raf = 0;
  function pintarBuses(t) {
    const m = matriz();
    const W = cvBuses.width, H = cvBuses.height, r = Math.max(1.6, Math.min(3.4, 1.4 + cam.z * 2.5)) * dpr;
    cxB.setTransform(1, 0, 0, 1, 0, 0);
    cxB.clearRect(0, 0, W, H);
    cxB.globalAlpha = oscuro ? 0.9 : 0.8;
    for (const b of buses) {
      if (t < b.t[0] || t > b.t[b.t.length - 1] + VIDA) continue;
      if (b.t[b.j] > t) b.j = 0;
      while (b.j < b.t.length - 2 && b.t[b.j + 1] <= t) b.j++;
      const j = b.j, dt = b.t[j + 1] - b.t[j];
      const f = dt > 0 && dt < VIDA ? Math.min(1, Math.max(0, (t - b.t[j]) / dt)) : 0;
      const x = b.x[j] + (b.x[j + 1] - b.x[j]) * f, y = b.y[j] + (b.y[j + 1] - b.y[j]) * f;
      const X = m[0] * x + m[2] * y + m[4], Y = m[1] * x + m[3] * y + m[5];
      if (X < -5 || Y < -5 || X > W + 5 || Y > H + 5) continue;
      cxB.fillStyle = b.c;
      cxB.beginPath();
      cxB.arc(X, Y, r, 0, 6.2832);
      cxB.fill();
    }
  }

  function cuadro(ahora) {
    raf = requestAnimationFrame(cuadro);
    if (sucio) { pintarMapa(); sucio = false; pintarBuses(reloj); }
    if (quieto || ahora - ultimo < 33) return;
    reloj += ((ahora - previo) / 1000) * VELOCIDAD;
    previo = ahora;
    if (reloj > T1) reloj = T0;
    ultimo = ahora;
    pintarBuses(reloj);
  }
  raf = requestAnimationFrame(cuadro);
  document.addEventListener("visibilitychange", () => {
    cancelAnimationFrame(raf);
    previo = performance.now();
    if (!document.hidden) raf = requestAnimationFrame(cuadro);
  });

  return {
    camara(c) { cam = { ...c }; sucio = true; },
    tema(o) { oscuro = o; sucio = true; },
  };
}
