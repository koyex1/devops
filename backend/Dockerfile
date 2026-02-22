FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev && npm install -g pm2

COPY . .

EXPOSE 4000 50051
CMD ["npm", "run", "start"]