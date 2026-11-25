// Colores compartidos por las escenas 3D y el fondo: paleta heráldica de la Universidad Distrital
// (manual de imagen), los mismos de style.css. Los tipos de servicio siguen el orden fijo de la leyenda:
// troncal = gules, zonal = azur, alimentador = sinople, dual = oro.
// Los marcos son diapositivas UD claras en los dos temas (el tema oscuro solo oscurece el lienzo de
// alrededor), así que las escenas siempre usan la variante clara.
export const UD = { rojo: "#ED3237", oro: "#B49739", azur: "#1291C0", verde: "#00A859", plata: "#98999A", sable: "#373435" };
export const TIPOS = {
  troncal: { claro: UD.rojo, oscuro: UD.rojo, nombre: "Troncal" },
  zonal: { claro: UD.azur, oscuro: UD.azur, nombre: "Zonal (SITP)" },
  alimentador: { claro: UD.verde, oscuro: UD.verde, nombre: "Alimentador" },
  dual: { claro: UD.oro, oscuro: UD.oro, nombre: "Dual" },
  otro: { claro: UD.plata, oscuro: UD.plata, nombre: "Otro" },
};
// Dentro de los marcos nunca hay superficie oscura.
export const oscuro = () => false;
export const colorTipo = (k, os = oscuro()) => (TIPOS[k] || TIPOS.otro)[os ? "oscuro" : "claro"];

// Avisa cuando cambia el tema (main.js cambia data-theme en <html>).
export function alCambiarTema(fn) {
  new MutationObserver(() => fn(oscuro())).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}
