# Subgraph definitions for sidechain data unions

# Prod deployment
First set the deployment token, it can be found on the top right of the subgraphs page, i.e. https://thegraph.com/hosted-service/subgraph/dataunions/data-unions-gnosis
You need to be owner in the DataunionDAO organisation in github.

The json files in abis describe the contracts that are deployed in Polygon, not those found in packages/contracts. When a new deployment is made, the corresponding json should be copied here.
```
npx graph auth --product hosted-service
```
Then when it asks for Deploy key, paste the accesstoken from the subgraphs page.

Then rename the file you want to deploy (i.e. subgraph.gnosis.production.yaml) to subgraph.yaml,
Then then run the deploy command with the corresponding name:
```
npm run deploy-production-gnosis
```
or
```
npm run deploy-production-polygon
```

# Development

Run `streamr-docker-dev start graph-deploy-dataunion-subgraph` to start the graph-node locally and deploy the `main` version of DU subgraph.

Wait until `docker logs -f streamr-dev-graph-deploy-dataunion-subgraph` shows the deployment is complete. You should now be able to see and query the subgraph: http://localhost:8000/subgraphs/name/streamr-dev/dataunion/graphql (though initially it's empty so there's not much to query...). Top-left corner has "Explorer >" button that opens the list of object available in the subgraph.

You're now ready to deploy your changes: `npm run deploy-local`

If the deploy completes without errors, refresh the browser page. You should be able to see your updated objects in the list.
