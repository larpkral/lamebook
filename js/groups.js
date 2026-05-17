import { supabase } from './supabase.js';
import { buildPostCard } from './feed.js';

function avatarEl(url, name, size = 40) {
  if (url) return `<img src="${url}" alt="${esc(name||'')}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover">`;
  const init = (name || '?').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  return `<div class="av-ph" style="width:${size}px;height:${size}px;font-size:${Math.round(size*0.38)}px">${init}</div>`;
}

export async function renderGroups(currentUser, currentProfile, groupId) {
  const container = document.getElementById('content');
  container.style.alignItems = 'flex-start';
  container.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.className = 'groups-wrap';
  container.appendChild(wrap);

  // Left sidebar
  const sidebar = document.createElement('div');
  sidebar.className = 'groups-sb card';
  sidebar.style.padding = '16px';
  sidebar.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <h2 style="font-size:24px;font-weight:700;color:var(--text)">Groups</h2>
      <button class="btn-secondary" id="create-group-btn" style="padding:6px 12px;font-size:13px">+ Create</button>
    </div>
    <div style="font-weight:600;font-size:15px;color:var(--text2);margin-bottom:8px">Your groups</div>
    <div id="groups-list"></div>`;
  wrap.appendChild(sidebar);

  sidebar.querySelector('#create-group-btn').addEventListener('click', () => openCreateGroupModal(currentUser, () => renderGroups(currentUser, currentProfile, groupId)));

  // Main panel
  const main = document.createElement('div');
  main.className = 'groups-main';
  main.id = 'group-main';
  wrap.appendChild(main);

  // Load user's groups
  const { data: memberRows } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', currentUser.id);
  const groupIds = (memberRows || []).map(r => r.group_id);

  let groups = [];
  if (groupIds.length) {
    const { data } = await supabase.from('groups').select('*').in('id', groupIds);
    groups = data || [];
  }

  // Also include groups created by user
  const { data: createdGroups } = await supabase.from('groups').select('*').eq('creator_id', currentUser.id);
  const allGroups = [...groups];
  (createdGroups || []).forEach(g => { if (!allGroups.find(x => x.id === g.id)) allGroups.push(g); });

  const groupsList = sidebar.querySelector('#groups-list');
  allGroups.forEach(g => {
    const item = document.createElement('div');
    item.className = 'group-row' + (groupId === g.id ? ' active' : '');
    item.dataset.id = g.id;
    item.innerHTML = `
      ${g.cover_url
        ? `<img src="${g.cover_url}" style="width:52px;height:52px;border-radius:10px;object-fit:cover">`
        : `<div class="g-ph" style="width:52px;height:52px;border-radius:10px">👥</div>`}
      <div class="group-row-info">
        <div class="group-row-name">${esc(g.name)}</div>
        <div class="group-row-meta">Group</div>
      </div>`;
    item.addEventListener('click', () => {
      sidebar.querySelectorAll('.group-row').forEach(el => el.classList.remove('active'));
      item.classList.add('active');
      window.location.hash = '#groups/' + g.id;
    });
    groupsList.appendChild(item);
  });

  if (!allGroups.length) {
    groupsList.innerHTML = '<div style="color:var(--text2);font-size:14px;padding:8px">No groups yet. Create one!</div>';
  }

  // Discover section
  const discoverEl = document.createElement('div');
  discoverEl.style.cssText = 'margin-top:16px;font-weight:600;font-size:15px;color:var(--text2);margin-bottom:8px';
  discoverEl.textContent = 'Discover';
  sidebar.appendChild(discoverEl);

  const { data: discover } = await supabase.from('groups').select('*').not('id', 'in', groupIds.length ? `(${groupIds.join(',')})` : '(00000000-0000-0000-0000-000000000000)').limit(5);
  (discover || []).forEach(g => {
    if (g.creator_id === currentUser.id) return;
    const item = document.createElement('div');
    item.className = 'group-row';
    item.innerHTML = `
      ${g.cover_url
        ? `<img src="${g.cover_url}" style="width:52px;height:52px;border-radius:10px;object-fit:cover">`
        : `<div class="g-ph" style="width:52px;height:52px;border-radius:10px">🌐</div>`}
      <div class="group-row-info">
        <div class="group-row-name">${esc(g.name)}</div>
        <button class="btn-primary join-btn" style="padding:4px 12px;font-size:13px;margin-top:4px">Join</button>
      </div>`;
    item.querySelector('.join-btn').addEventListener('click', async e => {
      e.stopPropagation();
      await supabase.from('group_members').insert({ group_id: g.id, user_id: currentUser.id, role: 'member' });
      renderGroups(currentUser, currentProfile, groupId);
    });
    item.addEventListener('click', () => { window.location.hash = '#groups/' + g.id; });
    sidebar.appendChild(item);
  });

  // Right: group feed or empty state
  if (groupId) {
    await renderGroupFeed(groupId, currentUser, currentProfile, main);
  } else if (allGroups.length) {
    main.innerHTML = '<div class="empty-state"><div class="es-icon">👥</div><p>Select a group from the list.</p></div>';
  } else {
    main.innerHTML = '<div class="empty-state"><div class="es-icon">👥</div><p>Create or join a group to get started.</p></div>';
  }
}

async function renderGroupFeed(groupId, currentUser, currentProfile, container) {
  container.innerHTML = '<div class="spinner"></div>';

  const { data: group } = await supabase.from('groups').select('*').eq('id', groupId).single();
  if (!group) { container.innerHTML = '<div class="empty-state"><p>Group not found.</p></div>'; return; }

  const { count: memberCount } = await supabase.from('group_members').select('*', { count: 'exact', head: true }).eq('group_id', groupId);

  // Check membership
  const { data: membership } = await supabase.from('group_members').select('role').eq('group_id', groupId).eq('user_id', currentUser.id).single();
  const isMember = !!membership || group.creator_id === currentUser.id;
  const isAdmin = membership?.role === 'admin' || group.creator_id === currentUser.id;

  container.innerHTML = '';

  // Cover
  const coverEl = document.createElement('div');
  coverEl.className = 'card';
  coverEl.style.cssText = 'margin-bottom:16px;max-width:100%';
  if (group.cover_url) {
    coverEl.innerHTML = `<img src="${group.cover_url}" class="group-cover-img" alt="cover">`;
  } else {
    coverEl.innerHTML = `<div class="group-cover-ph"></div>`;
  }
  coverEl.innerHTML += `
    <div style="padding:16px">
      <h2 style="font-size:28px;font-weight:700;margin-bottom:4px;color:var(--text)">${esc(group.name)}</h2>
      <div style="color:var(--text2);font-size:14px;margin-bottom:12px">🔒 Private group · ${memberCount || 0} members</div>
      ${group.description ? `<p style="font-size:15px;margin-bottom:12px;color:var(--text)">${esc(group.description)}</p>` : ''}
      <div style="display:flex;gap:8px">
        ${isMember
          ? `<button class="btn-secondary leave-group-btn">✓ Joined</button>`
          : `<button class="btn-primary join-group-btn">+ Join Group</button>`}
        ${isAdmin ? `<button class="btn-secondary" id="manage-group-btn">⚙️ Manage</button>` : ''}
      </div>
    </div>`;
  container.appendChild(coverEl);

  const joinBtn = coverEl.querySelector('.join-group-btn');
  if (joinBtn) joinBtn.addEventListener('click', async () => { await supabase.from('group_members').insert({ group_id: groupId, user_id: currentUser.id, role: 'member' }); renderGroupFeed(groupId, currentUser, currentProfile, container); });
  const leaveBtn = coverEl.querySelector('.leave-group-btn');
  if (leaveBtn) leaveBtn.addEventListener('click', async () => { await supabase.from('group_members').delete().eq('group_id', groupId).eq('user_id', currentUser.id); renderGroupFeed(groupId, currentUser, currentProfile, container); });

  if (!isMember) return;

  // Create post in group
  const createCard = document.createElement('div');
  createCard.className = 'card';
  createCard.style.cssText = 'padding:12px 16px;max-width:100%';
  createCard.innerHTML = `
    <div style="display:flex;align-items:center;gap:8px">
      ${avatarEl(currentProfile?.avatar_url, currentProfile?.full_name)}
      <button class="create-prompt" id="open-group-post" style="text-align:left">Write something to the group...</button>
    </div>`;
  container.appendChild(createCard);
  createCard.querySelector('#open-group-post').addEventListener('click', () => openGroupPostModal(groupId, currentUser, currentProfile, () => renderGroupFeed(groupId, currentUser, currentProfile, container)));

  // Group posts
  const postsWrap = document.createElement('div');
  container.appendChild(postsWrap);
  postsWrap.innerHTML = '<div class="spinner"></div>';

  const { data: posts } = await supabase
    .from('group_posts')
    .select('*, profiles:user_id(id, full_name, avatar_url)')
    .eq('group_id', groupId)
    .order('created_at', { ascending: false })
    .limit(20);

  postsWrap.innerHTML = '';
  if (!posts?.length) { postsWrap.innerHTML = '<div class="empty-state"><p>No posts yet. Be the first!</p></div>'; return; }

  for (const post of posts) {
    const card = buildGroupPostCard(post, currentUser, currentProfile);
    postsWrap.appendChild(card);
  }
}

function buildGroupPostCard(post, currentUser, currentProfile) {
  const card = document.createElement('div');
  card.className = 'card';
  card.style.maxWidth = '100%';
  const author = post.profiles;
  const timeAgo = d => { const diff = (Date.now() - new Date(d)) / 1000; if (diff < 60) return 'Just now'; if (diff < 3600) return `${Math.floor(diff/60)}m ago`; if (diff < 86400) return `${Math.floor(diff/3600)}h ago`; return new Date(d).toLocaleDateString(); };
  card.innerHTML = `
    <div class="post-head">
      <div class="post-head-av" onclick="window.location.hash='#profile/${author?.id}'">
        ${author?.avatar_url
          ? `<img src="${author.avatar_url}" alt="${esc(author.full_name)}">`
          : `<div class="av-ph" style="width:42px;height:42px;font-size:16px">${(author?.full_name||'?')[0].toUpperCase()}</div>`}
      </div>
      <div class="post-head-info">
        <div class="post-author" onclick="window.location.hash='#profile/${author?.id}'">${esc(author?.full_name || 'User')}</div>
        <div class="post-time">${timeAgo(post.created_at)}</div>
      </div>
    </div>
    ${post.content ? `<div class="post-text">${esc(post.content)}</div>` : ''}
    ${post.image_url ? `<img class="post-img" src="${post.image_url}" alt="post" loading="lazy">` : ''}
    <div class="post-actions">
      <button class="paction"><span class="paction-icon">👍</span> Like</button>
      <button class="paction"><span class="paction-icon">💬</span> Comment</button>
    </div>`;
  return card;
}

function openGroupPostModal(groupId, currentUser, currentProfile, onPost) {
  let modal = document.getElementById('group-post-modal');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'group-post-modal';
  modal.className = 'modal-bg active';
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-head"><h2>Create post</h2><button class="modal-x">✕</button></div>
      <div class="modal-body">
        <div id="gp-error" class="err-msg" style="display:none"></div>
        <textarea class="modal-textarea" placeholder="Write something..."></textarea>
        <img id="gp-preview" class="modal-img-preview" src="" alt="">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-top:8px;color:var(--text2);font-size:14px">
          🖼️ Add photo
          <input type="file" id="gp-img-input" accept="image/*" style="display:none">
        </label>
      </div>
      <div class="modal-foot"><button class="btn-primary" id="gp-submit" style="justify-content:center">Post</button></div>
    </div>`;
  modal.querySelector('.modal-x').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  const imgInput = modal.querySelector('#gp-img-input');
  imgInput.addEventListener('change', () => { if (imgInput.files[0]) { const prev = modal.querySelector('#gp-preview'); prev.src = URL.createObjectURL(imgInput.files[0]); prev.style.display = 'block'; } });
  modal.querySelector('#gp-submit').addEventListener('click', async () => {
    const content = modal.querySelector('textarea').value.trim();
    const file = imgInput.files[0];
    const errEl = modal.querySelector('#gp-error');
    const btn = modal.querySelector('#gp-submit');
    errEl.style.display = 'none';
    if (!content && !file) { errEl.textContent = 'Write something or add a photo.'; errEl.style.display = 'block'; return; }
    btn.textContent = 'Posting...'; btn.disabled = true;
    let image_url = null;
    if (file) {
      const path = `${currentUser.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from('posts').upload(path, file);
      if (upErr) { errEl.textContent = upErr.message; errEl.style.display = 'block'; btn.textContent = 'Post'; btn.disabled = false; return; }
      const { data } = supabase.storage.from('posts').getPublicUrl(path);
      image_url = data.publicUrl;
    }
    const { error } = await supabase.from('group_posts').insert({ group_id: groupId, user_id: currentUser.id, content, image_url });
    if (error) { errEl.textContent = error.message; errEl.style.display = 'block'; btn.textContent = 'Post'; btn.disabled = false; return; }
    modal.remove();
    onPost();
  });
  document.body.appendChild(modal);
}

function openCreateGroupModal(currentUser, onCreated) {
  let modal = document.getElementById('create-group-modal');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'create-group-modal';
  modal.className = 'modal-bg active';
  modal.innerHTML = `
    <div class="modal-box" style="max-width:460px">
      <div class="modal-head"><h2>Create group</h2><button class="modal-x">✕</button></div>
      <div class="modal-body">
        <div id="cg-error" class="err-msg" style="display:none"></div>
        <label style="font-weight:600;display:block;margin-bottom:6px;font-size:13px;color:var(--text2)">Group name *</label>
        <input id="cg-name" type="text" placeholder="Enter group name" style="width:100%;background:var(--input-bg);border:1px solid var(--input-border);border-radius:10px;padding:11px 14px;font-size:15px;color:var(--text);font-family:var(--font);outline:none;margin-bottom:14px;transition:border-color .2s">
        <label style="font-weight:600;display:block;margin-bottom:6px;font-size:13px;color:var(--text2)">Description</label>
        <textarea id="cg-desc" placeholder="What's this group about?" style="width:100%;background:var(--input-bg);border:1px solid var(--input-border);border-radius:10px;padding:11px 14px;font-size:15px;color:var(--text);font-family:var(--font);outline:none;resize:none;height:80px;margin-bottom:14px;transition:border-color .2s"></textarea>
        <label style="font-weight:600;display:block;margin-bottom:6px;font-size:13px;color:var(--text2)">Cover photo</label>
        <label style="cursor:pointer">
          <div id="cg-cover-label" style="border:2px dashed var(--border);border-radius:10px;padding:20px;text-align:center;color:var(--text2);font-size:14px">📷 Click to upload cover photo</div>
          <input type="file" id="cg-cover-input" accept="image/*" style="display:none">
        </label>
        <img id="cg-cover-preview" style="width:100%;border-radius:10px;margin-top:8px;display:none" src="" alt="">
      </div>
      <div class="modal-foot"><button class="btn-primary" id="cg-submit" style="justify-content:center">Create group</button></div>
    </div>`;
  modal.querySelector('.modal-x').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  const coverInput = modal.querySelector('#cg-cover-input');
  coverInput.addEventListener('change', () => { if (coverInput.files[0]) { modal.querySelector('#cg-cover-preview').src = URL.createObjectURL(coverInput.files[0]); modal.querySelector('#cg-cover-preview').style.display = 'block'; } });
  modal.querySelector('#cg-submit').addEventListener('click', async () => {
    const name = modal.querySelector('#cg-name').value.trim();
    const desc = modal.querySelector('#cg-desc').value.trim();
    const file = coverInput.files[0];
    const errEl = modal.querySelector('#cg-error');
    const btn = modal.querySelector('#cg-submit');
    errEl.style.display = 'none';
    if (!name) { errEl.textContent = 'Group name is required.'; errEl.style.display = 'block'; return; }
    btn.textContent = 'Creating...'; btn.disabled = true;
    let cover_url = null;
    if (file) {
      const path = `${currentUser.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from('groups').upload(path, file);
      if (!upErr) { const { data } = supabase.storage.from('groups').getPublicUrl(path); cover_url = data.publicUrl; }
    }
    const { data: group, error } = await supabase.from('groups').insert({ name, description: desc, cover_url, creator_id: currentUser.id }).select().single();
    if (error) { errEl.textContent = error.message; errEl.style.display = 'block'; btn.textContent = 'Create group'; btn.disabled = false; return; }
    await supabase.from('group_members').insert({ group_id: group.id, user_id: currentUser.id, role: 'admin' });
    modal.remove();
    onCreated();
    window.location.hash = '#groups/' + group.id;
  });
  document.body.appendChild(modal);
}

function esc(t) { return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
