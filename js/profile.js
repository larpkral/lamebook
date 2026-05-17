import { supabase } from './supabase.js';
import { updateProfile, uploadAvatar, uploadCover } from './auth.js';
import { buildPostCard } from './feed.js';

function av(url, name, size = 40) {
  const s = `width:${size}px;height:${size}px;font-size:${Math.round(size * .38)}px`;
  if (url) return `<img src="${url}" alt="${esc(name||'')}" style="${s};border-radius:50%;object-fit:cover">`;
  const ini = (name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  return `<div class="av-ph" style="${s}">${ini}</div>`;
}
function esc(t) { return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

export async function renderProfile(profileId, currentUser, currentProfile) {
  const container = document.getElementById('content');
  container.style.alignItems = 'center';
  container.innerHTML = '<div class="spinner"></div>';

  const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', profileId).single();
  if (error || !profile) { container.innerHTML = '<div class="empty-state"><div class="es-icon">👤</div><h3>Profile not found</h3></div>'; return; }

  const isOwn = profileId === currentUser.id;

  // Friendship status
  let friendStatus = null;
  if (!isOwn) {
    const { data: fs } = await supabase.from('friendships')
      .select('*')
      .or(`and(requester_id.eq.${currentUser.id},addressee_id.eq.${profileId}),and(requester_id.eq.${profileId},addressee_id.eq.${currentUser.id})`)
      .single();
    friendStatus = fs;
  }

  const { count: friendCount } = await supabase.from('friendships')
    .select('*', { count: 'exact', head: true })
    .or(`requester_id.eq.${profileId},addressee_id.eq.${profileId}`)
    .eq('status', 'accepted');

  container.innerHTML = '';

  // ── Cover ──────────────────────────────────────────────
  const coverWrap = document.createElement('div');
  coverWrap.className = 'profile-cover-wrap';
  if (profile.cover_url) {
    coverWrap.innerHTML = `<img class="profile-cover-img" src="${profile.cover_url}" alt="cover">`;
  } else {
    coverWrap.innerHTML = `<div class="profile-cover-ph"></div>`;
  }
  if (isOwn) {
    const editCoverBtn = document.createElement('button');
    editCoverBtn.className = 'cover-edit-btn';
    editCoverBtn.innerHTML = '📷 Edit cover photo';
    editCoverBtn.addEventListener('click', () => document.getElementById('cover-input').click());
    coverWrap.appendChild(editCoverBtn);

    const coverInput = document.createElement('input');
    coverInput.type = 'file'; coverInput.id = 'cover-input';
    coverInput.accept = 'image/*'; coverInput.style.display = 'none';
    coverInput.addEventListener('change', async () => {
      if (!coverInput.files[0]) return;
      editCoverBtn.textContent = 'Uploading…';
      try {
        const url = await uploadCover(currentUser.id, coverInput.files[0]);
        await updateProfile(currentUser.id, { cover_url: url });
        renderProfile(profileId, currentUser, currentProfile);
      } catch (e) { alert('Upload failed: ' + e.message); }
      editCoverBtn.innerHTML = '📷 Edit cover photo';
    });
    coverWrap.appendChild(coverInput);
  }
  container.appendChild(coverWrap);

  // ── Info bar ───────────────────────────────────────────
  const infoBar = document.createElement('div');
  infoBar.className = 'profile-info-bar';

  const avatarHtml = profile.avatar_url
    ? `<img class="profile-av" src="${profile.avatar_url}" alt="${esc(profile.full_name)}">`
    : `<div class="profile-av" style="display:flex;align-items:center;justify-content:center;font-size:64px;font-weight:700;color:var(--text2);background:var(--card-solid)">${(profile.full_name||'?')[0].toUpperCase()}</div>`;

  infoBar.innerHTML = `
    <div class="profile-av-row">
      <div class="profile-av-wrap">
        ${avatarHtml}
        ${isOwn ? `<button class="profile-av-edit" id="edit-avatar-btn">📷</button><input type="file" id="avatar-input" accept="image/*" style="display:none">` : ''}
      </div>
      <div class="profile-name-col">
        <div class="profile-name">${esc(profile.full_name || '')}</div>
        <div class="profile-friend-count">${friendCount || 0} friends</div>
      </div>
      <div class="profile-btns">
        ${buildFriendButton(isOwn, friendStatus, currentUser, profileId)}
      </div>
    </div>
    <div class="profile-tabs">
      <button class="ptab active" data-tab="posts">Posts</button>
      <button class="ptab" data-tab="friends">Friends</button>
      <button class="ptab" data-tab="photos">Photos</button>
    </div>`;
  container.appendChild(infoBar);

  // Avatar upload
  if (isOwn) {
    infoBar.querySelector('#edit-avatar-btn')?.addEventListener('click', () => infoBar.querySelector('#avatar-input').click());
    infoBar.querySelector('#avatar-input')?.addEventListener('change', async function () {
      if (!this.files[0]) return;
      infoBar.querySelector('#edit-avatar-btn').textContent = '⏳';
      try {
        const url = await uploadAvatar(currentUser.id, this.files[0]);
        await updateProfile(currentUser.id, { avatar_url: url });
        renderProfile(profileId, currentUser, currentProfile);
      } catch (e) { alert('Upload failed: ' + e.message); }
    });
  }

  // Friend button actions
  const friendBtn = infoBar.querySelector('#friend-action-btn');
  if (friendBtn) {
    friendBtn.addEventListener('click', async () => {
      const action = friendBtn.dataset.action;
      if (action === 'add') {
        await supabase.from('friendships').insert({ requester_id: currentUser.id, addressee_id: profileId, status: 'pending' });
        await supabase.from('notifications').insert({ user_id: profileId, actor_id: currentUser.id, type: 'friend_request', reference_id: currentUser.id });
      } else if (action === 'unfriend') {
        await supabase.from('friendships').delete()
          .or(`and(requester_id.eq.${currentUser.id},addressee_id.eq.${profileId}),and(requester_id.eq.${profileId},addressee_id.eq.${currentUser.id})`);
      } else if (action === 'accept') {
        await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendStatus.id);
        await supabase.from('notifications').insert({ user_id: profileId, actor_id: currentUser.id, type: 'friend_accept', reference_id: currentUser.id });
      } else if (action === 'cancel') {
        await supabase.from('friendships').delete().eq('id', friendStatus.id);
      }
      renderProfile(profileId, currentUser, currentProfile);
    });
    infoBar.querySelector('#message-btn')?.addEventListener('click', () => { window.location.hash = '#messages/' + profileId; });
  }

  // Edit profile button (own profile)
  if (isOwn) {
    infoBar.querySelector('#edit-profile-btn')?.addEventListener('click', () => {
      openEditProfileModal(profile, currentUser, () => renderProfile(profileId, currentUser, currentProfile));
    });
  }

  // ── Content columns ────────────────────────────────────
  const cols = document.createElement('div');
  cols.className = 'profile-cols';

  const leftCol = document.createElement('div');
  leftCol.className = 'profile-col-l';
  leftCol.innerHTML = `
    <div class="card intro-card">
      <h3>Intro</h3>
      ${profile.bio ? `<p class="intro-bio">${esc(profile.bio)}</p>` : '<p class="intro-bio">No bio yet.</p>'}
      ${isOwn ? `<button class="intro-edit" id="edit-bio-btn">Edit bio</button>` : ''}
    </div>`;
  cols.appendChild(leftCol);

  if (isOwn) {
    leftCol.querySelector('#edit-bio-btn')?.addEventListener('click', () => {
      openEditProfileModal(profile, currentUser, () => renderProfile(profileId, currentUser, currentProfile));
    });
  }

  const rightCol = document.createElement('div');
  rightCol.className = 'profile-col-r';
  cols.appendChild(rightCol);
  container.appendChild(cols);

  // Tab switching
  const tabs = infoBar.querySelectorAll('.ptab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      loadTabContent(tab.dataset.tab, rightCol, profile, currentUser, currentProfile);
    });
  });

  loadTabContent('posts', rightCol, profile, currentUser, currentProfile);
}

