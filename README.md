# usage-template

Conman microservice base template to seed new repos

## General

- [Git](http://git-scm.com): Distributed version control system
- [Node](http://nodejs.org/): Runtime environment for voitho (v14.17.4)

We recommend using the standard Mac installers for [Git](http://git-scm.com/download/mac).

Node v16 is the latest version that the project supports right now.

install node with nvm
- nvm install 16
- nvm use 16


We use `express-openapi-validator` to validate api requests/responses and to automatically link routes to handlers. See [here](https://github.com/cdimascio/express-openapi-validator#example-express-api-server-with-operationhandlers) for more details.

## Prereqs

ConMan uses nvm to automatically set the node version.  A '.nvmrc' file has been added to the repos.  Install nvm.

## Linter
ESlint: https://github.com/standard/standard


## List of item contained in the template

- Server and APP test
- Liveness Test
- Test Case
- CI/CD
- OpenApi validator for ExpressJS
- Dependency examples

## To use this template update

1) package.json
- repo name
- description
- repository URL
- jest-html-reporter, pageTitle

2) remove examples from services and server.ts
3) CI/CD: [See section below](#CI/CD)
4) Update the System Manager model
5) Remove the producer sample for load dependency
6) Find all the 'TODO' and address them

## CI/CD

Updates required to initialize CI/CD for new projects initialized from this template:
1. Reference the [General documentation](https://ibm.ent.box.com/notes/859545550020) and files within repo for more detailed explanations
2. `.travis.yml`
   1. Secure Variables
      1. `ARTIFACTORY_API_KEY`
      2. `VAULT_STAGE_APP_ROLE_ID`, `VAULT_STAGE_SECRET_ID`, `VAULT_PROD_APP_ROLE_ID`, `VAULT_PROD_SECRET_ID`
   2. App specific Vars
      1. `KS_APP_NAME` 
      2. `KS_APP_PORT`
      3. `KS_ENV_PREFIX`
   3. Build stage configurations:
      1. remove `OR branch = master` from `Test and Build` stage `if` condition once new repo instantiated from template
      2. remove `(NOT repo = symposium/usage-template) AND` from all stages' `if` conditions once new repo instantiated from template
   4. Jobs:
      1. Update `USAGE_TEMPLATE_ENV` in each deploy job (sandbox, prod us-east, prod eu-de) to the `runtimeVarsPrefix` used in the `.vault-manifest-<env>.json` files (see below)
3. `Dockerfile`
   1. Port exposed: `EXPOSE <PORT_NUM>`
4. `.vault-manifest-stage.json` & `.vault-manifest-prod.json`
   1. `appName`
   2. `runtimeVarsPrefix`
5. Activate Travis for repo
   1. See [General documentation](https://ibm.ent.box.com/notes/859545550020)

## Local run

Prereq:  set up an .npmrc file

- make a copy of .env.example to .env.
- complete with any additional variables
  -npm install
  -npm run test
  -npm run dev


## Dependency Example

- COS Example
  - loads as single instance of COS Handler
  - runs the sample
- UsageStatus example
  - loads mongoImpl
  - runs the sample
- Feature Flags Example
  - loads a single instance of featureFlags
  - runs the sample
- Rabbit Producer and Mock Step Sample
  - loads some initial messages for the step to consume
  - runs the sample
  - runs the mock step

- AuthService Example

  To use the AuthService example, run the app and then submit requests using the following format:
  ```
  curl -L 'http://localhost:4000/authExample/<path>' -H 'Authorization: Bearer <token>'
  ```
  The options for `<path>` and corresponding required values for `<token>` are:
    - any - token can be any RHM access token, RHM pull secret, or IBM entitlement key
    - accessToken - token can be any RHM access token
    - pullSecret - token can be any RHM pull secret or IBM entitlement key
    - superUser - token must be an RHM access token generated for a super user (to define a super user, set the SUPERUSER_IAM_ACCESS_LIST in your `.env`)
    - none - no token needed (can remove the `-H 'Authorization: Bearer <token>'` from the curl entirely)

  For every path, if you successfully authenticate the response will say what kind of token you used.
