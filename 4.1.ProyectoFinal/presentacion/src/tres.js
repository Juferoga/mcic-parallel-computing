// Escenas 3D dentro de los marcos. Cada una solo dibuja mientras su marco está activo.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import gsap from "gsap";
import datos from "./datos.json";
import { colorTipo, alCambiarTema, oscuro } from "./paleta.js";

const reducido = matchMedia("(prefers-reduced-motion: reduce)").matches;

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

// ---------------- Velocidades: celdas de 250 m en el pico de los días hábiles (salida del pipeline) ----------------
// Paso 0: cada celda es un punto coloreado por la velocidad mediana de los buses en el pico. Paso 1: las celdas se
// levantan según las bus-horas que se pierden ahí cada día hábil frente al flujo libre: las «montañas» son el retraso.
function velocidades() {
  let s, columnas, alturas = [];
  const V_REF = 25;
  return {
    montar(el) {
      s = escena(el, { posicion: [-4, 26, 24], autoGiro: 0.25 });
      troncalesEnPiso(s.scene);
      const T = datos.mapa_tramos || [];
      if (!T.length) {
        s.etiqueta("sin resultados del pipeline todavía", [0, 0.5, 0], "tabla");
        return;
      }
      const geo = new THREE.CylinderGeometry(0.1, 0.1, 1, 8);
      geo.translate(0, 0.5, 0);
      columnas = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ roughness: 0.7, metalness: 0 }), T.length);
      const lento = (v) => Math.min(1, Math.max(0, (V_REF - v) / V_REF));
      const tope = Math.max(...T.map((t) => t[3])) || 1; // altura proporcional al retraso; la celda de más retraso mide 6
      const m = new THREE.Matrix4();
      T.forEach(([lon, lat, , ret], i) => {
        const [x, z] = xz(lon, lat);
        alturas.push(0.15 + (ret / tope) * 6);
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
      s.etiqueta("N", [0, 0.2, -19], "chica norte");
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

export const escenas = { velocidades: velocidades() };
