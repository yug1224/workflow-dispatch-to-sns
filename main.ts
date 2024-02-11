import 'https://deno.land/std@0.193.0/dotenv/load.ts';
import AtprotoAPI from 'npm:@atproto/api';
import getOgp from './lib/getOgp.ts';
import postBluesky from './lib/postBluesky.ts';
import postWebhook from './lib/postWebhook.ts';
import resizeImage from './lib/resizeImage.ts';

try {
  // メッセージを取得
  const MESSAGE = (Deno.env.get('MESSAGE') || '').trim();
  console.log(MESSAGE);
  const IMAGE_URL = (Deno.env.get('IMAGE_URL') || '').trim();
  console.log(IMAGE_URL);

  // 対象がなかったら終了
  if (!MESSAGE.length) {
    console.log('not found message');
    Deno.exit(0);
  }

  // Blueskyにログイン
  const { BskyAgent, RichText } = AtprotoAPI;
  const service = 'https://bsky.social';
  const agent = new BskyAgent({ service });
  const identifier = Deno.env.get('BLUESKY_IDENTIFIER') || '';
  const password = Deno.env.get('BLUESKY_PASSWORD') || '';
  await agent.login({ identifier, password });

  // リッチテキストを作成
  const rt = new RichText({ text: MESSAGE });
  await rt.detectFacets(agent);

  // uriを取得
  const uri = rt.facets?.reduce(
    (acc, facet): string => {
      if (acc) return acc;

      // facet.featuresが配列でない場合は空文字を返す
      if (!Array.isArray(facet.features)) return '';
      const feature = facet.features.find(
        (feature) => feature?.$type === 'app.bsky.richtext.facet#link',
      );

      // feature.uriがstringでない場合は空文字を返す
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
  const { mimeType: ogMimeType, resizedImage: ogImage } = await (async () => {
    const ogImage = og.ogImage?.at(0);
    if (!ogImage) {
      console.log('ogp image not found');
      return {};
    }
    return await resizeImage(new URL(ogImage.url, uri).href);
  })();

  // 画像のリサイズ
  const { mimeType, resizedImage } = await (async () => {
    if (!IMAGE_URL) {
      console.log('IMAGE_URL not found');
      return {};
    }
    return await resizeImage(new URL(IMAGE_URL).href);
  })();

  // Blueskyに投稿
  await postBluesky({
    agent,
    rt: rt,
    ogTitle: (og.ogTitle || '').trim(),
    ogUrl: uri || '',
    ogDescription: (og.ogDescription || '').trim(),
    ogMimeType,
    ogImage,
    mimeType,
    image: resizedImage,
  });

  // IFTTTを使ってXに投稿
  await postWebhook({
    text: MESSAGE,
    image: IMAGE_URL || undefined,
  });

  // 終了
  Deno.exit(0);
} catch (e) {
  // エラーが発生したらログを出力して終了
  console.error(e.stack);
  console.error(JSON.stringify(e, null, 2));
  Deno.exit(1);
}
