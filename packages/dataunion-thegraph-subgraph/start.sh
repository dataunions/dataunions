CONTAINER_ALREADY_STARTED="/firstrun/CONTAINER_ALREADY_STARTED_PLACEHOLDER"
if [ ! -e $CONTAINER_ALREADY_STARTED ]; then
    touch $CONTAINER_ALREADY_STARTED
    echo "-- First container startup, waiting 30sec, then deploying subgraph --"
    sleep 30s; npm run doAll-inside-docker-dev
else
    echo "-- Not first container startup, doing nothing.--"
fi