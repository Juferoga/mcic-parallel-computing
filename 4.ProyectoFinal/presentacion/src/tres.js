// Escenas 3D dentro de los marcos. Cada una solo dibuja mientras su marco está activo.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import gsap from "gsap";
import datos from "./datos.json";
import { colorTipo, alCambiarTema, oscuro } from "./paleta.js";

const reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;
const fmt = (n) => Math.round(n).toLocaleString("de-DE");

// Proyección local de Bogotá: 1 unidad ≈ 1,1 km. Norte hacia -z.
const LON0 = -74.115, LAT0 = 4.635, K = 100;
const xz = (lon, lat) => [(lon - LON0) * K, -(lat - LAT0) * K];

function escena(el, { posicion = [0, 26, 30], objetivo = [0, 0, 0], autoGiro = 0.35 } = {}) {
  const lienzo = el.querySelector(".lienzo");
  const canvas = lienzo.querySelector("canvas");
  const capa = lienzo.querySelector(".etiquetas-3d");
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500);
  camera.position.set(...posicion);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(...objetivo);
  controls.enableDamping = true;
  controls.autoRotate = !reducido && autoGiro > 0;
  controls.autoRotateSpeed = autoGiro;
  controls.enablePan = false;
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.minDistance = 8;
  controls.maxDistance = 80;
  controls.addEventListener("start", () => (controls.autoRotate = false));
  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  const luz = new THREE.DirectionalLight(0xffffff, 1.3);
  luz.position.set(10, 20, 8);
  scene.add(luz);

  const etiquetas = [];
  const v = new THREE.Vector3();
  const s = {
    scene, camera, controls, renderer, lienzo, activo: false, cada: null,
    etiqueta(texto, pos, clase = "") {
      const e = document.createElement("div");
      e.className = "etq-3d " + clase;
      e.innerHTML = texto;
      capa.appendChild(e);
      const item = { e, pos: new THREE.Vector3(...pos) };
      etiquetas.push(item);
      return item;
    },
  };
  function tamano() {
    const w = lienzo.clientWidth, h = lienzo.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(tamano).observe(lienzo);
  function cuadro(t) {
    if (!s.activo) return;
    controls.update();
    s.cada?.(t);
    renderer.render(scene, camera);
    const w = lienzo.clientWidth, h = lienzo.clientHeight;
    for (const { e, pos } of etiquetas) {
      v.copy(pos).project(camera);
      e.style.left = ((v.x + 1) / 2) * w + "px";
      e.style.top = ((1 - v.y) / 2) * h + "px";
      e.style.display = v.z > 1 ? "none" : "";
    }
    requestAnimationFrame(cuadro);
  }
  s.activar = () => {
    if (s.activo) return;
    s.activo = true;
    tamano();
    requestAnimationFrame(cuadro);
  };
  s.desactivar = () => (s.activo = false);
  return s;
}

// Troncales reales sobre el piso (y = 0), en un gris neutro: el color queda para los buses.
function troncalesEnPiso(scene) {
  const verts = [];
  for (const t of datos.troncales) {
    for (let i = 1; i < t.p.length; i++) {
      const [x0, z0] = xz(...t.p[i - 1]), [x1, z1] = xz(...t.p[i]);
      verts.push(x0, 0.02, z0, x1, 0.02, z1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  const m = new THREE.LineBasicMaterial({ transparent: true });
  scene.add(new THREE.LineSegments(g, m));
  // Piso tenue con rejilla para dar escala (1 celda ≈ 2,2 km).
  const rej = new THREE.GridHelper(44, 20, 0x98999a, 0x98999a);
  rej.material.transparent = true;
  scene.add(rej);
  const tema = (os) => {
    m.color.set(os ? 0x6b7686 : 0x98999a);
    m.opacity = os ? 0.7 : 0.55;
    rej.material.opacity = os ? 0.1 : 0.14;
  };
  tema(oscuro());
  alCambiarTema(tema);
}

// Puntos redondos con tamaño y alfa por vértice.
function materialPuntos() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { escala: { value: 1 } },
    vertexShader: `
      attribute vec3 color; attribute float alfa; attribute float tam;
      varying vec3 vC; varying float vA;
      uniform float escala;
      void main() {
        vC = color; vA = alfa;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = tam * escala * (60.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      varying vec3 vC; varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5 || vA <= 0.0) discard;
        gl_FragColor = vec4(vC, vA * smoothstep(0.5, 0.32, d));
      }`,
  });
}

