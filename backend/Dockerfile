FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM base AS development
RUN npm ci
COPY . .
EXPOSE 3001
CMD ["npm", "run", "dev"]

FROM base AS production
COPY . .
EXPOSE 3001
CMD ["node", "src/index.js"]
