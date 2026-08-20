# Imagen para desplegar server/ (WS + estático de client/) en Fly.io.
# Build context = raíz del repo (server.js sirve archivos de ../client, ver
# server/server.js:44) — por eso este Dockerfile vive en la raíz y no dentro
# de server/, y por eso el build de Fly (fly.toml) apunta acá con este mismo
# contexto en vez de solo la carpeta server/.
FROM node:22-alpine

WORKDIR /app

# Capa de deps separada del código para cachear npm install entre builds.
COPY server/package.json server/package-lock.json ./server/
RUN cd server && npm install --omit=dev

COPY server/ ./server/
COPY client/ ./client/

WORKDIR /app/server
ENV PORT=8181
EXPOSE 8181

CMD ["node", "server.js"]
