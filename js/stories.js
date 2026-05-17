import { supabase } from './supabase.js';

export async function renderStories(currentUser, currentProfile) {
  const container = document.getElementById('content');
  container.style.alignItems = 'center';
  container.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.style.cssText = 'width:100%;max-width:680px';
  container.appendChild(wrap);

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:16px';
  header.innerHTML = `<h2 style="font-size:24px;font-weight:700">Stories</h2>`;
  wrap.appendChild(header);

  // Create story card
  const createCard = document.createElement('div');
  createCard.className = 'card';
  createCard.style.padding = '16px';
  createCard.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
      ${currentProfile?.avatar_url
        ? `<img src="${currentProfile.avatar_url}" style="width:48px;height:48px;border-radius:50%;object-fit:cover">`
        : `<div class="avatar-placeholder" style="width:48px;height:48px;font-size:18px">${(currentProfile?.full_name||'?')[0].toUpperCase()}</div>`}
      <div>
        <div style="font-weight:600">Create a story</div>
        <div style="font-size:13px;color:var(--text2)">Share a photo or write something</div>
      </div>
    </div>
    <div style="display:flex;gap:8px">
      <label style="flex:1;cursor:pointer">
        <div class="btn-primary" style="justify-content:center;pointer-events:none">🖼️ Photo story</div>
        <input type="file" id="story-image-input" accept="image/*" style="display:none">
      </label>
      <button class="btn-secondary" id="text-story-btn" style="flex:1;justify-content:center">✏️ Text story</button>
    </div>
    <div id="story-preview-wrap" style="display:none;margin-top:12px">
      <img id="story-preview-img" style="width:100%;max-height:300px;object-fit:cover;border-radius:8px">
      <input type="text" id="story-caption" placeholder="Add a caption…" style="width:100%;margin-top:8px;border:1px solid var(--border);border-radius:8px;padding:10px;font-size:15px;font-family:var(--font);outline:none">
      <button class="btn-primary" id="post-story-btn" style="width:100%;justify-content:center;margin-top:8px">Share story</button>
      <div id="story-error" style="color:#c0392b;font-size:13px;margin-top:6px;display:none"></div>
    </div>`;
  wrap.appendChild(createCard);

  // Image story
  const imgInput = createCard.querySelector('#story-image-input');
  const previewWrap = createCard.querySelector('#story-preview-wrap');
  const previewImg = createCard.querySelector('#story-preview-img');
  imgInput.addEventListener('change', () => {
    if (!imgInput.files[0]) return;
    previewImg.src = URL.createObjectURL(imgInput.files[0]);
    previewWrap.style.display = 'block';
  });

  createCard.querySelector('#post-story-btn').addEventListener('click', async () => {
    const file = imgInput.files[0];
    const caption = createCard.querySelector('#story-caption').value.trim();
    const errEl = createCard.querySelector('#story-error');
    const btn = createCard.querySelector('#post-story-btn');
    errEl.style.display = 'none';
    if (!file && !caption) { errEl.textContent = 'Add a photo or text.'; errEl.style.display = 'block'; return; }
    btn.textContent = 'Sharing…';
    btn.disabled = true;
    let image_url = null;
    if (file) {
      const path = `${currentUser.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from('stories').upload(path, file);
      if (upErr) { errEl.textContent = 'Upload failed: ' + upErr.message; errEl.style.display = 'block'; btn.textContent = 'Share story'; btn.disabled = false; return; }
      const { data } = supabase.storage.from('stories').getPublicUrl(path);
      image_url = data.publicUrl;
    }
    const expires_at = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    const { error } = await supabase.from('stories').insert({ user_id: currentUser.id, image_url, content: caption, expires_at });
    if (error) { errEl.textContent = error.message; errEl.style.display = 'block'; btn.textContent = 'Share story'; btn.disabled = false; return; }
    btn.textContent = 'Share story';
    btn.disabled = false;
    previewWrap.style.display = 'none';
    imgInput.value = '';
    createCard.querySelector('#story-caption').value = '';
    renderStories(currentUser, currentProfile);
  });

  // Text story
  createCard.querySelector('#text-story-btn').addEventListener('click', () => openTextStoryModal(currentUser, currentProfile, () => renderStories(currentUser, currentProfile)));

  // Load existing stories
  const now = new Date().toISOString();
  const { data: stories } = await supabase
    .from('stories')
    .select('*, profiles:user_id(id, full_name, avatar_url)')
    .gt('expires_at', now)
    .order('created_at', { ascending: false });

  if (!stories?.length) {
    wrap.innerHTML += '<div class="empty-state" style="margin-top:16px"><div class="icon">📖</div><p>No stories right now. Be the first!</p></div>';
    return;
  }

  // Group by user
  const byUser = new Map();
  stories.forEach(s => {
    const uid = s.user_id;
    if (!byUser.has(uid)) byUser.set(uid, []);
    byUser.get(uid).push(s);
  });

  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-top:16px';
  wrap.appendChild(grid);

  byUser.forEach((userStories, uid) => {
    const first = userStories[0];
    const card = document.createElement('div');
    card.className = 'story-card';
    card.style.height = '240px';
    if (first.image_url) card.innerHTML = `<img src="${first.image_url}" alt="story" style="width:100%;height:100%;object-fit:cover">`;
    else card.style.background = '#1877f2';
    card.innerHTML += `
      <img class="story-card-avatar" src="${first.profiles?.avatar_url || ''}" alt="" onerror="this.style.display='none'">
      <div class="story-card-name">${first.profiles?.full_name || ''}</div>
      ${first.content && !first.image_url ? `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;font-weight:600;padding:16px;text-align:center">${escapeHtml(first.content)}</div>` : ''}`;
    card.addEventListener('click', () => openStoryViewer(userStories, 0));
    grid.appendChild(card);
  });
}

