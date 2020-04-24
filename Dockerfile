FROM node:13.13.0

COPY . /app
WORKDIR /app

RUN npm i
RUN npm t

CMD npm run build
