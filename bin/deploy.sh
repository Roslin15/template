#!/bin/bash
set -e

# Parses the vault manifest file, altering the `env` property to match the one being deployed
envsubst < .vault-manifest.json > tmp.json
mv tmp.json .vault-manifest.json

# Get secrets from vault
## Inject build-time and run-time variables into environment
source ./node_modules/.bin/read_sm_env.sh secrets.env

# Extract runtime vars from local env injected from Travis build stage and vault.
# Store in an env file (used by pods when deployed)
# Note: `KS_ENV_PREFIX` is defined in travis global env vars and should match `runtimeVarsPrefix` in .vault-manifest.json
env | grep ${KS_ENV_PREFIX} | sed 's/'${KS_ENV_PREFIX}'//' > variables.env

# Set the functional user's IBMCloud api to be used when deploying application to openshift
# `KS_API_KEY_CM_ACCOUNT` should be defined in vault
export KS_API_KEY=${KS_API_KEY_CM_ACCOUNT}

echo "Deploying KS_IMAGE_VERSION=${KS_IMAGE_VERSION}"

"$TRAVIS_BUILD_DIR"/node_modules/.bin/deploy_to_openshift.sh
