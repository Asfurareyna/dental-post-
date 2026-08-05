const SUPABASE_URL = 'https://rwtlbeusaevbeyjwamhm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Lz5Ab9QdSQiaRpFpDf4Bdg_Ig1kkoSe';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;

// ─── AUTH ────────────────────────────────────────────────────────────────────

async function initAuth() {
  const { data: { session } } = await db.auth.getSession();
  if (session) {
    currentUser = session.user;
    showApp();
  } else {
    showAuthScreen();
  }

  db.auth.onAuthStateChange((_event, session) => {
    if (session) {
      currentUser = session.user;
      showApp();
    } else {
      currentUser = null;
      showAuthScreen();
    }
  });
}

function showAuthScreen() {
  document.getElementById('landing').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('auth-modal').classList.add('hidden');
}

function showApp() {
  document.getElementById('landing').classList.add('hidden');
  document.getElementById('auth-modal').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  showTab('generator');
  checkForPendingVideo();
}

function openAuthModal(mode) {
  document.getElementById('auth-modal').classList.remove('hidden');
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('auth-login').classList.add('hidden');
  document.getElementById('auth-signup').classList.add('hidden');
  document.getElementById('auth-' + mode).classList.remove('hidden');
  const tabs = document.querySelectorAll('.auth-tab');
  tabs[mode === 'login' ? 0 : 1].classList.add('active');
}

function closeAuthModal() {
  document.getElementById('auth-modal').classList.add('hidden');
}

function handleOverlayClick(event) {
  if (event.target === document.getElementById('auth-modal')) closeAuthModal();
}

function switchAuth(mode, btn) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('auth-login').classList.add('hidden');
  document.getElementById('auth-signup').classList.add('hidden');
  document.getElementById('auth-' + mode).classList.remove('hidden');
  if (btn) btn.classList.add('active');
}

async function logIn() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const err = document.getElementById('login-error');
  err.classList.add('hidden');

  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) {
    err.textContent = error.message;
    err.classList.remove('hidden');
  }
}

async function signUp() {
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const err = document.getElementById('signup-error');
  const success = document.getElementById('signup-success');
  err.classList.add('hidden');
  success.classList.add('hidden');

  const { error } = await db.auth.signUp({ email, password });
  if (error) {
    err.textContent = error.message;
    err.classList.remove('hidden');
  } else {
    success.classList.remove('hidden');
  }
}

async function signOut() {
  await db.auth.signOut();
}

// ─── NAVIGATION ───────────────────────────────────────────────────────────────

function showTab(tab) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-generator').classList.add('hidden');
  document.getElementById('tab-saved').classList.add('hidden');

  document.getElementById(`tab-${tab}`).classList.remove('hidden');
  document.querySelectorAll('.nav-btn').forEach(b => {
    if (b.textContent.toLowerCase().includes(tab === 'generator' ? 'generator' : 'saved')) {
      b.classList.add('active');
    }
  });

  if (tab === 'saved') loadSavedContent();
}

// ─── GENERATOR ────────────────────────────────────────────────────────────────

function showFields() {
  const type = document.getElementById('content-type').value;
  const allGroups = document.querySelectorAll('.field-group');
  const btn = document.getElementById('generate-btn');

  allGroups.forEach(g => g.classList.add('hidden'));

  if (type) {
    document.getElementById('fields-' + type).classList.remove('hidden');
    btn.classList.remove('hidden');
    btn.textContent = type === 'video' ? 'Generate Video' : 'Generate Captions';
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
    const topic = fields.procedure || fields.topic || fields.promoType || fields.season || 'Post';
    displayResults(data.result, fields.type, topic);
  } catch (err) {
    alert('Something went wrong. Please try again.');
    resetForm();
  }
}

