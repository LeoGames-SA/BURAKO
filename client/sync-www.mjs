// Sincroniza los archivos del cliente a client/www/ para empaquetar en la app Android
// (Capacitor). Correr esto de nuevo cada vez que se quiera reflejar cambios recientes en
// una nueva build del APK: node sync-www.mjs && npx cap sync android && cd android &&
// (con JAVA_HOME/ANDROID_HOME apuntando a android-tools) ./gradlew assembleDebug
import { cpSync, mkdirSync, copyFileSync, rmSync, existsSync } from "fs";
import path from "path";

const ROOT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const WWW = path.join(ROOT, "www");

if (existsSync(WWW)) rmSync(WWW, { recursive: true, force: true });
mkdirSync(WWW, { recursive: true });

copyFileSync(path.join(ROOT, "burako.html"), path.join(WWW, "index.html"));

for (const f of ["burako.css", "burako.js", "burako-core.js", "manifest.webmanifest", "sw.js"]) {
  copyFileSync(path.join(ROOT, f), path.join(WWW, f));
}
for (const d of ["fonts", "audio", "vendor", "icons", "img"]) {
  cpSync(path.join(ROOT, d), path.join(WWW, d), { recursive: true });
}

console.log("www/ sincronizada.");
