FROM node:18-alpine AS pkgs
RUN mkdir /build
COPY ./package.json ./yarn.lock /build
WORKDIR /build
RUN yarn install --dev

FROM pkgs AS server
COPY ./tsconfig.json ./tsconfig.server.json ./webpack.config.js ./webpack.server.js /build
COPY ./server /build/server
COPY ./src /build/src
WORKDIR /build
RUN yarn build-server-prod

FROM pkgs as client
COPY ./tsconfig.client.json /build
COPY ./config /build/config
COPY ./src /build/src
COPY ./scripts /build/scripts
COPY ./public /build/public
WORKDIR /build
RUN yarn build

FROM node:18-alpine AS prod
RUN mkdir /moon /moon/server
COPY --from=server /build/dist/server-build.js /moon/server.js
COPY --from=client /build/build /moon/www
COPY --from=pkgs /build/node_modules/vm2/lib/bridge.js /moon/bridge.js
COPY --from=pkgs /build/node_modules/vm2/lib/setup-sandbox.js /moon/setup-sandbox.js

ENV MOON_PRODUCTION=1
ENV MOON_STATIC_ROOT=/moon/www

WORKDIR /moon
CMD [ "node", "server.js" ]