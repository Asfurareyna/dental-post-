const https = require('https');

function httpsPost(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'OPENAI_API_KEY is not set in Netlify environment variables.' }),
    };
  }

  const fields = JSON.parse(event.body);
  const prompt = buildPrompt(fields);

  const payload = JSON.stringify({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 1200,
  });

  const options = {
    hostname: 'api.openai.com',
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'Content-Length': Buffer.byteLength(payload),
    },
  };

  const response = await httpsPost(options, payload);
  const data = JSON.parse(response.body);

  if (!data.choices || !data.choices[0]) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: data.error ? data.error.message : 'Unexpected response from OpenAI.' }),
    };
  }

  const result = data.choices[0].message.content;

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ result }),
  };
};

function buildPrompt(fields) {
  if (fields.type === 'before-after') {
    return `Write 3 Instagram captions for a dental office before and after post.

Procedure: ${fields.procedure}
Tone: ${fields.tone}
Key message: ${fields.focus}

Rules:
- Each caption under 150 words
- End with a call to action to book a consultation
- Include 8-10 relevant hashtags
- Label each one clearly as: Option 1: / Option 2: / Option 3:
- Do not use the patient's name
- Write in third person about the patient's experience`;
  }

  if (fields.type === 'educational') {
    return `Write 3 Instagram educational posts for a dental office.

Topic: ${fields.topic}
Tone: ${fields.tone}
Format: ${fields.format}

Rules:
- Each post under 150 words
- Start with a strong hook (question, surprising fact, or bold statement)
- Use simple language — avoid clinical jargon
- End with a gentle call to action
- Include 8-10 relevant hashtags
- Label each one clearly as: Option 1: / Option 2: / Option 3:`;
  }

  if (fields.type === 'promotional') {
    return `Write 3 Instagram promotional posts for a dental office.

Promotion: ${fields.promoType}
Offer details: ${fields.details}
Tone: ${fields.tone}
Urgency: ${fields.urgency}

Rules:
- Each post under 130 words
- Lead with the benefit, not just the discount
- Match the urgency level — don't oversell a low-urgency offer
- Include a clear call to action (call, book online, DM us)
- Include 8-10 relevant hashtags
- Sound like a real dental office, not a sales ad
- Label each one clearly as: Option 1: / Option 2: / Option 3:`;
  }

  if (fields.type === 'seasonal') {
    return `Write 3 seasonal Instagram posts for a dental office.

Season or holiday: ${fields.season}
Content angle: ${fields.angle}
Tone: ${fields.tone}

Rules:
- Each post under 150 words
- Make the dental connection feel natural, not forced
- Be warm and human — this is community content, not a hard sell
- Include a soft call to action where appropriate
- Include 8-10 relevant hashtags including seasonal ones
- Label each one clearly as: Option 1: / Option 2: / Option 3:`;
  }
}
