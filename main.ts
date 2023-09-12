import 'https://deno.land/std@0.193.0/dotenv/load.ts';
import AtprotoAPI from 'npm:@atproto/api';
const { BskyAgent, RichText } = AtprotoAPI;
const service = 'https://bsky.social';
const agent = new BskyAgent({ service });
const identifier = Deno.env.get('BLUESKY_IDENTIFIER') || '';
const password = Deno.env.get('BLUESKY_PASSWORD') || '';
await agent.login({ identifier, password });

// メッセージを取得
const text = Deno.env.get('MESSAGE') || '';
console.log(text);

// 対象がなかったら終了
if (!text.length) {
  console.log('not found message');
  Deno.exit(0);
}

// リッチテキストを作成
const rt = new RichText({ text });
await rt.detectFacets(agent);

// Blueskyに投稿
const postObj: Partial<AtprotoAPI.AppBskyFeedPost.Record> &
  Omit<AtprotoAPI.AppBskyFeedPost.Record, 'createdAt'> = {
  $type: 'app.bsky.feed.post',
  text: rt.text,
  facets: rt.facets,
  langs: ['ja'],
};
console.log(JSON.stringify(postObj, null, 2));
await agent.post(postObj);
console.log('post to Bluesky');

// Webhookに投稿
const WEBHOOK_URL = Deno.env.get('WEBHOOK_URL');
if (!WEBHOOK_URL) {
  console.log('WEBHOOK_URL is not defined');
  Deno.exit(0);
}

await fetch(WEBHOOK_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ value1: text }),
});
console.log('post to X');
