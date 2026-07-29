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

async function generateScript(topic, duration, tone) {
  const wordCount = duration === '30s' ? '60-75 words' : duration === '60s' ? '130-150 words' : '260-300 words';

  const prompt = `Write a professional educational video script for a dental office about: ${topic}
Duration: ${duration} (approximately ${wordCount})
Tone: ${tone}

Write ONLY the spoken narration text — no stage directions, no formatting, no bullet points, no markdown.
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

async function submitToHeyGen(script, avatarId, voiceId) {
  const payload = JSON.stringify({
    video_inputs: [{
      character: {
        type: 'avatar',
        avatar_id: avatarId,
        avatar_style: 'normal',
      },
      voice: {
        type: 'text',
        input_text: script,
        voice_id: voiceId,
        speed: 1.0,
      },
      background: {
        type: 'color',
        value: '#f0f4f8',
      },
    }],
    dimension: { width: 1280, height: 720 },
  });

  const options = {
    hostname: 'api.heygen.com',
    path: '/v2/video/generate',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': process.env.HEYGEN_API_KEY,
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

  if (!process.env.OPENAI_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'OPENAI_API_KEY is not configured.' }) };
  }
  if (!process.env.HEYGEN_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'HEYGEN_API_KEY is not configured in Netlify.' }) };
  }

  const { topic, duration, tone, avatarId, voiceId } = JSON.parse(event.body);

  const script = await generateScript(topic, duration, tone);
  const result = await submitToHeyGen(
    script,
    avatarId || 'Daisy-inshirt-20220818',
    voiceId || '1bd001e7cf50421099d4be996823da86'
  );

  if (!result.data || !result.data.video_id) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'HeyGen error: ' + JSON.stringify(result) }),
    };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ video_id: result.data.video_id, script }),
  };
};
