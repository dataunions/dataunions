// eslint-disable-next-line import/no-extraneous-dependencies
const { KeyServer } = require('./test/test-utils/KeyServer')

export default async () => {
    await KeyServer.stopIfRunning()
}
