import { supabase } from './supabase.js';
import { updateProfile, uploadAvatar, uploadCover } from './auth.js';
import { buildPostCard } from './feed.js';
import { getCurrentProfile } from './router.js';

function avatarEl(url, name, size = 40) {
  if (url) return `<img src="${url}" alt="${name}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover">`;
  const initials = (name || '?').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  return `<div class="avatar-placeholder" style="width:${size}px;height:${size}px;font-size:${size * 0.38}px">${initials}</div>`;
}

export async function renderProfile(profileId, currentUser, currentProfile) {
  const container = document.getElementById('content');
  container.style.alignItems = 'center';
  container.innerHTML = '<div class="spinner"></div>';

  const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', profileId).single();
  if (error || !profile) { container.innerHTML = '<div class="empty-state"><div class="icon">👤</div><p>Profile not found.</p></div>'; return; }

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

  // Cover
  const coverWrap = document.createElement('div');
  coverWrap.className = 'profile-cover-wrap';
  if (profile.cover_url) {
    coverWrap.innerHTML = `<img class="profile-cover" src="${profile.cover_url}" alt="cover">`;
  } else {
    coverWrap.innerHTML = `<div class="profile-cover-placeholder"></div>`;
  }
  if (isOwn) {
    const editCoverBtn = document.createElement('button');
    editCoverBtn.className = 'profile-cover-edit-btn';
    editCoverBtn.innerHTML = '📷 Edit cover photo';
    editCoverBtn.addEventListener('click', () => document.getElementById('cover-input').click());
    coverWrap.appendChild(editCoverBtn);

    const coverInput = document.createElement('input');
    coverInput.type = 'file';
    coverInput.id = 'cover-input';
    coverInput.accept = 'image/*';
    coverInput.style.display = 'none';
    coverInput.addEventListener('change', async () => {
      if (!coverInput.files[0]) return;
      editCoverBtn.textContent = 'Uploading...';
      try {
        const url = await uploadCover(currentUser.id, coverInput.files[0]);
        await updateProfile(currentUser.id, { cover_url: url });
        window.location.hash = '#profile/' + currentUser.id;
      } catch (e) { alert('Upload failed: ' + e.message); }
      editCoverBtn.innerHTML = '📷 Edit cover photo';
    });
    coverWrap.appendChild(coverInput);
  }
  container.appendChild(coverWrap);

  // Info card
  const infoCard = document.createElement('div');
  infoCard.className = 'profile-info-card';
  infoCard.innerHTML = `
    <div class="profile-avatar-row">
      <div class="profile-avatar-wrap">
        ${profile.avatar_url
          ? `<img class="profile-avatar" src="${profile.avatar_url}" alt="${profile.full_name}">`
          : `<div class="profile-avatar" style="background:var(--border);display:flex;align-items:center;justify-content:center;font-size:64px;font-weight:700;color:var(--text2)">${(profile.full_name||'?')[0].toUpperCase()}</div>`
        }
        ${isOwn ? `<button class="profile-avatar-edit-btn" id="edit-avatar-btn">📷</button><input type="file" id="avatar-input" accept="image/*" style="display:none">` : ''}
      </div>
      <div class="profile-name-block">
        <div class="profile-name">${profile.full_name || ''}</div>
        <div class="profile-friends-count">${friendCount || 0} friends</div>
      </div>
      <div class="profile-actions">
        ${buildFriendButton(isOwn, friendStatus, currentUser, profileId, profile)}
      </div>
    </div>
    <div class="profile-nav">
      <button class="profile-nav-tab active" data-tab="posts">Posts</button>
      <button class="profile-nav-tab" data-tab="friends">Friends</button>
      <button class="profile-nav-tab" data-tab="photos">Photos</button>
    </div>`;
  container.appendChild(infoCard);

  // Avatar upload
  if (isOwn) {
    infoCard.querySelector('#edit-avatar-btn')?.addEventListener('click', () => infoCard.querySelector('#avatar-input').click());
    infoCard.querySelector('#avatar-input')?.addEventListener('change', async function () {
      if (!this.files[0]) return;
      const btn = infoCard.querySelector('#edit-avatar-btn');
      btn.textContent = '⏳';
      try {
        const url = await uploadAvatar(currentUser.id, this.files[0]);
        await updateProfile(currentUser.id, { avatar_url: url });
        window.location.hash = '#profile/' + currentUser.id;
      } catch (e) { alert('Upload failed: ' + e.message); }
    });
  }

  // Friend button actions
  const friendBtn = infoCard.querySelector('#friend-action-btn');
  if (friendBtn) {
    friendBtn.addEventListener('click', async () => {
      const action = friendBtn.dataset.action;
      if (action === 'add') {
        await supabase.from('friendships').insert({ requester_id: currentUser.id, addressee_id: profileId, status: 'pending' });
        await supabase.from('notifications').insert({ user_id: profileId, actor_id: currentUser.id, type: 'friend_request', reference_id: currentUser.id });
        renderProfile(profileId, currentUser, currentProfile);
      } else if (action === 'unfriend') {
        await supabase.from('friendships').delete()
          .or(`and(requester_id.eq.${currentUser.id},addressee_id.eq.${profileId}),and(requester_id.eq.${profileId},addressee_id.eq.${currentUser.id})`);
        renderProfile(profileId, currentUser, currentProfile);
      } else if (action === 'accept') {
        await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendStatus.id);
        await supabase.from('notifications').insert({ user_id: profileId, actor_id: currentUser.id, type: 'friend_accept', reference_id: currentUser.id });
        renderProfile(profileId, currentUser, currentProfile);
      } else if (action === 'cancel') {
        await supabase.from('friendships').delete().eq('id', friendStatus.id);
        renderProfile(profileId, currentUser, currentProfile);
      }
    });
    const msgBtn = infoCard.querySelector('#message-btn');
    if (msgBtn) msgBtn.addEventListener('click', () => { window.location.hash = '#messages/' + profileId; });
  }

  // Profile content area
  const profileContent = document.createElement('div');
  profileContent.className = 'profile-content';
  container.appendChild(profileContent);

  const leftCol = document.createElement('div');
  leftCol.className = 'profile-left-col';
  leftCol.innerHTML = `
    <div class="card bio-card">
      <h3>Intro</h3>
      ${profile.bio ? `<p class="bio-text">${escapeHtml(profile.bio)}</p>` : '<p class="bio-text" style="color:var(--text2)">No bio yet.</p>'}
      ${isOwn ? `<button class="bio-edit-btn" id="edit-bio-btn">Edit bio</button>` : ''}
    </div>`;
  profileContent.appendChild(leftCol);

  if (isOwn) {
    leftCol.querySelector('#edit-bio-btn')?.addEventListener('click', () => openEditProfileModal(profile, currentUser, () => renderProfile(profileId, currentUser, currentProfile)));
  }

  const rightCol = document.createElement('div');
  rightCol.className = 'profile-right-col';
  profileContent.appendChild(rightCol);

  // Tab content
  const tabs = infoCard.querySelectorAll('.profile-nav-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      loadTabContent(tab.dataset.tab, rightCol, profile, currentUser, currentProfile);
    });
  });

  loadTabContent('posts', rightCol, profile, currentUser, currentProfile);
}

