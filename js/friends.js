import { supabase } from './supabase.js';

function avatarEl(url, name, size = 40) {
  if (url) return `<img src="${url}" alt="${name}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover">`;
  const initials = (name || '?').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  return `<div class="avatar-placeholder" style="width:${size}px;height:${size}px;font-size:${size * 0.38}px">${initials}</div>`;
}

export async function renderFriends(currentUser, currentProfile) {
  const container = document.getElementById('content');
  container.style.alignItems = 'flex-start';
  container.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.style.cssText = 'width:100%;max-width:820px';
  container.appendChild(wrap);

  // Incoming requests
  const { data: incoming } = await supabase
    .from('friendships')
    .select('*, profiles:requester_id(id, full_name, avatar_url)')
    .eq('addressee_id', currentUser.id)
    .eq('status', 'pending');

  if (incoming?.length) {
    const section = document.createElement('div');
    section.className = 'card';
    section.style.padding = '16px';
    section.innerHTML = `<div class="section-header"><h3>Friend Requests</h3></div>`;
    const grid = document.createElement('div');
    grid.className = 'friends-grid';
    incoming.forEach(req => {
      const p = req.profiles;
      const card = document.createElement('div');
      card.className = 'friend-card';
      card.innerHTML = p.avatar_url
        ? `<img src="${p.avatar_url}" alt="${p.full_name}">`
        : `<div style="aspect-ratio:1;background:var(--border);display:flex;align-items:center;justify-content:center;font-size:48px">${(p.full_name||'?')[0].toUpperCase()}</div>`;
      card.innerHTML += `
        <div class="friend-card-info"><div class="friend-card-name">${p.full_name}</div></div>
        <div class="friend-card-actions">
          <button class="btn-primary accept-btn" data-id="${req.id}" data-uid="${p.id}" style="width:100%;justify-content:center">Confirm</button>
          <button class="btn-secondary decline-btn" data-id="${req.id}" style="width:100%;justify-content:center">Delete</button>
        </div>`;
      card.querySelector('.accept-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        const btn = e.currentTarget;
        await supabase.from('friendships').update({ status: 'accepted' }).eq('id', req.id);
        await supabase.from('notifications').insert({ user_id: p.id, actor_id: currentUser.id, type: 'friend_accept', reference_id: currentUser.id });
        card.remove();
        if (!grid.children.length) section.remove();
        renderFriends(currentUser, currentProfile);
      });
      card.querySelector('.decline-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        await supabase.from('friendships').delete().eq('id', req.id);
        card.remove();
        if (!grid.children.length) section.remove();
      });
      card.addEventListener('click', () => { window.location.hash = '#profile/' + p.id; });
      grid.appendChild(card);
    });
    section.appendChild(grid);
    wrap.appendChild(section);
  }

  // People you may know
  const { data: friendships } = await supabase
    .from('friendships')
    .select('requester_id, addressee_id')
    .or(`requester_id.eq.${currentUser.id},addressee_id.eq.${currentUser.id}`);

  const knownIds = new Set([currentUser.id]);
  (friendships || []).forEach(f => { knownIds.add(f.requester_id); knownIds.add(f.addressee_id); });

  const { data: suggestions } = await supabase
    .from('profiles')
    .select('*')
    .not('id', 'in', `(${[...knownIds].join(',')})`)
    .limit(12);

  if (suggestions?.length) {
    const section = document.createElement('div');
    section.className = 'card';
    section.style.padding = '16px';
    section.innerHTML = `<div class="section-header"><h3>People You May Know</h3></div>`;
    const grid = document.createElement('div');
    grid.className = 'friends-grid';
    suggestions.forEach(p => {
      const card = document.createElement('div');
      card.className = 'friend-card';
      card.innerHTML = p.avatar_url
        ? `<img src="${p.avatar_url}" alt="${p.full_name}">`
        : `<div style="aspect-ratio:1;background:var(--border);display:flex;align-items:center;justify-content:center;font-size:48px">${(p.full_name||'?')[0].toUpperCase()}</div>`;
      card.innerHTML += `
        <div class="friend-card-info"><div class="friend-card-name">${p.full_name}</div></div>
        <div class="friend-card-actions">
          <button class="btn-primary add-friend-btn" style="width:100%;justify-content:center">➕ Add Friend</button>
        </div>`;
      card.querySelector('.add-friend-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        const btn = e.currentTarget;
        btn.textContent = 'Pending';
        btn.disabled = true;
        await supabase.from('friendships').insert({ requester_id: currentUser.id, addressee_id: p.id, status: 'pending' });
        await supabase.from('notifications').insert({ user_id: p.id, actor_id: currentUser.id, type: 'friend_request', reference_id: currentUser.id });
      });
      card.addEventListener('click', () => { window.location.hash = '#profile/' + p.id; });
      grid.appendChild(card);
    });
    section.appendChild(grid);
    wrap.appendChild(section);
  }

  // All friends
  const { data: allFriendships } = await supabase
    .from('friendships')
    .select('requester_id, addressee_id')
    .or(`requester_id.eq.${currentUser.id},addressee_id.eq.${currentUser.id}`)
    .eq('status', 'accepted');

  const friendIds = (allFriendships || []).map(f => f.requester_id === currentUser.id ? f.addressee_id : f.requester_id);
  if (friendIds.length) {
    const { data: friends } = await supabase.from('profiles').select('*').in('id', friendIds);
    const section = document.createElement('div');
    section.className = 'card';
    section.style.padding = '16px';
    section.innerHTML = `<div class="section-header"><h3>All Friends</h3></div>`;
    const grid = document.createElement('div');
    grid.className = 'friends-grid';
    (friends || []).forEach(p => {
      const card = document.createElement('div');
      card.className = 'friend-card';
      card.innerHTML = p.avatar_url
        ? `<img src="${p.avatar_url}" alt="${p.full_name}">`
        : `<div style="aspect-ratio:1;background:var(--border);display:flex;align-items:center;justify-content:center;font-size:48px">${(p.full_name||'?')[0].toUpperCase()}</div>`;
      card.innerHTML += `
        <div class="friend-card-info"><div class="friend-card-name">${p.full_name}</div></div>
        <div class="friend-card-actions">
          <button class="btn-secondary" style="width:100%;justify-content:center">Friends ✓</button>
        </div>`;
      card.addEventListener('click', () => { window.location.hash = '#profile/' + p.id; });
      grid.appendChild(card);
    });
    section.appendChild(grid);
    wrap.appendChild(section);
  }

  if (!wrap.children.length) {
    wrap.innerHTML = '<div class="empty-state"><div class="icon">👥</div><p>No friends or suggestions yet.</p></div>';
  }
}
