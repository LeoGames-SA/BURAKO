// Entry point de Vite: expone dependencias npm como globales clásicas para que
// burako.js / burako-core.js (scripts no-module) las usen sin conversión.
// No agregar imports acá sin necesidad real en una fase concreta — ver §3
// del pedido original: "no usar Three.js simplemente por usarlo".
import { gsap } from "gsap";
import { Flip } from "gsap/Flip";

gsap.registerPlugin(Flip);
window.gsap = gsap;
window.Flip = Flip;
