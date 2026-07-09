const fetch = require('node-fetch') || globalThis.fetch;
async function test() {
  const apiKey = 'tsk_0Yt2ilue2JoAqgTZ9hPgUCio4Pmr0kO_1PIxfZPbaJm';
  const payload = {
    type: 'image_to_model',
    file: {
      type: 'png',
      url: 'https://firebasestorage.googleapis.com/v0/b/sekkeiya-app.appspot.com/o/users%2FAgQoBtl7Z4O2nC5T2uUe3ZfQ81I3%2Fimages%2F1715152222.png?alt=media&token=xyz'
    },
    model_version: 'v2.5-20250123'
  };
  console.log('Sending request...');
  try {
    const response = await fetch('https://api.tripo3d.ai/v2/openapi/task', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const text = await response.text();
    console.log('Response:', text);
  } catch(e) {
    console.error('Error:', e);
  }
}
test();
