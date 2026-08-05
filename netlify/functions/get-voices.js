const https = require('https');

exports.handler = async function (event) {
  const apiKey = process.env.HEYGEN_API_KEY;
  if (!apiKey) return { statusCode: 500, body: JSON.stringify({ error: 'HEYGEN_API_KEY not configured' }) };

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.heygen.com',
      path: '/v2/voices',
      method: 'GET',
      headers: { 'X-Api-Key': apiKey },
    };
    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const voices = (parsed.data && parsed.data.voices) || [];
          const simplified = voices.map(v => ({
            voice_id: v.voice_id,
            name: v.name,
            language: v.language,
            gender: v.gender,
            locale: v.locale,
          }));
          resolve({
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ voices: simplified }),
          });
        } catch (e) {
          resolve({ statusCode: 500, body: JSON.stringify({ error: 'Failed to parse voices' }) });
        }
      });
    }).on('error', (err) => {
      resolve({ statusCode: 500, body: JSON.stringify({ error: err.message }) });
    });
  });
};
