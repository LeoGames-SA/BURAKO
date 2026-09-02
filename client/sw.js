/* Service worker de Burako — cachea el juego para que abra en pantalla completa desde el
   ícono del celular y funcione sin conexión (modo Casual contra IA, que corre 100% en el
   cliente). El modo online sigue necesitando red para el WebSocket — eso no lo toca este SW.
   IMPORTANTE: subir CACHE_VERSION cada vez que cambie GAME_VERSION en burako.js, si no los
   celulares que ya instalaron la app se quedan con los archivos viejos cacheados. */
const CACHE_VERSION = "burako-v1.2.18";

const PRECACHE_URLS = [
  "./",
  "./burako.html",
  "./burako.css",
  "./burako.js",
  "./burako-core.js",
  "./vendor/vendor-bundle.js",
  "./img/tower/fondo.png",
  "./img/tower/torre.png",
  "./img/tower/cofre.png",
  "./img/tower/boton-ir-a-la-torre.png",
  "./img/pass/fondo.png",
  "./img/pass/banner.png",
  "./img/pass/emblema.png",
  "./img/pass/cofre.png",
  "./img/pass/boton-ver-pase.png",
  "./img/ruleta/fondo.png",
  "./img/ruleta/banner.png",
  "./img/ruleta/ruleta.png",
  "./img/ruleta/monedas.png",
  "./img/ruleta/boton.png",
  "./img/profile/panel.png",
  "./img/profile/avatar-frame.png",
  "./img/profile/avatar-default.png",
  "./img/profile/rank-shield.png",
  "./img/menu-buttons/jugar.png",
  "./img/menu-buttons/perfil.png",
  "./img/menu-buttons/tienda.png",
  "./img/menu-buttons/novedades.png",
  "./img/menu/fondo.png",
  "./img/login/fondo.png",
  "./img/login/logo.png",
  "./img/login/panel.png",
  "./img/login/panel-info.png",
  "./img/login/boton.png",
  "./img/login/tiles.png",
  "./fonts/fonts.css",
  "./fonts/Cinzel-variable.woff2",
  "./fonts/CinzelDecorative-400.woff2",
  "./fonts/CinzelDecorative-700.woff2",
  "./fonts/CinzelDecorative-900.woff2",
  "./fonts/Manrope-variable.woff2",
  "./audio/musica-fondo.mp3",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-512-maskable.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then((c) => c.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) caches.open(CACHE_VERSION).then((c) => c.put(req, res.clone()));
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
