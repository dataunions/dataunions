#!/usr/bin/env node

const DefaultJoinServer = require('../DefaultJoinServer')
require('dotenv').config()

;(async () => {
	const dataUnionClientOptions = (process.env.DATA_UNION_CLIENT_OPTIONS ? JSON.parse(process.env.DATA_UNION_CLIENT_OPTIONS) : {})

	const srv = new DefaultJoinServer(dataUnionClientOptions)
	srv.start()
})()
