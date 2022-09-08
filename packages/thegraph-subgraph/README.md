# Subgraph definitions for sidechain data unions

# Prod deployment
First set the deployment token, it can be found on the top right of the subgraphs page, i.e. https://thegraph.com/hosted-service/subgraph/dataunions/data-unions-gnosis
You need to be owner in the DataunionDAO organisation in github.
```
npx graph auth --product hosted-service https://api.thegraph.com/deploy/ <token>
```
The old deployment scripts (giving the manifest name as param) are not working reliably any more, probably the hosted service changed a few things.
New way: 
- rename the file you want to deploy (i.e. subgraph.gnosis.production.yaml) to subgraph.yaml,
- then run the deploy command with the corresponding name:
```
npx graph deploy dataunions/data-unions-gnosis
```

# Development
first run a local eth blockchain (ganache, ganache-cli, harhat, ...) and deploy the contracts into that blockchain. You should also be abple to interact with the contract, for example with the REMIX IDE

then set up the graph infrastructure locally in docker (thegraph, ipfs, postgres):
```
git clone https://github.com/graphprotocol/graph-node/
cd graph-node/docker
ONLY FOR LINUX: ./setup.sh
docker-compose up
```

npm ci
npm run codegen
npm run build
npm run create-local
npm run deploy-local

(attention: create and deploy without '-local' will publish to the official The Graph API. And you can't ever delete a subgraph; )

then you can paste graphQL queries at http://127.0.0.1:8000/subgraphs/name/<githubname>/<subgraphname>/graphql
or send queries to http://localhost:8000/subgraphs/name/<githubname>/<subgraphname>
for example with a gui like https://github.com/graphql/graphql-playground 
or from a webapplication

example queries:
```
{
   streams {
    id,
    metadata,
    permissions {
      id,
  		user,
  		edit,
      canDelete,
      publish,
      subscribed,
      share,
    }
  }
}
```

```

{
  permissions {
      id,
  		user,
  		isadmin,
  		publishRights
  		viewRights
  		expirationTime
    stream {
      id
    }
  }
}
```
