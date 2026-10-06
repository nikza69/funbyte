FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server.js simulator.js ./
COPY public ./public

EXPOSE 6677

CMD ["node", "server.js"]
