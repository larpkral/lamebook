import { supabase } from './supabase.js';
import { setActiveChannel } from './router.js';

function timeAgo(d) {
  const diff = (Date.now() - new Date(d)) / 1000;
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return new Date(d).toLocaleDateString();
}

function avatarEl(url, name, size = 56) {
  if (url) return `<img src="${url}" alt="${esc(name||'')}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover">`;
  const init = (name || '?').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  return `<div class="av-ph" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.38)}px">${init}</div>`;
}

export async function renderMessages(currentUser, currentProfile, openWithUserId) {
  const container = document.getElementById('content');
  container.style.alignItems = 'center';
  container.style.padding = '16px';
  container.innerHTML = '';

  const layout = document.createElement('div');
  layout.className = 'msgs-shell';
  container.appendChild(layout);

  // Left panel: conversations
  const convPanel = document.createElement('div');
  convPanel.className = 'conv-panel';
  convPanel.innerHTML = `
    <div class="conv-head">
      <h2>Chats</h2>
      <div class="conv-search">
        <span style="color:var(--text3);font-size:14px">🔍</span>
        <input type="text" placeholder="Search Messenger" id="conv-search">
      </div>
    </div>
    <div class="conv-list" id="conv-list"></div>`;
  layout.appendChild(convPanel);

  // Right panel: chat
  const chatPanel = document.createElement('div');
  chatPanel.className = 'chat-panel';
  chatPanel.id = 'chat-panel';
  chatPanel.innerHTML = `
    <div class="chat-placeholder">
      <div class="ph-icon">💬</div>
      <h3>Your messages</h3>
      <p>Send a message to start a chat.</p>
    </div>`;
  layout.appendChild(chatPanel);

  // Load conversations
  const { data: messages } = await supabase
    .from('messages')
    .select('sender_id, receiver_id, content, created_at, read')
    .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
    .order('created_at', { ascending: false });

  const convMap = new Map();
  (messages || []).forEach(m => {
    const otherId = m.sender_id === currentUser.id ? m.receiver_id : m.sender_id;
    if (!convMap.has(otherId)) convMap.set(otherId, m);
  });

  const otherIds = [...convMap.keys()];
  let profiles = [];
  if (otherIds.length) {
    const { data } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', otherIds);
    profiles = data || [];
  }

  // Also load friends to allow starting new chats
  const { data: friendships } = await supabase
    .from('friendships')
    .select('requester_id, addressee_id')
    .or(`requester_id.eq.${currentUser.id},addressee_id.eq.${currentUser.id}`)
    .eq('status', 'accepted');
  const friendIds = (friendships || []).map(f => f.requester_id === currentUser.id ? f.addressee_id : f.requester_id);
  const newFriendIds = friendIds.filter(id => !convMap.has(id));
  if (newFriendIds.length) {
    const { data: fp } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', newFriendIds);
    if (fp) profiles = [...profiles, ...fp.map(p => ({ ...p, _new: true }))];
  }

  const convList = convPanel.querySelector('#conv-list');
  const profileMap = new Map(profiles.map(p => [p.id, p]));

  const renderConvList = (filter = '') => {
    convList.innerHTML = '';
    const sorted = [...profileMap.values()].filter(p => !filter || p.full_name?.toLowerCase().includes(filter.toLowerCase()));
    sorted.forEach(p => {
      const lastMsg = convMap.get(p.id);
      const item = document.createElement('div');
      item.className = 'conv-item';
      if (lastMsg && !lastMsg.read && lastMsg.sender_id !== currentUser.id) item.classList.add('conv-unread');
      item.dataset.userId = p.id;
      item.innerHTML = `
        ${avatarEl(p.avatar_url, p.full_name, 52)}
        <div class="conv-info">
          <div class="conv-name">${esc(p.full_name)}</div>
          <div class="conv-preview">${lastMsg ? esc(lastMsg.content.substring(0, 40)) : 'Say hi!'}</div>
        </div>
        ${lastMsg ? `<div class="conv-time">${timeAgo(lastMsg.created_at)}</div>` : ''}`;
      item.addEventListener('click', () => {
        convList.querySelectorAll('.conv-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
        openChat(p, currentUser, currentProfile, chatPanel, convMap, convList);
      });
      convList.appendChild(item);
    });
  };

  renderConvList();
  convPanel.querySelector('#conv-search').addEventListener('input', e => renderConvList(e.target.value));

  // Auto-open conversation if routing to specific user
  if (openWithUserId) {
    const p = profileMap.get(openWithUserId);
    if (p) {
      const item = convList.querySelector(`[data-user-id="${openWithUserId}"]`);
      if (item) { item.classList.add('active'); openChat(p, currentUser, currentProfile, chatPanel, convMap, convList); }
    } else {
      const { data: targetProfile } = await supabase.from('profiles').select('*').eq('id', openWithUserId).single();
      if (targetProfile) openChat(targetProfile, currentUser, currentProfile, chatPanel, convMap, convList);
    }
  }
}

async function openChat(otherProfile, currentUser, currentProfile, chatPanel, convMap, convList) {
  // Mark messages as read
  await supabase.from('messages').update({ read: true })
    .eq('sender_id', otherProfile.id).eq('receiver_id', currentUser.id).eq('read', false);

  chatPanel.innerHTML = `
    <div class="chat-head">
      ${otherProfile.avatar_url
        ? `<img src="${otherProfile.avatar_url}" alt="${esc(otherProfile.full_name)}" onclick="window.location.hash='#profile/${otherProfile.id}'">`
        : `<div class="av-ph" style="width:42px;height:42px;font-size:16px;cursor:pointer" onclick="window.location.hash='#profile/${otherProfile.id}'">${(otherProfile.full_name||'?')[0].toUpperCase()}</div>`}
      <div>
        <div class="chat-head-name" onclick="window.location.hash='#profile/${otherProfile.id}'">${esc(otherProfile.full_name)}</div>
        <div class="chat-head-status">Active now</div>
      </div>
    </div>
    <div class="chat-msgs" id="chat-messages"></div>
    <div class="chat-input-row">
      <input type="text" class="chat-input" id="chat-input" placeholder="Aa" autocomplete="off">
      <button class="chat-send" id="chat-send">➤</button>
    </div>`;

  const msgContainer = chatPanel.querySelector('#chat-messages');
  await loadChatMessages(msgContainer, currentUser, otherProfile);

  const sendMsg = async () => {
    const input = chatPanel.querySelector('#chat-input');
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    const { data: newMsg } = await supabase.from('messages')
      .insert({ sender_id: currentUser.id, receiver_id: otherProfile.id, content: text })
      .select().single();
    if (newMsg) {
      appendMessage(msgContainer, newMsg, currentUser, currentProfile, otherProfile);
      convMap.set(otherProfile.id, newMsg);
      const convItem = convList?.querySelector(`[data-user-id="${otherProfile.id}"] .conv-preview`);
      if (convItem) convItem.textContent = text;
      await supabase.from('notifications').insert({ user_id: otherProfile.id, actor_id: currentUser.id, type: 'message', reference_id: newMsg.id });
    }
  };

  chatPanel.querySelector('#chat-send').addEventListener('click', sendMsg);
  chatPanel.querySelector('#chat-input').addEventListener('keydown', e => { if (e.key === 'Enter') sendMsg(); });

  // Realtime subscription
  const channel = supabase.channel(`chat-${currentUser.id}-${otherProfile.id}`)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'messages',
      filter: `receiver_id=eq.${currentUser.id}`
    }, async payload => {
      if (payload.new.sender_id !== otherProfile.id) return;
      appendMessage(msgContainer, payload.new, currentUser, currentProfile, otherProfile);
      convMap.set(otherProfile.id, payload.new);
      await supabase.from('messages').update({ read: true }).eq('id', payload.new.id);
    })
    .subscribe();
  setActiveChannel(channel);
}