function openTextStoryModal(currentUser, currentProfile, onPost) {
  let modal = document.getElementById('text-story-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'text-story-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header"><h2>Create text story</h2><button class="modal-close">✕</button></div>
        <div class="modal-body">
          <div id="ts-error" style="color:#c0392b;font-size:13px;margin-bottom:8px;display:none"></div>
          <textarea placeholder="What's on your mind?" style="width:100%;height:140px;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:12px;font-size:17px;font-family:var(--font);resize:none;outline:none;color:var(--text)"></textarea>
        </div>
        <div class="modal-footer">
          <button class="btn-primary" id="ts-submit" style="justify-content:center">Share story</button>
        </div>
      </div>`;
    modal.querySelector('.modal-close').addEventListener('click', () => modal.classList.remove('active'));
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('active'); });
    modal.querySelector('#ts-submit').addEventListener('click', async () => {
      const text = modal.querySelector('textarea').value.trim();
      const errEl = modal.querySelector('#ts-error');
      errEl.style.display = 'none';
      if (!text) { errEl.textContent = 'Write something first.'; errEl.style.display = 'block'; return; }
      const btn = modal.querySelector('#ts-submit');
      btn.textContent = 'Sharing…'; btn.disabled = true;
      const expires_at = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const { error } = await supabase.from('stories').insert({ user_id: currentUser.id, content: text, expires_at });
      btn.textContent = 'Share story'; btn.disabled = false;
      if (error) { errEl.textContent = error.message; errEl.style.display = 'block'; return; }
      modal.classList.remove('active');
      modal.querySelector('textarea').value = '';
      onPost();
    });
    document.body.appendChild(modal);
  }
  modal.classList.add('active');
}

export function openStoryViewer(stories, startIdx) {
  let viewer = document.getElementById('stories-viewer');
  if (!viewer) {
    viewer = document.createElement('div');
    viewer.className = 'stories-viewer-overlay';
    viewer.id = 'stories-viewer';
    viewer.innerHTML = `
      <div class="stories-viewer">
        <div class="story-progress-bar" id="sv-progress"></div>
        <div class="story-viewer-header">
          <img id="sv-avatar" src="" alt="" onerror="this.style.display='none'">
          <div><div id="sv-name" class="story-viewer-name"></div><div id="sv-time" class="story-viewer-time"></div></div>
        </div>
        <button class="story-close-btn" id="sv-close">✕</button>
        <img id="sv-image" src="" alt="story" style="width:100%;height:100%;object-fit:cover;display:none">
        <div id="sv-text-content" style="display:none;position:absolute;inset:0;background:#1877f2;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:#fff;padding:24px;text-align:center"></div>
        <div id="sv-caption" class="story-caption"></div>
      </div>`;
    viewer.querySelector('#sv-close').addEventListener('click', () => { clearInterval(viewer._timer); viewer.classList.remove('active'); });
    viewer.addEventListener('click', e => { if (e.target === viewer) { clearInterval(viewer._timer); viewer.classList.remove('active'); } });
    document.body.appendChild(viewer);
  }

  let idx = startIdx;
  let timer = null;

  function showStory(i) {
    clearInterval(timer);
    if (i >= stories.length) { viewer.classList.remove('active'); return; }
    const s = stories[i];
    const timeAgo = t => { const d = (Date.now() - new Date(t)) / 1000; if (d < 3600) return `${Math.floor(d/60)}m ago`; return `${Math.floor(d/3600)}h ago`; };
    viewer.querySelector('#sv-avatar').src = s.profiles?.avatar_url || '';
    viewer.querySelector('#sv-name').textContent = s.profiles?.full_name || '';
    viewer.querySelector('#sv-time').textContent = timeAgo(s.created_at);
    const imgEl = viewer.querySelector('#sv-image');
    const textEl = viewer.querySelector('#sv-text-content');
    if (s.image_url) { imgEl.src = s.image_url; imgEl.style.display = 'block'; textEl.style.display = 'none'; }
    else { imgEl.style.display = 'none'; textEl.textContent = s.content || ''; textEl.style.display = 'flex'; }
    viewer.querySelector('#sv-caption').textContent = s.image_url && s.content ? s.content : '';

    // Progress bar
    const bar = viewer.querySelector('#sv-progress');
    bar.innerHTML = stories.map((_, j) => `<div class="story-progress-segment"><div class="story-progress-fill" style="width:${j < i ? '100' : '0'}%"></div></div>`).join('');
    const fill = bar.querySelectorAll('.story-progress-fill')[i];
    let w = 0;
    timer = setInterval(() => {
      w += 2;
      fill.style.width = w + '%';
      if (w >= 100) { idx++; showStory(idx); }
    }, 100);
    viewer._timer = timer;
  }

  viewer.classList.add('active');
  showStory(idx);
}

function escapeHtml(t) { return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