function displayResults(text, type, topic) {
  document.getElementById('loading').classList.add('hidden');

  const cleaned = text.replace(/\*\*/g, '').replace(/^\s*-{3,}\s*$/gm, '');
  const parts = cleaned.split(/Option \d+:/i).filter(p => p.trim());
  const container = document.getElementById('captions-container');
  container.innerHTML = '';

  parts.forEach((caption, i) => {
    const trimmed = caption.trim();
    const card = document.createElement('div');
    card.className = 'caption-card';
    card.innerHTML = `
      <div class="caption-label">Option ${i + 1}</div>
      <div class="caption-text">${trimmed}</div>
      <div class="caption-actions">
        <span class="copy-hint">Click to copy</span>
        <button class="save-btn" onclick="saveCaption(this, ${JSON.stringify(trimmed)}, ${JSON.stringify(type)}, ${JSON.stringify(topic)})">Save</button>
      </div>
      <div class="share-actions">
        <span class="share-label">Copy &amp; open:</span>
        <button class="share-btn share-ig" onclick="openPlatform(this, ${JSON.stringify(trimmed)}, 'instagram')">Instagram</button>
        <button class="share-btn share-fb" onclick="openPlatform(this, ${JSON.stringify(trimmed)}, 'facebook')">Facebook</button>
      </div>
    `;
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('save-btn')) return;
      if (e.target.classList.contains('share-btn')) return;
      copyCaption(card, trimmed);
    });
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

function openPlatform(btn, text, platform) {
  const urls = {
    instagram: 'https://www.instagram.com/create/style/',
    facebook:  'https://www.facebook.com/',
  };
  navigator.clipboard.writeText(text).then(() => {
    const original = btn.textContent;
    btn.textContent = 'Copied! Opening...';
    btn.disabled = true;
    setTimeout(() => {
      window.open(urls[platform], '_blank');
      btn.textContent = original;
      btn.disabled = false;
    }, 600);
  });
}

async function saveCaption(btn, caption, type, topic) {
  btn.textContent = 'Saving...';
  btn.disabled = true;

  const { error } = await db.from('saved_content').insert({
    user_id: currentUser.id,
    type,
    caption,
    topic,
  });

  if (error) {
    btn.textContent = 'Error';
    setTimeout(() => { btn.textContent = 'Save'; btn.disabled = false; }, 2000);
  } else {
    btn.textContent = 'Saved!';
    btn.classList.add('saved');
  }
}

function resetForm() {
  localStorage.removeItem('pending_video');
  document.getElementById('results').classList.add('hidden');
  document.getElementById('video-results').classList.add('hidden');
  document.getElementById('loading').classList.add('hidden');
  document.querySelector('.card').classList.remove('hidden');
  document.getElementById('content-type').value = '';
  document.querySelectorAll('.field-group').forEach(g => g.classList.add('hidden'));
  document.getElementById('generate-btn').classList.add('hidden');
}

// ─── VIDEO ────────────────────────────────────────────────────────────────────

function checkForPendingVideo() {
  const pending = localStorage.getItem('pending_video');
  if (!pending) return;
  try {
    const { video_id, script } = JSON.parse(pending);
    if (!video_id) return;
    document.querySelector('.card').classList.add('hidden');
    document.getElementById('results').classList.add('hidden');
    document.getElementById('video-results').classList.remove('hidden');
    document.getElementById('video-status-box').classList.remove('hidden');
    document.getElementById('video-player-box').classList.add('hidden');
    if (script) {
      document.getElementById('video-script-text').textContent = script;
      document.getElementById('video-script-box').classList.remove('hidden');
    }
    document.getElementById('video-status-text').textContent = 'Resuming... checking video status.';
    pollVideoStatus(video_id);
  } catch (e) {
    localStorage.removeItem('pending_video');
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

    const scriptText = data.script || '(Script not available)';
    document.getElementById('video-script-text').textContent = scriptText;
    document.getElementById('video-script-box').classList.remove('hidden');
    document.getElementById('video-status-text').textContent = 'Video is processing... checking every 15 seconds.';

    localStorage.setItem('pending_video', JSON.stringify({ video_id: data.video_id, script: scriptText }));
    pollVideoStatus(data.video_id);
  } catch (err) {
    alert('Something went wrong generating your video. Please try again.');
    resetForm();
  }
}

