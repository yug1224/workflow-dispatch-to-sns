import sharp from 'npm:sharp';

interface fetchRetry {
  response?: Response;
  contentType?: string;
}

export default async ({ url, maxWidth = 1200, maxHeight = 1200, maxByteLength = 976.56 * 1000 }: {
  url: string;
  maxWidth?: number;
  maxHeight?: number;
  maxByteLength?: number;
}) => {
  const fetchRetry = async (url: string, retryCount = 0): Promise<fetchRetry> => {
    const response = await fetch(url);
    const contentType = response.headers.get('content-type') || '';

    // 画像が取得できなかった場合
    if (!response.ok || !contentType?.includes('image')) {
      // 3回リトライしてもダメなら空オブジェクトを返す
      if (retryCount >= 3) return {};

      // リトライ処理
      console.log(`fetch retry ${retryCount + 1} times`);
      return await fetchRetry(url, retryCount + 1);
    }

    return {
      response,
      contentType,
    };
  };
  const { response, contentType } = await fetchRetry(url);

  if (!response) {
    console.log('failed to get image');
    return {};
  }
  if (!contentType) {
    console.log('failed to get image');
    return {};
  }

  const buffer = await response.arrayBuffer();

  try {
    const resizeRetry = async ({
      buffer,
      contentType,
      retryCount = 0,
    }: {
      buffer: ArrayBuffer;
      contentType: string;
      retryCount?: number;
    }): Promise<{ mimeType?: string; resizedImage?: Uint8Array }> => {
      const image = await sharp(buffer);
      const { width, height } = await image.metadata();
      const resizeWidth = width && height && width >= height ? maxWidth : undefined;
      const resizeHeight = width && height && width < height ? maxHeight : undefined;

      const mimeType = 'image/avif';
      const resizedImage = await image.resize({ width: resizeWidth, height: resizeHeight }).avif({
        quality: 100 - (retryCount * 2),
      }).toBuffer();

      console.log('resizedImage.byteLength', resizedImage.byteLength);
      if (resizedImage && resizedImage.byteLength > maxByteLength) {
        // リトライ処理
        console.log(`resize retry ${retryCount + 1} times`);
        return await resizeRetry({ buffer, contentType, retryCount: retryCount + 1 });
      }
      return { mimeType, resizedImage };
    };
    const { mimeType, resizedImage } = await resizeRetry({ buffer, contentType });

    console.log('success to resize image');
    return {
      mimeType,
      resizedImage,
    };
  } catch {
    // 画像のリサイズに失敗した場合は空オブジェクトを返す
    console.log('failed to resize image');
    return {};
  }
};
