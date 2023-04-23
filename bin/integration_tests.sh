#!/bin/bash
set -e

# Parses the vault manifest file, altering the `env` property to match the one being deployed
envsubst <.vault-manifest.json >tmp.json
mv tmp.json .vault-manifest.json

# Get secrets from vault
## Inject build-time variables into environment
source ./node_modules/.bin/read_sm_env.sh

# Start integration test
./node_modules/.bin/integrationTests