async function pollVideoStatus(videoId) {
  const maxAttempts = 60;
  let attempts = 0;

  const interval = setInterval(async () => {
    attempts++;
    try {
      const res = await fetch(`/.netlify/functions/check-video?video_id=${videoId}`);
      const data = await res.json();
      const status = data.data && data.data.status;

      if (status === 'completed') {
        clearInterval(interval);
        localStorage.removeItem('pending_video');
        const videoUrl = data.data.video_url;
        document.getElementById('video-status-box').classList.add('hidden');
        document.getElementById('video-player').src = videoUrl;
        document.getElementById('video-download').href = videoUrl;
        document.getElementById('video-player-box').classList.remove('hidden');
      } else if (status === 'failed') {
        clearInterval(interval);
        localStorage.removeItem('pending_video');
        alert('Video generation failed. Please try again.');
        resetForm();
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
        localStorage.removeItem('pending_video');
        document.getElementById('video-status-text').textContent = 'Taking longer than expected. Check your HeyGen dashboard.';
      } else {
        const mins = Math.floor((attempts * 15) / 60);
        const secs = (attempts * 15) % 60;
        document.getElementById('video-status-text').textContent = `Still processing... (${mins}m ${secs}s elapsed)`;
      }
    } catch (err) {
      clearInterval(interval);
      localStorage.removeItem('pending_video');
      alert('Could not check video status. Please try again.');
    }
  }, 15000);
}

// ─── SAVED CONTENT ────────────────────────────────────────────────────────────

async function loadSavedContent() {
  const container = document.getElementById('saved-container');
  const subtitle = document.getElementById('saved-subtitle');
  container.innerHTML = '<p style="color:#718096">Loading...</p>';

  const { data, error } = await db
    .from('saved_content')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    container.innerHTML = '<p style="color:#e53e3e">Could not load saved content.</p>';
    return;
  }

  if (!data || data.length === 0) {
    subtitle.textContent = 'No saved content yet. Generate captions and click Save to keep them here.';
    container.innerHTML = '';
    return;
  }

  subtitle.textContent = `${data.length} saved item${data.length !== 1 ? 's' : ''}`;
  container.innerHTML = '';

  data.forEach(item => {
    const date = new Date(item.created_at).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
    const card = document.createElement('div');
    card.className = 'saved-card';
    card.innerHTML = `
      <div class="saved-meta">
        <span class="saved-type">${formatType(item.type)}</span>
        <span class="saved-topic">${item.topic || ''}</span>
        <span class="saved-date">${date}</span>
      </div>
      <div class="saved-text">${item.caption}</div>
      <div class="saved-actions">
        <button class="copy-saved-btn" onclick="copySaved(this, ${JSON.stringify(item.caption)})">Copy</button>
        <button class="delete-btn" onclick="deleteContent('${item.id}', this)">Delete</button>
      </div>
    `;
    container.appendChild(card);
  });
}

function formatType(type) {
  const map = {
    'before-after': 'Before & After',
    'educational': 'Educational',
    'promotional': 'Promotional',
    'seasonal': 'Seasonal',
    'video': 'Video Script',
  };
  return map[type] || type;
}

function copySaved(btn, text) {
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
  });
}

async function deleteContent(id, btn) {
  btn.textContent = 'Deleting...';
  const { error } = await db.from('saved_content').delete().eq('id', id);
  if (!error) {
    btn.closest('.saved-card').remove();
    const remaining = document.querySelectorAll('.saved-card').length;
    document.getElementById('saved-subtitle').textContent =
      remaining === 0 ? 'No saved content yet.' : `${remaining} saved item${remaining !== 1 ? 's' : ''}`;
  }
}

// ─── INIT ─────────────────────────────────────────────────────────────────────

initAuth();
