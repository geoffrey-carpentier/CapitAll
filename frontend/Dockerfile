# Image de l'interface CapitAll.
#
# Vite produit des fichiers statiques : une fois la compilation faite, ni Node ni les
# dépendances ne servent plus à rien. L'image finale ne contient donc que ces fichiers
# et le serveur qui les distribue.

FROM node:22-alpine AS compilation

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS execution

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=compilation /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 \
    CMD wget --spider -q http://127.0.0.1/ || exit 1

# Le processus maître de l'image officielle démarre en root le temps de lier le port,
# puis fait tourner ses processus de travail sous l'utilisateur nginx. C'est le
# comportement par défaut de l'image, conservé tel quel.
