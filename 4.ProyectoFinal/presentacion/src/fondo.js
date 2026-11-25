// Fondo: el mapa real de las troncales de TransMilenio (shapes.txt del GTFS) tendido detrás del lienzo, muy tenue
// y en gris (el lienzo debe sentirse institucional y discreto), con unos pocos puntos rojos UD que circulan.
// La cámara 3D sigue a la cámara 2D (parallax).
import * as THREE from "three";
import datos from "./datos.json";

const ESCALA = 0.012; // px del mundo -> unidades del fondo
// Bogotá acostada: el norte queda a la derecha, así el recorrido de la presentación va de sur a norte.
const LAT0 = 4.5, LON0 = -74.12, K = 520;
export const aFondo = (lon, lat) => [(lat - LAT0) * K - 8, -26 + (lon - LON0) * K, 0];

export function iniciarFondo(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setClearColor(0xeceef1);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xeceef1, 0.0065);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 600);

  const mapa = new THREE.Group();
  mapa.position.z = -46;
  mapa.visible = false; // el mapa ahora vive en el lienzo 2D (main.js · mapaBogota), alineado con los marcos
  scene.add(mapa);

  // Troncales: una polilínea por ruta.
  const lineas = [];
  const matLinea = new THREE.LineBasicMaterial({ color: 0x98999a, transparent: true, opacity: 0.22 });
  const verts = [];
  for (const t of datos.troncales) {
    const pts = t.p.map(([lon, lat]) => aFondo(lon, lat));
    const acum = [0];
    for (let i = 1; i < pts.length; i++) {
      acum.push(acum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      verts.push(...pts[i - 1], ...pts[i]);
    }
    lineas.push({ pts, acum, largo: acum[acum.length - 1] });
  }
  const gl = new THREE.BufferGeometry();
  gl.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  mapa.add(new THREE.LineSegments(gl, matLinea));

  // Buses: puntos que avanzan por las troncales a velocidades distintas, en ambos sentidos.
  const N = 420;
  const buses = [];
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const l = lineas[Math.floor(Math.random() * lineas.length)];
    buses.push({ l, s: Math.random() * l.largo, v: (0.012 + Math.random() * 0.02) * (Math.random() < 0.5 ? 1 : -1) });
  }
  const gb = new THREE.BufferGeometry();
  gb.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const matBus = new THREE.PointsMaterial({ size: 0.3, color: 0xed3237, transparent: true, opacity: 0.22, depthWrite: false });
  mapa.add(new THREE.Points(gb, matBus));

  function ubicar(b, i) {
    const { pts, acum, largo } = b.l;
    b.s = ((b.s % largo) + largo) % largo;
    let j = 1;
    while (j < acum.length - 1 && acum[j] < b.s) j++;
    const a = pts[j - 1], c = pts[j], t = (b.s - acum[j - 1]) / (acum[j] - acum[j - 1] || 1);
    pos[i * 3] = a[0] + (c[0] - a[0]) * t;
    pos[i * 3 + 1] = a[1] + (c[1] - a[1]) * t;
    pos[i * 3 + 2] = 0.2;
  }
  buses.forEach(ubicar);

  const objetivo = new THREE.Vector3(0, 0, 40);
  const actual = objetivo.clone();
  let giro = 0, raf = 0;

  function tamano() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
  }
  addEventListener("resize", tamano);
  tamano();

  const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches;
  function cuadro() {
    actual.lerp(objetivo, quieto ? 1 : 0.08);
    camera.position.copy(actual);
    camera.lookAt(actual.x, actual.y, actual.z - 50);
    camera.rotateZ(giro);
    if (!quieto) {
      buses.forEach((b, i) => { b.s += b.v; ubicar(b, i); });
      gb.attributes.position.needsUpdate = true;
    }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(cuadro);
  }
  cuadro();
  document.addEventListener("visibilitychange", () => {
    cancelAnimationFrame(raf);
    if (!document.hidden) cuadro();
  });

  return {
    tema(oscuro) {
      const c = oscuro ? 0x1f1d1e : 0xeceef1;
      renderer.setClearColor(c);
      scene.fog.color.setHex(c);
      matLinea.color.setHex(oscuro ? 0x6a6667 : 0x98999a);
      matLinea.opacity = oscuro ? 0.32 : 0.22;
      matBus.color.setHex(0xed3237);
      matBus.opacity = oscuro ? 0.3 : 0.22;
    },
    camara({ x, y, z, r }) {
      objetivo.set(x * ESCALA, -y * ESCALA, 12 + 28 / Math.max(z, 0.05) ** 0.5);
      giro = ((-r * Math.PI) / 180) * 0.3;
    },
  };
}
