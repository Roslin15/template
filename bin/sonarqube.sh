#!/bin/bash
set -e

# Runs application's test script within Travis context to generate coverage report accessible by
# Sonarqube docker container
npm test
# Run Sonarqube scan on test results and publish
./node_modules/.bin/scan_code.sh -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info