// ── Friend button builder ────────────────────────────────────────────

function buildFriendButton(isOwn, friendStatus, currentUser, profileId) {
  if (isOwn) return `<button class="btn-secondary" id="edit-profile-btn">✏️ Edit profile</button>`;
  if (!friendStatus) return `<button class="btn-primary" id="friend-action-btn" data-action="add">➕ Add friend</button><button class="btn-secondary" id="message-btn">💬 Message</button>`;
  if (friendStatus.status === 'accepted') return `<button class="btn-secondary" id="friend-action-btn" data-action="unfriend">✓ Friends</button><button class="btn-primary" id="message-btn">💬 Message</button>`;
  if (friendStatus.status === 'pending' && friendStatus.requester_id === currentUser.id) return `<button class="btn-secondary" id="friend-action-btn" data-action="cancel">⏳ Pending</button>`;
  if (friendStatus.status === 'pending' && friendStatus.addressee_id === currentUser.id) return `<button class="btn-primary" id="friend-action-btn" data-action="accept">✓ Accept</button><button class="btn-secondary" id="friend-action-btn" data-action="cancel">✕ Decline</button>`;
  return '';
}

// ── Tab content loader ───────────────────────────────────────────────

async function loadTabContent(tab, container, profile, currentUser, currentProfile) {
  container.innerHTML = '<div class="spinner"></div>';

  if (tab === 'posts') {
    const { data: posts } = await supabase.from('posts')
      .select('*, profiles:user_id(id, full_name, avatar_url)')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false }).limit(20);
    container.innerHTML = '';
    if (!posts?.length) { container.innerHTML = '<div class="empty-state"><p>No posts yet.</p></div>'; return; }
    for (const post of posts) container.appendChild(await buildPostCard(post, currentUser, currentProfile));

  } else if (tab === 'friends') {
    const { data: friendships } = await supabase.from('friendships')
      .select('requester_id, addressee_id')
      .or(`requester_id.eq.${profile.id},addressee_id.eq.${profile.id}`)
      .eq('status', 'accepted');
    const friendIds = (friendships || []).map(f => f.requester_id === profile.id ? f.addressee_id : f.requester_id);
    container.innerHTML = '';
    if (!friendIds.length) { container.innerHTML = '<div class="empty-state"><p>No friends yet.</p></div>'; return; }
    const { data: friends } = await supabase.from('profiles').select('*').in('id', friendIds);
    const grid = document.createElement('div');
    grid.className = 'friends-grid';
    (friends || []).forEach(f => {
      const tile = document.createElement('div');
      tile.className = 'friend-tile';
      tile.innerHTML = f.avatar_url
        ? `<img src="${f.avatar_url}" alt="${esc(f.full_name)}">`
        : `<div class="ft-ph">${(f.full_name||'?')[0].toUpperCase()}</div>`;
      tile.innerHTML += `<div class="ft-body"><div class="ft-name">${esc(f.full_name)}</div></div>`;
      tile.addEventListener('click', () => { window.location.hash = '#profile/' + f.id; });
      grid.appendChild(tile);
    });
    container.appendChild(grid);

  } else if (tab === 'photos') {
    const { data: posts } = await supabase.from('posts')
      .select('image_url')
      .eq('user_id', profile.id)
      .not('image_url', 'is', null)
      .order('created_at', { ascending: false }).limit(30);
    container.innerHTML = '';
    if (!posts?.length) { container.innerHTML = '<div class="empty-state"><p>No photos yet.</p></div>'; return; }
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:4px;width:100%';
    posts.forEach(p => {
      const img = document.createElement('img');
      img.src = p.image_url;
      img.style.cssText = 'width:100%;aspect-ratio:1;object-fit:cover;cursor:pointer;border-radius:6px';
      img.addEventListener('click', () => {
        let v = document.getElementById('img-overlay');
        if (!v) {
          v = document.createElement('div');
          v.id = 'img-overlay'; v.className = 'img-overlay';
          v.innerHTML = `<button class="img-overlay-close">✕</button><img src="" alt="">`;
          v.addEventListener('click', e => { if (e.target===v) v.classList.remove('active'); });
          v.querySelector('.img-overlay-close').addEventListener('click', ()=>v.classList.remove('active'));
          document.body.appendChild(v);
        }
        v.querySelector('img').src = p.image_url;
        v.classList.add('active');
      });
      grid.appendChild(img);
    });
    container.appendChild(grid);
  }
}

