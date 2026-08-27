# Image de l'API CapitAll.
#
# Deux étapes. La première installe les dépendances de production, ce qui suppose de
# compiler bcrypt : le module est natif et npm n'en trouve pas de version précompilée
# pour la bibliothèque C d'Alpine. La seconde ne reprend que le résultat de cette
# compilation, sans la chaîne d'outils qui a servi à la produire.

FROM node:22-alpine AS dependances

RUN apk add --no-cache python3 make g++

WORKDIR /app

# Les fichiers de verrouillage sont copiés seuls, avant les sources : tant qu'ils ne
# changent pas, Docker réutilise la couche d'installation au lieu de la refaire.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:22-alpine AS execution

# Déclare l'environnement d'exécution : Express et les bibliothèques s'y règlent, et
# c'est la valeur que le module de configuration expose au reste du serveur.
ENV NODE_ENV=production

WORKDIR /app

COPY --from=dependances --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json server.js ./
COPY --chown=node:node src ./src

# L'image officielle fournit un utilisateur non privilégié : le serveur ne tourne
# jamais en root, et n'a aucun droit d'écriture sur ses propres fichiers.
USER node

EXPOSE 5000

# La route de santé ne consulte ni la base ni le cache : elle répond que le processus
# est vivant et sert des requêtes, ce qui est exactement la question posée ici.
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=5 \
    CMD wget --spider -q http://127.0.0.1:5000/api/sante || exit 1

CMD ["node", "server.js"]
