import 'https://deno.land/std@0.193.0/dotenv/load.ts';
import getOgp from './src/getOgp.ts';
import postBluesky from './src/postBluesky.ts';
import postWebhook from './src/postWebhook.ts';
import resizeImage from './src/resizeImage.ts';

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

const uri = rt.facets?.reduce(
  (acc, facet): string => {
    if (acc) return acc;

    // facet.featuresが配列でない場合は終了
    if (!Array.isArray(facet.features)) return '';
    const feature = facet.features.find(
      (feature) => feature?.$type === 'app.bsky.richtext.facet#link',
    );

    // feature.uriがstringでない場合は終了
    if (typeof feature?.uri !== 'string') return '';
    return feature.uri;
  },
  '',
);

// uriがある場合はogpを取得
const og = await (async () => {
  if (!uri) return {};
  return await getOgp(uri);
})();

// 画像のリサイズ
const { mimeType, resizedImage } = await (async () => {
  const ogImage = og.ogImage?.at(0);
  if (!ogImage) {
    console.log('ogp image not found');
    return {};
  }
  return await resizeImage(new URL(ogImage.url, uri).href);
})();

// Blueskyに投稿
await postBluesky({
  agent,
  rt: rt,
  title: og.ogTitle || '',
  link: uri || '',
  description: og.ogDescription || '',
  mimeType,
  image: resizedImage,
});

// IFTTTを使ってXに投稿
await postWebhook(text);
