FROM node:18-slim

# RUN apk add libsecret-dev git
RUN apt update
RUN apt install -y libsecret-1-dev git
RUN mkdir /firstrun && chown node:node /firstrun
RUN mkdir -p /home/node/app && chown -R node:node /home/node/app

WORKDIR /home/node/app

USER node

COPY --chown=node:node ./*.* .
COPY --chown=node:node ./src ./src
COPY --chown=node:node ./abis ./abis

RUN chmod +x start.sh && npm install --omit=dev && npm run build
ENTRYPOINT [ "sh", "./start.sh" ]
