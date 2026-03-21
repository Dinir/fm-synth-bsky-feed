import { FirehoseSubscriptionBase, JetstreamEvent } from './util/subscription'

export class FirehoseSubscription extends FirehoseSubscriptionBase {
  async handleEvent(evt: JetstreamEvent) {
    if (!evt.commit) return

    if (evt.commit.operation === 'delete') {
      const uri = `at://${evt.did}/app.bsky.feed.post/${evt.commit.rkey}`
      await this.db
        .deleteFrom('post')
        .where('uri', '=', uri)
        .execute()
      return
    }

    if (evt.commit.operation === 'create' && evt.commit.record) {
      const text = (evt.commit.record.text as string) ?? ''
      const searchTerms = [
        'FM Synth',
        'FM synth',
        'fm synth',
        'FM Synthesizer',
        'FM synthesizer',
        'fm synthesizer',
        'FM Synthesizers',
        'FM synthesizers',
        'fm synthesizers',
        'FMシンセ',
        'FMシンセサイザー',
      ]
      if (!searchTerms.some((term) => text.includes(term))) return

      const uri = `at://${evt.did}/app.bsky.feed.post/${evt.commit.rkey}`
      await this.db
        .insertInto('post')
        .values({
          uri,
          cid: evt.commit.cid ?? '',
          indexedAt: new Date().toISOString(),
        })
        .onConflict((oc) => oc.doNothing())
        .execute()
    }
  }
}
