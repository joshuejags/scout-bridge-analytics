FROM node:20-bookworm-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 3000

# docker-compose.yml bind-mounts the source over this and runs the CRA dev
# server (matching the dev-mode workflow the rest of the project uses),
# not a production static build.
CMD ["npm", "start"]
