CONTAINER_ALREADY_STARTED="/firstrun/CONTAINER_ALREADY_STARTED_PLACEHOLDER"
if [ ! -e $CONTAINER_ALREADY_STARTED ]; then
    touch $CONTAINER_ALREADY_STARTED
    echo "-- First container startup, waiting 30sec, then deploying subgraph --"
    sleep 30s;
    echo "CREATING THE SUBGRAPH DEPLOYER IMAGE FOR THE   FAST CHAIN"
    npm run create-fastchain
    npm run deploy-fastchain
else
    echo "-- Not first container startup, doing nothing.--"
fi