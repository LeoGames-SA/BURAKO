import { defineConfig } from "vite";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// Bundlea SOLO las dependencias npm (GSAP, y más adelante Three.js si Fase 3
// decide que aporta valor) en un único archivo global `vendor/vendor-bundle.js`.
//
// burako.js y burako-core.js NO pasan por Vite ni se convierten a ES modules:
// son ~5500 líneas de código legacy en sloppy mode que nunca se probaron en un
// browser real dentro de este entorno de trabajo (ver docs/redesign/01-audit.md).
// Convertirlas a módulos las fuerza a strict mode sin forma de verificar que
// nada se rompe. En cambio, vendor-bundle.js expone `window.gsap` (y
// `window.THREE` cuando corresponda) como variables globales clásicas, para
// que el código legacy las consuma exactamente como consume cualquier otra
// global hoy — cero riesgo de conversión, mismo resultado práctico (GSAP real,
// instalado por npm, versionado).
//
// client/burako.html sigue siendo el archivo que se abre con doble clic en
// modo offline, sin ningún dev server — vendor-bundle.js es un archivo local
// más, cargado con <script> normal, igual que burako.js. Ver "Decisión de
// build" en docs/redesign/02-design-dna.md §8 para el razonamiento completo.
export default defineConfig({
  build: {
    outDir: "vendor",
    emptyOutDir: false,
    lib: {
      entry: __dirname + "src/vendor.js",
      name: "BurakoVendor",
      formats: ["iife"],
      fileName: () => "vendor-bundle.js",
    },
  },
});