async function loadChatMessages(container, currentUser, otherProfile) {
  const { data: msgs } = await supabase
    .from('messages')
    .select('*')
    .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${otherProfile.id}),and(sender_id.eq.${otherProfile.id},receiver_id.eq.${currentUser.id})`)
    .order('created_at', { ascending: true });

  container.innerHTML = '';
  (msgs || []).forEach(m => appendMessage(container, m, currentUser, null, otherProfile, false));
  container.scrollTop = container.scrollHeight;
}

function appendMessage(container, msg, currentUser, currentProfile, otherProfile, scroll = true) {
  const isMine = msg.sender_id === currentUser.id;
  const row = document.createElement('div');
  row.className = 'msg-row' + (isMine ? ' mine' : '');
  const avatarSrc = isMine ? currentProfile?.avatar_url : otherProfile?.avatar_url;
  const avatarName = isMine ? currentProfile?.full_name : otherProfile?.full_name;
  row.innerHTML = `
    ${avatarSrc
      ? `<img src="${avatarSrc}" alt="${esc(avatarName||'')}" style="width:28px;height:28px;border-radius:50%;object-fit:cover">`
      : `<div class="av-ph" style="width:28px;height:28px;font-size:11px">${(avatarName||'?')[0].toUpperCase()}</div>`}
    <div class="msg-bub">${esc(msg.content)}</div>`;
  container.appendChild(row);
  if (scroll) container.scrollTop = container.scrollHeight;
}

function esc(t) { return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
