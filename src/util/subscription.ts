import { Database } from '../db'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const WebSocket = require('ws')

export type JetstreamEvent = {
  did: string
  time_us: number
  kind: 'commit' | 'identity' | 'account'
  commit?: {
    operation: 'create' | 'update' | 'delete'
    collection: string
    rkey: string
    record?: Record<string, unknown>
    cid?: string
  }
}

export abstract class FirehoseSubscriptionBase {
  constructor(
    public db: Database,
    public service: string,
  ) {}

  abstract handleEvent(evt: JetstreamEvent): Promise<void>

  async run(reconnectDelay: number) {
    const cursor = await this.getCursor()
    const params = new URLSearchParams({
      wantedCollections: 'app.bsky.feed.post',
    })
    if (cursor.cursor) {
      params.set('cursor', cursor.cursor.toString())
    }

    const url = `${this.service}/subscribe?${params.toString()}`
    console.log(`Connecting to Jetstream: ${url}`)

    const ws = new WebSocket(url)

    ws.on('message', async (data: Buffer) => {
      try {
        const evt: JetstreamEvent = JSON.parse(data.toString())
        if (evt.kind !== 'commit') return

        await this.handleEvent(evt)

        if (evt.time_us % 5 === 0) {
          await this.updateCursor(evt.time_us)
        }
      } catch (err) {
        console.error('jetstream could not handle message', err)
      }
    })

    ws.on('error', (err: Error) => {
      console.error('jetstream error', err)
    })

    ws.on('close', () => {
      console.log(`Jetstream closed, reconnecting in ${reconnectDelay}ms...`)
      setTimeout(() => this.run(reconnectDelay), reconnectDelay)
    })
  }

  async updateCursor(cursor: number) {
    await this.db
      .updateTable('sub_state')
      .set({ cursor })
      .where('service', '=', this.service)
      .execute()
  }

  async getCursor(): Promise<{ cursor?: number }> {
    const res = await this.db
      .selectFrom('sub_state')
      .selectAll()
      .where('service', '=', this.service)
      .executeTakeFirst()
    return res ? { cursor: res.cursor } : {}
  }
}