// ---------------- Foto: todos los buses a las 07:00 del martes 17 de noviembre ----------------
function foto() {
  let s, columnas, alfa, puntos, tipos;
  return {
    montar(el) {
      s = escena(el, { posicion: [-6, 30, 26], autoGiro: 0.3 });
      troncalesEnPiso(s.scene);
      const P = datos.foto.puntos;
      const n = P.length;
      const pos = new Float32Array(n * 3), col = new Float32Array(n * 3), tam = new Float32Array(n);
      alfa = new Float32Array(n);
      tipos = P.map((p) => p[2]);
      P.forEach(([lon, lat, k], i) => {
        const [x, z] = xz(lon, lat);
        pos.set([x, 0.15, z], i * 3);
        tam[i] = k === "troncal" ? 3.4 : 2.6;
        alfa[i] = 0.9;
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      g.setAttribute("alfa", new THREE.BufferAttribute(alfa, 1));
      g.setAttribute("tam", new THREE.BufferAttribute(tam, 1));
      puntos = new THREE.Points(g, materialPuntos());
      s.scene.add(puntos);

      // Columnas hexagonales: buses por celda de ~1 km (agregación espacial, como H3).
      const R = 0.55, celdas = new Map();
      const W = Math.sqrt(3) * R;
      for (const [lon, lat] of P) {
        const [x, z] = xz(lon, lat);
        const fila = Math.round(z / (1.5 * R));
        const colh = Math.round((x - (fila & 1 ? W / 2 : 0)) / W);
        const k = fila + "," + colh;
        celdas.set(k, (celdas.get(k) || 0) + 1);
      }
      const max = Math.max(...celdas.values());
      const geo = new THREE.CylinderGeometry(R * 0.92, R * 0.92, 1, 6);
      geo.translate(0, 0.5, 0);
      columnas = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.75, metalness: 0, transparent: true, opacity: 0.94 }), celdas.size);
      const m = new THREE.Matrix4();
      let i = 0, top = null;
      const fracs = [];
      for (const [k, n] of celdas) {
        const [fila, colh] = k.split(",").map(Number);
        const x = colh * W + (fila & 1 ? W / 2 : 0), z = fila * 1.5 * R;
        const h = 0.2 + (n / max) * 9;
        m.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion(), new THREE.Vector3(1, h, 1));
        columnas.setMatrixAt(i++, m);
        fracs.push(n / max);
        if (!top || n > top.n) top = { n, x, z, h };
      }
      // Rampa secuencial de un solo tono (plata → sable de la paleta UD): más buses, más oscuro.
      // Así no compite con los colores heráldicos de los tipos de servicio.
      const pintar = (os) => {
        const a = new THREE.Color(os ? 0x2a3340 : 0xdcdddd), b = new THREE.Color(os ? 0xf1f4f8 : 0x373435), c = new THREE.Color();
        fracs.forEach((f, j) => columnas.setColorAt(j, c.copy(a).lerp(b, Math.pow(f, 0.75))));
        columnas.instanceColor.needsUpdate = true;
        const cc = g.attributes.color.array;
        tipos.forEach((k, j) => { const t = new THREE.Color(colorTipo(k, os)); cc[j * 3] = t.r; cc[j * 3 + 1] = t.g; cc[j * 3 + 2] = t.b; });
        g.attributes.color.needsUpdate = true;
      };
      pintar(oscuro());
      alCambiarTema(pintar);
      columnas.scale.y = 0.001;
      columnas.visible = false;
      s.scene.add(columnas);
      s.etiqueta(`<b>${top.n}</b> buses en ~1 km²`, [top.x, top.h + 0.3, top.z], "tabla pico").e.style.opacity = 0;
      this.pico = s.lienzo.querySelector(".pico");
      s.etiqueta("N", [0, 0.2, -19], "chica norte");
    },
    entrar(el, paso) { s.activar(); this.paso(el, paso, false); },
    salir() { s.desactivar(); },
    paso(el, n, animar = true) {
      if (!s) return;
      const d = animar && !reducido ? 1.2 : 0;
      // Las columnas solo existen en el paso 1; en el 0 y el 2 se aplanan y se ocultan.
      const ver = n === 1;
      if (ver) columnas.visible = true;
      gsap.to(columnas.scale, { y: ver ? 1 : 0.001, duration: d, ease: "power3.out", overwrite: true, onComplete: () => (columnas.visible = ver) });
      gsap.to(this.pico, { opacity: ver ? 1 : 0, duration: d });
      // Paso 2: solo el sistema troncal.
      const a = puntos.geometry.attributes.alfa;
      tipos.forEach((k, i) => (a.array[i] = n >= 2 && k !== "troncal" ? 0.08 : 0.9));
      a.needsUpdate = true;
    },
  };
}

