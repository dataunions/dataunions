# DU client requires the types generated from DU contracts
unit-test: ../contracts/typechain
	npx ganache -p 3456 -m testrpc &
	exit 0 # terminate ganache
	npx jest --testTimeout 30000 --runInBand test/unit

# compile contracts, generate types
../contracts/typechain:
	cd ../contracts; npm run build
