# Subgraph definitions for sidechain data unions

## NOTE: If new smart contracts are deployed

The json files in abis describe the contracts that are deployed in Polygon, not those found in packages/contracts. When a new deployment is made, the corresponding json should be copied here.

# Development

Run `streamr-docker-dev start graph-deploy-dataunion-subgraph` to start the graph-node locally and deploy the `main` version of DU subgraph.

Wait until `docker logs -f streamr-dev-graph-deploy-dataunion-subgraph` shows the deployment is complete. You should now be able to see and query the subgraph: http://localhost:8000/subgraphs/name/streamr-dev/dataunion/graphql (though initially it's empty so there's not much to query...). Top-left corner has "Explorer >" button that opens the list of object available in the subgraph.

You're now ready to deploy your changes:
```
npm run deploy-local
```

If the deploy completes without errors, refresh the browser page. You should be able to see your updated objects in the list.

Then you can paste graphQL queries at `http://127.0.0.1:8000/subgraphs/name/<githubname>/<subgraphname>/graphql`
or send queries to `http://localhost:8000/subgraphs/name/<githubname>/<subgraphname>`
for example with a gui like `https://github.com/graphql/graphql-playground`
or from a webapplication

# Prod deployment
First set the deployment token, it can be found on the top right of the subgraphs page, i.e. https://thegraph.com/hosted-service/subgraph/dataunions/data-unions-gnosis
You need to be owner in the DataunionDAO organisation in github.

```
npx graph auth
```
Select `hosted-service`.
When it asks for Deploy key, paste the accesstoken from the subgraphs page.

Then run the deploy command with the corresponding name:
```
npm run deploy-production-gnosis
```
and/or
```
npm run deploy-production-polygon
```
Select `hosted-service` if it asks.

# Docker environment deployment

Start Docker, stop any containers that may be running, and wipe the state:
```
streamr-docker-dev wipe
```

Delete old image:
```
docker rmi streamr/graph-deploy-dataunion-subgraph:dev
```

Re-create the docker image that deploys the DU subgraph:
```
docker build -t streamr/graph-deploy-dataunion-subgraph:dev .
```

Test locally before push:
```
streamr-docker-dev start graph-deploy-dataunion-subgraph && streamr-docker-dev log -f graph-deploy-dataunion-subgraph
npm run integration-test
```

Push to Docker hub:
```
docker push streamr/graph-deploy-dataunion-subgraph:dev
```