function buildFriendButton(isOwn, friendStatus, currentUser, profileId, profile) {
  if (isOwn) return `<button class="btn-secondary" onclick="document.getElementById('edit-profile-modal')?.classList.add('active')">✏️ Edit profile</button>`;
  if (!friendStatus) return `<button class="btn-primary" id="friend-action-btn" data-action="add">➕ Add friend</button><button class="btn-secondary" id="message-btn">💬 Message</button>`;
  if (friendStatus.status === 'accepted') return `<button class="btn-secondary" id="friend-action-btn" data-action="unfriend">✓ Friends</button><button class="btn-primary" id="message-btn">💬 Message</button>`;
  if (friendStatus.status === 'pending' && friendStatus.requester_id === currentUser.id) return `<button class="btn-secondary" id="friend-action-btn" data-action="cancel">⏳ Pending</button>`;
  if (friendStatus.status === 'pending' && friendStatus.addressee_id === currentUser.id) return `<button class="btn-primary" id="friend-action-btn" data-action="accept">✓ Accept</button><button class="btn-secondary" id="friend-action-btn" data-action="cancel">✕ Decline</button>`;
  return '';
}

async function loadTabContent(tab, container, profile, currentUser, currentProfile) {
  container.innerHTML = '<div class="spinner"></div>';
  if (tab === 'posts') {
    const { data: posts } = await supabase.from('posts').select('*, profiles:user_id(id, full_name, avatar_url)').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(20);
    container.innerHTML = '';
    if (!posts || posts.length === 0) { container.innerHTML = '<div class="empty-state"><p>No posts yet.</p></div>'; return; }
    for (const post of posts) container.appendChild(await buildPostCard(post, currentUser, currentProfile));
  } else if (tab === 'friends') {
    const { data: friendships } = await supabase.from('friendships').select('requester_id, addressee_id').or(`requester_id.eq.${profile.id},addressee_id.eq.${profile.id}`).eq('status', 'accepted');
    const friendIds = (friendships || []).map(f => f.requester_id === profile.id ? f.addressee_id : f.requester_id);
    container.innerHTML = '';
    if (!friendIds.length) { container.innerHTML = '<div class="empty-state"><p>No friends yet.</p></div>'; return; }
    const { data: friends } = await supabase.from('profiles').select('*').in('id', friendIds);
    const grid = document.createElement('div');
    grid.className = 'friends-grid';
    (friends || []).forEach(f => {
      const card = document.createElement('div');
      card.className = 'friend-card';
      card.innerHTML = f.avatar_url
        ? `<img src="${f.avatar_url}" alt="${f.full_name}">`
        : `<div style="aspect-ratio:1;background:var(--border);display:flex;align-items:center;justify-content:center;font-size:48px">${(f.full_name||'?')[0].toUpperCase()}</div>`;
      card.innerHTML += `<div class="friend-card-info"><div class="friend-card-name">${f.full_name}</div></div>`;
      card.addEventListener('click', () => { window.location.hash = '#profile/' + f.id; });
      grid.appendChild(card);
    });
    container.appendChild(grid);
  } else if (tab === 'photos') {
    const { data: posts } = await supabase.from('posts').select('image_url').eq('user_id', profile.id).not('image_url', 'is', null).order('created_at', { ascending: false }).limit(30);
    container.innerHTML = '';
    if (!posts || posts.length === 0) { container.innerHTML = '<div class="empty-state"><p>No photos yet.</p></div>'; return; }
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:4px;width:100%';
    posts.forEach(p => {
      const img = document.createElement('img');
      img.src = p.image_url;
      img.style.cssText = 'width:100%;aspect-ratio:1;object-fit:cover;cursor:pointer;border-radius:4px';
      img.addEventListener('click', () => {
        let v = document.getElementById('img-viewer');
        if (!v) { v = document.createElement('div'); v.id = 'img-viewer'; v.className = 'img-viewer'; v.innerHTML = '<button class="img-viewer-close">✕</button><img src="" alt="">'; v.addEventListener('click', e => { if (e.target === v) v.classList.remove('active'); }); v.querySelector('.img-viewer-close').addEventListener('click', () => v.classList.remove('active')); document.body.appendChild(v); }
        v.querySelector('img').src = p.image_url;
        v.classList.add('active');
      });
      grid.appendChild(img);
    });
    container.appendChild(grid);
  }
}

