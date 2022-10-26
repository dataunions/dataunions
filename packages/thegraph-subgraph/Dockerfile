FROM node:16-alpine

RUN apk add libsecret-dev git
RUN mkdir /firstrun && chown node:node /firstrun
RUN mkdir -p /home/node/app && chown -R node:node /home/node/app

WORKDIR /home/node/app

USER node

COPY --chown=node:node . .

RUN npm i
RUN chmod +x start.sh
ENTRYPOINT [ "sh", "./start.sh" ]
