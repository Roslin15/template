# Create intermediate image for testing & building app
FROM docker-na.artifactory.swg-devops.com/dbg-m-symposium-docker-local/ubi8-nodejs-16 AS build

USER 1001:0

# On legacy docker engine - Copy must occur before workdir for /home/app ownership
COPY --chown=1001:0 . /home/app

WORKDIR /home/app

RUN npm ci && \
    npm test && \
    npm run check-format && \
    npm run build && \
    npm prune --production && \
    rm .npmrc


# Create final image for publishing & deploying using intermediate build
FROM docker-na.artifactory.swg-devops.com/dbg-m-symposium-docker-local/ubi8-nodejs-16-minimal

USER 1001:0

# On legacy docker engine - Copy must occur before workdir for /home/app ownership
COPY --from=build --chown=1001:0 /home/app/package*.json /home/app/
COPY --from=build --chown=1001:0 /home/app/dist /home/app/dist
COPY --from=build --chown=1001:0 /home/app/bin /home/app/bin
COPY --from=build --chown=1001:0 /home/app/node_modules /home/app/node_modules

WORKDIR /home/app

RUN chgrp -R 0 /home/app && \
    chmod -R g=u /home/app

ENV NODE_OPTIONS="--require /home/app/node_modules/@instana/collector/src/immediate --max-http-header-size 16384"
ENV NO_UPDATE_NOTIFIER=true

# match port exposed by app & in .travis.yml
EXPOSE 4001
CMD [ "npm", "start" ]