import { supabase } from './supabase.js';
import { setActiveChannel } from './router.js';

const TYPE_META = {
  like:           { icon: '👍', bg: '#1877f2', label: 'liked your post' },
  comment:        { icon: '💬', bg: '#1877f2', label: 'commented on your post' },
  friend_request: { icon: '👥', bg: '#1877f2', label: 'sent you a friend request' },
  friend_accept:  { icon: '✓',  bg: '#42b72a', label: 'accepted your friend request' },
  message:        { icon: '✉️', bg: '#1877f2', label: 'sent you a message' },
};

function timeAgo(d) {
  const diff = (Date.now() - new Date(d)) / 1000;
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(d).toLocaleDateString();
}

export async function renderNotifications(currentUser) {
  const container = document.getElementById('content');
  container.style.alignItems = 'center';
  container.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.style.cssText = 'width:100%;max-width:680px';
  container.appendChild(wrap);

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:12px';
  header.innerHTML = `
    <h2 style="font-size:24px;font-weight:700">Notifications</h2>
    <button id="mark-all-read" style="background:none;border:none;color:var(--blue);font-size:15px;font-weight:500;cursor:pointer">Mark all as read</button>`;
  wrap.appendChild(header);

  header.querySelector('#mark-all-read').addEventListener('click', async () => {
    await supabase.from('notifications').update({ read: true }).eq('user_id', currentUser.id).eq('read', false);
    wrap.querySelectorAll('.notif-item.unread').forEach(el => {
      el.classList.remove('unread');
      const dot = el.querySelector('.notif-dot');
      if (dot) dot.remove();
    });
    updateBadge(currentUser.id);
  });

  const { data: notifs, error } = await supabase
    .from('notifications')
    .select('*, actor:actor_id(id, full_name, avatar_url)')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error || !notifs?.length) {
    wrap.innerHTML += '<div class="empty-state"><div class="icon">🔔</div><p>No notifications yet.</p></div>';
    return;
  }

  const card = document.createElement('div');
  card.className = 'card';
  wrap.appendChild(card);

  notifs.forEach(n => card.appendChild(buildNotifItem(n, currentUser)));
}

function buildNotifItem(n, currentUser) {
  const meta = TYPE_META[n.type] || { icon: '🔔', bg: '#1877f2', label: 'did something' };
  const actor = n.actor;
  const item = document.createElement('div');
  item.className = 'notif-item' + (n.read ? '' : ' unread');
  item.dataset.id = n.id;

  const avatarHtml = actor?.avatar_url
    ? `<img src="${actor.avatar_url}" alt="${actor.full_name}" style="width:56px;height:56px;border-radius:50%;object-fit:cover">`
    : `<div class="avatar-placeholder" style="width:56px;height:56px;font-size:21px">${(actor?.full_name||'?')[0].toUpperCase()}</div>`;

  item.innerHTML = `
    <div class="notif-avatar-wrap">
      ${avatarHtml}
      <div class="notif-type-icon" style="background:${meta.bg}">${meta.icon}</div>
    </div>
    <div class="notif-info">
      <div class="notif-text"><strong>${actor?.full_name || 'Someone'}</strong> ${meta.label}</div>
      <div class="notif-time">${timeAgo(n.created_at)}</div>
    </div>
    ${n.read ? '' : '<div class="notif-dot"></div>'}`;

  item.addEventListener('click', async () => {
    if (!n.read) {
      await supabase.from('notifications').update({ read: true }).eq('id', n.id);
      item.classList.remove('unread');
      const dot = item.querySelector('.notif-dot');
      if (dot) dot.remove();
      n.read = true;
      updateBadge(currentUser.id);
    }
    // Navigate based on type
    if (n.type === 'message') window.location.hash = '#messages/' + actor?.id;
    else if (n.type === 'friend_request' || n.type === 'friend_accept') window.location.hash = '#friends';
    else if (n.reference_id && (n.type === 'like' || n.type === 'comment')) window.location.hash = '#feed';
    else if (actor?.id) window.location.hash = '#profile/' + actor.id;
  });

  return item;
}

export async function updateBadge(userId) {
  const { count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);

  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : count;
    badge.style.display = 'block';
  } else {
    badge.style.display = 'none';
  }
}

export function subscribeNotifications(userId) {
  const channel = supabase.channel('notifications-' + userId)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'notifications',
      filter: `user_id=eq.${userId}`
    }, () => updateBadge(userId))
    .subscribe();
  setActiveChannel(channel);
}
