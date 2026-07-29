function showFields() {
  const type = document.getElementById('content-type').value;
  const allGroups = document.querySelectorAll('.field-group');
  const btn = document.getElementById('generate-btn');

  allGroups.forEach(g => g.classList.add('hidden'));

  if (type) {
    document.getElementById('fields-' + type).classList.remove('hidden');
    btn.classList.remove('hidden');
  } else {
    btn.classList.add('hidden');
  }
}

function getFields() {
  const type = document.getElementById('content-type').value;

  if (type === 'video') {
    return {
      type,
      topic: document.getElementById('video-topic').value,
      duration: document.getElementById('video-duration').value,
      tone: document.getElementById('video-tone').value,
    };
  }

  if (type === 'before-after') {
    return {
      type,
      procedure: document.getElementById('procedure').value,
      tone: document.getElementById('ba-tone').value,
      focus: document.getElementById('ba-focus').value,
    };
  }
  if (type === 'educational') {
    return {
      type,
      topic: document.getElementById('edu-topic').value,
      tone: document.getElementById('edu-tone').value,
      format: document.getElementById('edu-format').value,
    };
  }
  if (type === 'promotional') {
    return {
      type,
      promoType: document.getElementById('promo-type').value,
      details: document.getElementById('promo-details').value,
      tone: document.getElementById('promo-tone').value,
      urgency: document.getElementById('promo-urgency').value,
    };
  }
  if (type === 'seasonal') {
    return {
      type,
      season: document.getElementById('season').value,
      angle: document.getElementById('season-angle').value,
      tone: document.getElementById('season-tone').value,
    };
  }
}

async function generateContent() {
  const fields = getFields();

  document.querySelector('.card').classList.add('hidden');
  document.getElementById('results').classList.add('hidden');
  document.getElementById('video-results').classList.add('hidden');

  if (fields.type === 'video') {
    await generateVideo(fields);
    return;
  }

  document.getElementById('loading').classList.remove('hidden');

  try {
    const response = await fetch('/.netlify/functions/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });

    const data = await response.json();
    if (data.error) {
      alert('Error: ' + data.error);
      resetForm();
      return;
    }
    displayResults(data.result);
  } catch (err) {
    alert('Something went wrong. Please try again.');
    resetForm();
  }
}

async function generateVideo(fields) {
  document.getElementById('video-results').classList.remove('hidden');
  document.getElementById('video-status-box').classList.remove('hidden');
  document.getElementById('video-script-box').classList.add('hidden');
  document.getElementById('video-player-box').classList.add('hidden');
  document.getElementById('video-status-text').textContent = 'Writing your script and submitting to HeyGen...';

  try {
    const response = await fetch('/.netlify/functions/generate-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });

    const data = await response.json();
    if (data.error) {
      alert('Error: ' + data.error);
      resetForm();
      return;
    }

    document.getElementById('video-script-text').textContent = data.script;
    document.getElementById('video-script-box').classList.remove('hidden');
    document.getElementById('video-status-text').textContent = 'Video is processing... checking every 15 seconds.';

    pollVideoStatus(data.video_id);
  } catch (err) {
    alert('Something went wrong generating your video. Please try again.');
    resetForm();
  }
}

async function pollVideoStatus(videoId) {
  const maxAttempts = 24;
  let attempts = 0;

  const interval = setInterval(async () => {
    attempts++;
    try {
      const res = await fetch(`/.netlify/functions/check-video?video_id=${videoId}`);
      const data = await res.json();
      const status = data.data && data.data.status;

      if (status === 'completed') {
        clearInterval(interval);
        const videoUrl = data.data.video_url;
        document.getElementById('video-status-box').classList.add('hidden');
        document.getElementById('video-player').src = videoUrl;
        document.getElementById('video-download').href = videoUrl;
        document.getElementById('video-player-box').classList.remove('hidden');
      } else if (status === 'failed') {
        clearInterval(interval);
        alert('Video generation failed. Please try again.');
        resetForm();
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
        document.getElementById('video-status-text').textContent = 'Taking longer than expected. Check back in your HeyGen dashboard.';
      } else {
        const mins = Math.floor((attempts * 15) / 60);
        const secs = (attempts * 15) % 60;
        document.getElementById('video-status-text').textContent = `Still processing... (${mins}m ${secs}s elapsed)`;
      }
    } catch (err) {
      clearInterval(interval);
      alert('Could not check video status. Please try again.');
    }
  }, 15000);
}

function displayResults(text) {
  document.getElementById('loading').classList.add('hidden');

  const cleaned = text.replace(/\*\*/g, '').replace(/^---$/gm, '').replace(/^\s*-{3,}\s*$/gm, '');
  const parts = cleaned.split(/Option \d+:/i).filter(p => p.trim());
  const container = document.getElementById('captions-container');
  container.innerHTML = '';

  parts.forEach((caption, i) => {
    const card = document.createElement('div');
    card.className = 'caption-card';
    card.innerHTML = `
      <div class="caption-label">Option ${i + 1}</div>
      <div class="caption-text">${caption.trim()}</div>
      <span class="copy-hint">Click to copy</span>
    `;
    card.addEventListener('click', () => copyCaption(card, caption.trim()));
    container.appendChild(card);
  });

  document.getElementById('results').classList.remove('hidden');
}

function copyCaption(card, text) {
  navigator.clipboard.writeText(text).then(() => {
    card.classList.add('copied');
    card.querySelector('.copy-hint').textContent = 'Copied!';
    setTimeout(() => {
      card.classList.remove('copied');
      card.querySelector('.copy-hint').textContent = 'Click to copy';
    }, 2000);
  });
}

function resetForm() {
  document.getElementById('results').classList.add('hidden');
  document.getElementById('video-results').classList.add('hidden');
  document.getElementById('loading').classList.add('hidden');
  document.querySelector('.card').classList.remove('hidden');
  document.getElementById('content-type').value = '';
  document.querySelectorAll('.field-group').forEach(g => g.classList.add('hidden'));
  document.getElementById('generate-btn').classList.add('hidden');
}