// ---------------- Replay: 90 minutos del pico de la mañana, a 120x ----------------
function replay() {
  let s, geo, buses, reloj, activos, t = -60, ultimo = 0, corriendo = true, soloTroncal = false;
  const COLA = 6, DT_COLA = 25, VEL = 120;
  const T_FIN = (new Date(datos.replay.fin) - new Date(datos.replay.inicio)) / 1000;
  const inicio = new Date(datos.replay.inicio);
  const hora = (seg) => {
    const d = new Date(inicio.getTime() + seg * 1000);
    return d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Bogota" });
  };
  function posicion(b, tt, out) {
    const p = b.p;
    if (tt < p[0][0] || tt > p[p.length - 1][0]) return false;
    let lo = 1, hi = p.length - 1; // primer punto con tiempo >= tt
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (p[m][0] < tt) lo = m + 1; else hi = m;
    }
    const a = p[lo - 1], c = p[lo];
    if (c[0] - a[0] > 240) return false; // hueco: el bus dejó de reportar
    const f = (tt - a[0]) / (c[0] - a[0] || 1);
    out[0] = a[1] + (c[1] - a[1]) * f;
    out[1] = a[2] + (c[2] - a[2]) * f;
    return true;
  }
  return {
    montar(el) {
      s = escena(el, { posicion: [4, 24, 28], autoGiro: 0.18 });
      troncalesEnPiso(s.scene);
      buses = datos.replay.buses.map((b) => ({ ...b, c: new THREE.Color(colorTipo(b.k)) }));
      const n = buses.length * COLA;
      geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(n * 3), 3));
      geo.setAttribute("alfa", new THREE.BufferAttribute(new Float32Array(n), 1));
      geo.setAttribute("tam", new THREE.BufferAttribute(new Float32Array(n), 1));
      const col = geo.attributes.color.array, tam = geo.attributes.tam.array;
      const pintar = (os) => {
        buses.forEach((b, i) => {
          b.c.set(colorTipo(b.k, os));
          for (let k = 0; k < COLA; k++) col.set([b.c.r, b.c.g, b.c.b], (i * COLA + k) * 3);
        });
        geo.attributes.color.needsUpdate = true;
      };
      buses.forEach((b, i) => {
        for (let k = 0; k < COLA; k++) tam[i * COLA + k] = (b.k === "troncal" ? 3.6 : 2.7) * (1 - k / (COLA + 2));
      });
      pintar(oscuro());
      alCambiarTema(pintar);
      s.scene.add(new THREE.Points(geo, materialPuntos()));
      reloj = el.querySelector("[data-reloj]");
      activos = el.querySelector("[data-activos]");
      el.querySelector("[data-pausa]")?.addEventListener("click", (e) => {
        corriendo = !corriendo;
        e.currentTarget.textContent = corriendo ? "❚❚ pausa" : "▶ seguir";
      });
      const out = [0, 0];
      s.cada = (ms) => {
        const dt = Math.min(0.1, (ms - (ultimo || ms)) / 1000);
        ultimo = ms;
        if (corriendo && !reducido) t += dt * VEL;
        if (t > T_FIN) t = -60;
        const pos = geo.attributes.position.array, alf = geo.attributes.alfa.array;
        let vivos = 0;
        buses.forEach((b, i) => {
          const visible = !soloTroncal || b.k === "troncal";
          for (let k = 0; k < COLA; k++) {
            const idx = i * COLA + k;
            if (visible && posicion(b, t - k * DT_COLA, out)) {
              const [x, z] = xz(out[0], out[1]);
              pos[idx * 3] = x; pos[idx * 3 + 1] = 0.15; pos[idx * 3 + 2] = z;
              alf[idx] = k === 0 ? 0.95 : 0.5 * (1 - k / COLA);
              if (k === 0) vivos++;
            } else alf[idx] = 0;
          }
        });
        geo.attributes.position.needsUpdate = true;
        geo.attributes.alfa.needsUpdate = true;
        reloj.textContent = hora(Math.max(0, t));
        activos.textContent = fmt(vivos);
      };
    },
    entrar(el, paso) { ultimo = 0; s.activar(); this.paso(el, paso); },
    salir() { s.desactivar(); },
    paso(el, n) { soloTroncal = n >= 1; },
  };
}

