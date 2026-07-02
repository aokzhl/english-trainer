import { createDb } from '../db/client'
import { buildApp } from './buildApp'
import { config } from './config'

const db = await createDb(config.databaseUrl)
const app = buildApp({ db, logger: true })

app.listen({ port: config.port, host: '0.0.0.0' }).catch((error) => {
  app.log.error(error)
  process.exit(1)
})

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void app.close().then(() => process.exit(0))
  })
}