// ── Edit profile modal ───────────────────────────────────────────────

function openEditProfileModal(profile, currentUser, onSave) {
  let modal = document.getElementById('edit-profile-modal');
  if (modal) modal.remove();

  modal = document.createElement('div');
  modal.id = 'edit-profile-modal';
  modal.className = 'modal-bg active';
  modal.innerHTML = `
    <div class="modal-box" style="max-width:460px">
      <div class="modal-head">
        <h2>Edit Profile</h2>
        <button class="modal-x">✕</button>
      </div>
      <div class="modal-body">
        <div id="ep-err" class="err-msg" style="display:none"></div>
        <label style="font-weight:600;display:block;margin-bottom:6px;font-size:13px;color:var(--text2)">Full name</label>
        <input id="ep-name" type="text" value="${esc(profile.full_name||'')}" style="width:100%;background:var(--input-bg);border:1px solid var(--input-border);border-radius:10px;padding:11px 14px;font-size:15px;color:var(--text);font-family:var(--font);outline:none;margin-bottom:14px;transition:border-color .2s">
        <label style="font-weight:600;display:block;margin-bottom:6px;font-size:13px;color:var(--text2)">Bio</label>
        <textarea id="ep-bio" style="width:100%;background:var(--input-bg);border:1px solid var(--input-border);border-radius:10px;padding:11px 14px;font-size:15px;color:var(--text);font-family:var(--font);outline:none;resize:none;height:90px;transition:border-color .2s">${esc(profile.bio||'')}</textarea>
      </div>
      <div class="modal-foot">
        <button class="btn-secondary" id="ep-cancel">Cancel</button>
        <button class="btn-primary" id="ep-save">Save</button>
      </div>
    </div>`;

  modal.querySelector('.modal-x').addEventListener('click', () => modal.remove());
  modal.querySelector('#ep-cancel').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

  modal.querySelector('#ep-save').addEventListener('click', async () => {
    const name = modal.querySelector('#ep-name').value.trim();
    const bio = modal.querySelector('#ep-bio').value.trim();
    const errEl = modal.querySelector('#ep-err');
    if (!name) { errEl.textContent = 'Name is required.'; errEl.style.display = 'block'; return; }
    try {
      await updateProfile(currentUser.id, { full_name: name, bio });
      modal.remove();
      onSave();
    } catch (e) { errEl.textContent = e.message; errEl.style.display = 'block'; }
  });

  document.body.appendChild(modal);
}
