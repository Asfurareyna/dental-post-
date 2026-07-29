const https = require('https');

exports.handler = async function (event) {
  const videoId = event.queryStringParameters && event.queryStringParameters.video_id;

  if (!videoId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing video_id' }) };
  }

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.heygen.com',
      path: `/v1/video_status.get?video_id=${videoId}`,
      method: 'GET',
      headers: {
        'X-Api-Key': process.env.HEYGEN_API_KEY,
      },
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: 200,
          headers: { 'Content-Type': 'application/json' },
          body: data,
        });
      });
    }).on('error', (err) => {
      resolve({
        statusCode: 500,
        body: JSON.stringify({ error: err.message }),
      });
    });
  });
};
