# DU client requires the types generated from DU contracts
unit-test: ../contracts/typechain
	npx ganache -p 3456 -m testrpc &
	npx jest --testTimeout 30000 --runInBand test/unit
	killall node # terminate ganache

# compile contracts, generate types
../contracts/typechain:
	cd ../contracts && npm run build
