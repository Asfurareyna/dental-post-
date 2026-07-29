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
  document.getElementById('loading').classList.remove('hidden');

  try {
    const response = await fetch('/.netlify/functions/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fields),
    });

    const data = await response.json();
    displayResults(data.result);
  } catch (err) {
    alert('Something went wrong. Please try again.');
    resetForm();
  }
}

function displayResults(text) {
  document.getElementById('loading').classList.add('hidden');

  const parts = text.split(/Option \d+:/i).filter(p => p.trim());
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
  document.getElementById('loading').classList.add('hidden');
  document.querySelector('.card').classList.remove('hidden');
  document.getElementById('content-type').value = '';
  document.querySelectorAll('.field-group').forEach(g => g.classList.add('hidden'));
  document.getElementById('generate-btn').classList.add('hidden');
}
