const https = require('https');

function httpsRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function heygenGet(path, apiKey) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.heygen.com',
      path,
      method: 'GET',
      headers: { 'X-Api-Key': apiKey },
    };
    https.get(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function getFirstVoiceId(apiKey) {
  const data = await heygenGet('/v2/voices', apiKey);
  const voices = data.data && data.data.voices;
  if (!voices || voices.length === 0) throw new Error('No voices found in HeyGen account.');
  // prefer US English female
  const preferred = voices.find(v =>
    v.language === 'English' && v.gender === 'Female' && v.locale && v.locale.startsWith('en-US')
  ) || voices[0];
  return preferred.voice_id;
}

async function getFirstAvatarId(apiKey) {
  const data = await heygenGet('/v2/avatars', apiKey);
  const avatars = data.data && data.data.avatars;
  if (!avatars || avatars.length === 0) throw new Error('No avatars found in HeyGen account.');
  return avatars[0].avatar_id;
}

async function generateScript(topic, duration, tone, apiKey) {
  const wordCount = duration === '30s' ? '60-75 words' : duration === '60s' ? '130-150 words' : '260-300 words';

  const prompt = `Write a professional educational video script for a dental office about: ${topic}
Duration: ${duration} (approximately ${wordCount})
Tone: ${tone}

Write ONLY the spoken narration — no stage directions, no formatting, no bullet points, no markdown.
Plain conversational sentences only, as if a friendly dentist is speaking directly to a patient.
End with a gentle call to action to schedule a consultation.`;

  const payload = JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 500,
  });

  const options = {
    hostname: 'api.openai.com',
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Length': Buffer.byteLength(payload),
    },
  };

  const res = await httpsRequest(options, payload);
  const data = JSON.parse(res.body);
  return data.choices[0].message.content.trim();
}

async function submitToHeyGen(script, avatarId, voiceId, apiKey) {
  const payload = JSON.stringify({
    type: 'avatar',
    avatar_id: avatarId,
    script: script,
    voice_id: voiceId,
    background: { type: 'color', value: '#f0f4f8' },
    aspect_ratio: '16:9',
    output_format: 'mp4',
    engine: { type: 'avatar_iii' },
  });

  const options = {
    hostname: 'api.heygen.com',
    path: '/v3/videos',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
      'Content-Length': Buffer.byteLength(payload),
    },
  };

  const res = await httpsRequest(options, payload);
  return JSON.parse(res.body);
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.HEYGEN_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!openaiKey) return { statusCode: 500, body: JSON.stringify({ error: 'OPENAI_API_KEY is not configured.' }) };
  if (!apiKey) return { statusCode: 500, body: JSON.stringify({ error: 'HEYGEN_API_KEY is not configured in Netlify.' }) };

  const { topic, duration, tone, voiceId: providedVoiceId } = JSON.parse(event.body);

  const [script, voiceId, avatarId] = await Promise.all([
    generateScript(topic, duration, tone),
    providedVoiceId ? Promise.resolve(providedVoiceId) : getFirstVoiceId(apiKey),
    getFirstAvatarId(apiKey),
  ]);

  const result = await submitToHeyGen(script, avatarId, voiceId, apiKey);

  const videoId = result.data && result.data.video_id;
  if (!videoId) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'HeyGen error: ' + JSON.stringify(result) }),
    };
  }

  console.log('Script generated:', script ? script.substring(0, 80) : 'EMPTY');
  console.log('Video ID:', videoId);

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ video_id: videoId, script: script || '' }),
  };
};
