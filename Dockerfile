FROM node:16-slim

WORKDIR /app

COPY package*.json ./

RUN npm ci && npm cache clean --force

EXPOSE 3000

COPY ./ ./

CMD [ "node", "index.js" ]