// ---------------- Velocidades: tramos de 500 m de las troncales en el pico (salida del pipeline) ----------------
// Paso 0: cada tramo es un punto coloreado por su velocidad comercial. Paso 1: los tramos lentos se levantan
// (altura = cuánto les falta para 25 km/h): las «montañas» son los trancones.
function velocidades() {
  let s, columnas, alturas = [];
  const V_REF = 25;
  return {
    montar(el) {
      s = escena(el, { posicion: [-4, 26, 24], autoGiro: 0.25 });
      troncalesEnPiso(s.scene);
      const T = datos.metricas?.tramos_pico || [];
      if (!T.length) {
        s.etiqueta("sin resultados del pipeline todavía", [0, 0.5, 0], "tabla");
        return;
      }
      const geo = new THREE.CylinderGeometry(0.16, 0.16, 1, 10);
      geo.translate(0, 0.5, 0);
      columnas = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0 }), T.length);
      const lento = (v) => Math.min(1, Math.max(0, (V_REF - v) / V_REF));
      const m = new THREE.Matrix4();
      T.forEach(([lon, lat, v], i) => {
        const [x, z] = xz(lon, lat);
        alturas.push(0.15 + lento(v) * 7);
        m.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion(), new THREE.Vector3(1, 0.15, 1));
        columnas.setMatrixAt(i, m);
      });
      const pintar = (os) => {
        const rapido = new THREE.Color(os ? 0x55606f : 0xc4c5c6), lentoC = new THREE.Color(colorTipo("troncal", os)), c = new THREE.Color();
        T.forEach(([, , v], i) => columnas.setColorAt(i, c.copy(rapido).lerp(lentoC, Math.pow(lento(v), 0.8))));
        columnas.instanceColor.needsUpdate = true;
      };
      pintar(oscuro());
      alCambiarTema(pintar);
      s.scene.add(columnas);
      this.T = T;
      // Sin etiqueta flotante: la lista de la izquierda (tramos con ≥ 300 mediciones) es la cifra de referencia.
      s.etiqueta("N", [0, 0.2, -19], "chica norte");
      const lista = el.querySelector("[data-lentos]");
      if (lista) lista.innerHTML = (datos.metricas.tramos_lentos || []).slice(0, 5)
        .map((t) => `<li><b>${String(t.v).replace(".", ",")} km/h</b> · ${t.ruta} <span class="muted">km ${String(t.km).replace(".", ",")}</span></li>`).join("");
    },
    entrar(el, paso) { s.activar(); this.paso(el, paso, false); },
    salir() { s.desactivar(); },
    paso(el, n, animar = true) {
      if (!columnas) return;
      const o = { f: n >= 1 ? 0 : 1 }, fin = n >= 1 ? 1 : 0;
      const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), e = new THREE.Vector3();
      gsap.to(o, {
        f: fin, duration: animar && !reducido ? 1.2 : 0, ease: "power3.out", overwrite: true,
        onUpdate: () => {
          this.T.forEach((_, i) => {
            columnas.getMatrixAt(i, m);
            m.decompose(p, q, e);
            e.y = 0.15 + (alturas[i] - 0.15) * o.f;
            columnas.setMatrixAt(i, m.compose(p, q, e));
          });
          columnas.instanceMatrix.needsUpdate = true;
        },
      });
    },
  };
}

export const escenas = { foto: foto(), replay: replay(), velocidades: velocidades() };
