#!/bin/bash
set -e

# Parses the vault manifest file, altering the `env` property to match the one being deployed
envsubst <.vault-manifest.json >tmp.json
mv tmp.json .vault-manifest.json

# Get secrets from vault
## Inject build-time variables into environment
source ./node_modules/.bin/read_sm_env.sh

# Tags and publish docker image
## Determines version using semantic-release, publishes it to Github Releases
## and to Artifactory
npm run publish &&
  KS_IMAGE_VERSION=$(git describe --tags --abbrev=0) &&
  export KS_IMAGE_VERSION &&
  "$TRAVIS_BUILD_DIR"/node_modules/.bin/build_docker_image.sh &&
  "$TRAVIS_BUILD_DIR"/node_modules/.bin/publish_docker_image.sh
