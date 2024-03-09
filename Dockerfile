FROM node:20.11.0-alpine

USER root

WORKDIR /app

COPY package*.json ./

RUN npm install --production --silent

COPY . .

RUN npx tsc

EXPOSE 8000

EXPOSE 8001

CMD ["npm", "run", "start"]