function openEditProfileModal(profile, currentUser, onSave) {
  let modal = document.getElementById('edit-profile-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'edit-profile-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header"><h2>Edit Profile</h2><button class="modal-close">✕</button></div>
        <div class="modal-body">
          <div id="ep-error" style="color:#c0392b;font-size:14px;display:none;margin-bottom:8px"></div>
          <label style="font-weight:600;display:block;margin-bottom:4px">Full name</label>
          <input id="ep-name" type="text" style="width:100%;border:1px solid var(--border);border-radius:6px;padding:10px;font-size:15px;margin-bottom:12px;font-family:var(--font);outline:none" value="${escapeAttr(profile.full_name||'')}">
          <label style="font-weight:600;display:block;margin-bottom:4px">Bio</label>
          <textarea id="ep-bio" style="width:100%;border:1px solid var(--border);border-radius:6px;padding:10px;font-size:15px;resize:none;height:80px;font-family:var(--font);outline:none">${escapeHtml(profile.bio||'')}</textarea>
        </div>
        <div class="modal-footer">
          <button class="btn-secondary" id="ep-cancel">Cancel</button>
          <button class="btn-primary" id="ep-save">Save</button>
        </div>
      </div>`;
    modal.querySelector('.modal-close').addEventListener('click', () => modal.classList.remove('active'));
    modal.querySelector('#ep-cancel').addEventListener('click', () => modal.classList.remove('active'));
    modal.addEventListener('click', e => { if (e.target === modal) modal.classList.remove('active'); });
    modal.querySelector('#ep-save').addEventListener('click', async () => {
      const name = modal.querySelector('#ep-name').value.trim();
      const bio = modal.querySelector('#ep-bio').value.trim();
      const errEl = modal.querySelector('#ep-error');
      if (!name) { errEl.textContent = 'Name is required.'; errEl.style.display = 'block'; return; }
      try {
        await updateProfile(currentUser.id, { full_name: name, bio });
        modal.classList.remove('active');
        onSave();
      } catch (e) { errEl.textContent = e.message; errEl.style.display = 'block'; }
    });
    document.body.appendChild(modal);
  } else {
    modal.querySelector('#ep-name').value = profile.full_name || '';
    modal.querySelector('#ep-bio').value = profile.bio || '';
  }
  modal.classList.add('active');
}

function escapeHtml(t) { return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function escapeAttr(t) { return String(t).replace(/"/g,'&quot;'); }
