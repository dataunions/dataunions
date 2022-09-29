#!/usr/bin/env node

const DefaultJoinServer = require('../DefaultJoinServer')
require('dotenv').config()

;(async () => {
	const srv = new DefaultJoinServer()
	srv.start()
})()
