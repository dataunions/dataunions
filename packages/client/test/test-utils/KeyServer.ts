import express from 'express'
import cors from'cors'
import http from 'http'

/**
 * Used to spin up an HTTP server used by integration tests to fetch private keys having non-zero ERC-20 token
 * balances in streamr-docker-dev environment.
 */
/* eslint-disable no-console */
export class KeyServer {
    public static readonly KEY_SERVER_PORT = 45454
    private static singleton: KeyServer | undefined
    private readonly ready: Promise<unknown>
    private server?: http.Server

    public static async startIfNotRunning(): Promise<void> {
        if (KeyServer.singleton === undefined) {
            KeyServer.singleton = new KeyServer()
            await KeyServer.singleton.ready
        }
    }

    public static async stopIfRunning(): Promise<void> {
        if (KeyServer.singleton !== undefined) {
            const temp = KeyServer.singleton
            KeyServer.singleton = undefined
            await temp.destroy()
        }
    }

    private constructor() {
        const app = express()
        app.use(cors())
        let c = 1
        app.get('/key', (_req, res) => {
            const hexString = c.toString(16)
            const privateKey = '0x' + hexString.padStart(64, '0')
            res.send(privateKey)
            c += 1
            if (c > 1000) {
                c = 1
            } else if (c === 10) {
                /*
                    NET-666: There is something weird about the 10th key '0x0000000000....a'
                    that causes StreamRegistryContract to read a weird value to msg.sender
                    that does NOT correspond to the public address. Until that is investigated
                    and solved, skipping this key.
                 */
                c = 11
            }
        })
        console.info(`starting up keyserver on port ${KeyServer.KEY_SERVER_PORT}...`)
        this.ready = new Promise((resolve, reject) => {
            this.server = app.listen(KeyServer.KEY_SERVER_PORT)
                .once('listening', () => {
                    console.info(`keyserver started on port ${KeyServer.KEY_SERVER_PORT}`)
                    resolve(true)
                })
                .once('error', (err) => {
                    reject(err)
                })
        })
    }

    private destroy(): Promise<unknown> {
        if (this.server === undefined) {
            return Promise.resolve(true)
        }
        return new Promise((resolve, reject) => {
            this.server!.close((err) => {
                if (err) {
                    reject(err)
                } else {
                    console.info(`closed keyserver on port ${KeyServer.KEY_SERVER_PORT}`)
                    resolve(true)
                }
            })
        })
    }
}

