#!/bin/bash
set -e

# configure .npmrc to access Artifactory. The output of each curl command is
# configuration information for npm to access that repository
curl -f -s -H "Authorization: Bearer ${ARTIFACTORY_TOKEN}" ${ARTIFACTORY_REPO_URL} >> .npmrc
curl -f -s -H "Authorization: Bearer ${ARTIFACTORY_TOKEN}" https://docker-na.artifactory.swg-devops.com/artifactory/api/npm/iam-npm-local/auth/iam >> .npmrc
