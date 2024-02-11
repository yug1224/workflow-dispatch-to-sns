export default async ({ text, image }: { text: string; image?: string }) => {
  const WEBHOOK_URL = Deno.env.get('WEBHOOK_URL');
  const WEBHOOK_URL_WITH_IMAGE = Deno.env.get('WEBHOOK_URL_WITH_IMAGE');
  if (!WEBHOOK_URL) {
    console.log('WEBHOOK_URL is not defined');
    return;
  }
  if (!WEBHOOK_URL_WITH_IMAGE) {
    console.log('WEBHOOK_URL_WITH_IMAGE is not defined');
    return;
  }

  const postObj = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ value1: text, value2: image }),
  };

  console.log(JSON.stringify(postObj, null, 2));
  await fetch(image ? WEBHOOK_URL_WITH_IMAGE : WEBHOOK_URL, postObj);
  console.log('post to X');
};
