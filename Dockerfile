# Étape 1: Base de l'image
FROM node:18-alpine

# Étape 2: Définir le répertoire de travail
WORKDIR /app

# Étape 3: Copier les dépendances du serveur et les installer
# On copie d'abord package.json pour profiter du cache de Docker.
COPY server/package*.json ./
RUN npm install

# Étape 4: Copier le reste du code de l'application
# Copier le serveur et le client dans le conteneur
COPY server/ ./
COPY client/ ./client/

# Étape 5: Exposer le port que le serveur utilise
EXPOSE 3000

# Étape 6: Commande pour démarrer le serveur
CMD [ "node", "server.js" ]
