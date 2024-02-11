import { abortable } from 'https://deno.land/std@0.201.0/async/abortable.ts';
import AtprotoAPI, { BskyAgent, RichText } from 'npm:@atproto/api';

interface uploadRetry {
  $type?: 'blob';
  ref?: { $link: string };
  mimeType?: string;
  size?: number;
}

export default async ({
  agent,
  rt,
  ogTitle,
  ogUrl,
  ogDescription,
  ogMimeType,
  ogImage,
}: {
  agent: BskyAgent;
  rt: RichText;
  ogTitle: string;
  ogUrl: string;
  ogDescription: string;
  ogMimeType?: string;
  ogImage?: Uint8Array;
}) => {
  const uploadRetry = async (image: Uint8Array, mimeType: string, retryCount = 0): Promise<uploadRetry | undefined> => {
    try {
      const c = new AbortController();
      // 10秒でタイムアウト
      setTimeout(() => {
        console.log('timeout');
        return c.abort();
      }, 1000 * 10 * (retryCount + 1));

      // 画像をアップロード
      const uploadedImage = await abortable(
        agent.uploadBlob(image, {
          encoding: mimeType,
        }),
        c.signal,
      );
      console.log('success to upload image');

      // 投稿オブジェクトに画像を追加
      return {
        $type: 'blob',
        ref: {
          $link: uploadedImage.data.blob.ref.toString(),
        },
        mimeType: uploadedImage.data.blob.mimeType,
        size: uploadedImage.data.blob.size,
      };
    } catch (e) {
      console.log(JSON.stringify(e, null, 2));
      // 3回リトライしてもダメならundefinedを返す
      if (retryCount >= 3) {
        console.log('failed to upload image');
        return;
      }

      // リトライ処理
      console.log(`upload retry ${retryCount + 1} times`);
      return await uploadRetry(image, mimeType, retryCount + 1);
    }
  };

  const thumb = await (async () => {
    if (!(ogImage instanceof Uint8Array)) return;
    if (!(typeof ogMimeType === 'string')) return;
    console.log(
      'thumb',
      JSON.stringify(
        { imageByteLength: ogImage.byteLength, encoding: ogMimeType },
        null,
        2,
      ),
    );
    return await uploadRetry(ogImage, ogMimeType);
  })();

  const postObj:
    & Partial<AtprotoAPI.AppBskyFeedPost.Record>
    & Omit<AtprotoAPI.AppBskyFeedPost.Record, 'createdAt'> = {
      $type: 'app.bsky.feed.post',
      text: rt.text,
      facets: rt.facets,
      embed: {
        $type: 'app.bsky.embed.external',
        external: {
          uri: ogUrl,
          title: ogTitle,
          description: ogDescription,
          thumb,
        },
      },
      langs: ['ja'],
    };

  if (!ogUrl) {
    delete postObj.embed;
  }

  console.log(JSON.stringify(postObj, null, 2));
  await agent.post(postObj);
  console.log('post to Bluesky');
};
