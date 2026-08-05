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

const TOPIC_IMAGES = {
  'Dental Implants':        'https://images.pexels.com/photos/3881449/pexels-photo-3881449.jpeg?auto=compress&cs=tinysrgb&w=1280&h=720&dpr=1',
  'Teeth Whitening':        'https://images.pexels.com/photos/3779709/pexels-photo-3779709.jpeg?auto=compress&cs=tinysrgb&w=1280&h=720&dpr=1',
  'Invisalign':             'https://images.pexels.com/photos/4269694/pexels-photo-4269694.jpeg?auto=compress&cs=tinysrgb&w=1280&h=720&dpr=1',
  'Root Canal':             'https://images.pexels.com/photos/6812572/pexels-photo-6812572.jpeg?auto=compress&cs=tinysrgb&w=1280&h=720&dpr=1',
  'Veneers':                'https://images.pexels.com/photos/3779706/pexels-photo-3779706.jpeg?auto=compress&cs=tinysrgb&w=1280&h=720&dpr=1',
  'Dental Crowns':          'https://images.pexels.com/photos/3881449/pexels-photo-3881449.jpeg?auto=compress&cs=tinysrgb&w=1280&h=720&dpr=1',
  'Gum Disease Treatment':  'https://images.pexels.com/photos/4269694/pexels-photo-4269694.jpeg?auto=compress&cs=tinysrgb&w=1280&h=720&dpr=1',
  "Children's Dental Care": 'https://images.pexels.com/photos/5355503/pexels-photo-5355503.jpeg?auto=compress&cs=tinysrgb&w=1280&h=720&dpr=1',
  'Dental Cleaning':        'https://images.pexels.com/photos/3881449/pexels-photo-3881449.jpeg?auto=compress&cs=tinysrgb&w=1280&h=720&dpr=1',
  'Tooth Extraction':       'https://images.pexels.com/photos/6812572/pexels-photo-6812572.jpeg?auto=compress&cs=tinysrgb&w=1280&h=720&dpr=1',
};
const DEFAULT_IMAGE = 'https://images.pexels.com/photos/3881449/pexels-photo-3881449.jpeg?auto=compress&cs=tinysrgb&w=1280&h=720&dpr=1';

async function generateScript(topic, duration, tone, language) {
  const wordCount = duration === '30s' ? '60-75 words' : duration === '60s' ? '130-150 words' : '260-300 words';
  const langNote = language === 'es'
    ? 'Write the entire script in Spanish (Latin American Spanish).'
    : 'Write the script in English.';

  const prompt = `Write a professional educational video script for a dental office about: ${topic}
Duration: ${duration} (approximately ${wordCount})
Tone: ${tone}
${langNote}

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

async function submitToHeyGen(script, avatarId, voiceId, apiKey, topic, style) {
  let body;
  if (style === 'image') {
    const imageUrl = TOPIC_IMAGES[topic] || DEFAULT_IMAGE;
    body = {
      type: 'image',
      image_url: imageUrl,
      script: script,
      voice_id: voiceId,
      aspect_ratio: '16:9',
      output_format: 'mp4',
    };
  } else {
    body = {
      type: 'avatar',
      avatar_id: avatarId,
      script: script,
      voice_id: voiceId,
      background: { type: 'color', value: '#f0f4f8' },
      aspect_ratio: '16:9',
      output_format: 'mp4',
      engine: { type: 'avatar_iii' },
    };
  }
  const payload = JSON.stringify(body);

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

  const { topic, duration, tone, voiceId: providedVoiceId, language = 'en', style = 'avatar' } = JSON.parse(event.body);

  const [script, voiceId, avatarId] = await Promise.all([
    generateScript(topic, duration, tone, language),
    providedVoiceId ? Promise.resolve(providedVoiceId) : getFirstVoiceId(apiKey),
    style === 'image' ? Promise.resolve(null) : getFirstAvatarId(apiKey),
  ]);

  const result = await submitToHeyGen(script, avatarId, voiceId, apiKey, topic, style);

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
