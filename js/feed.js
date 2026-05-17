import { supabase } from './supabase.js';

// ── Demo posts (always rendered, no Supabase needed) ──────────────────

const DEMO_POSTS = [
  {
    id: 'demo-1',
    author: { name: 'Alex Rivera', avatar: 'https://i.pravatar.cc/150?img=3' },
    content: "Just got back from a 3-week trip through Japan \u{1f1ef}\u{1f1f5} The food, the people, the temples — absolutely blown away. Already planning the next visit!",
    image: 'https://picsum.photos/seed/jpn1/600/400',
    time: '2 hours ago', likes: 47,
    comments: [
      { name: 'Maria Chen', avatar: 'https://i.pravatar.cc/150?img=5', text: 'So jealous!! Was Kyoto your favorite?', time: '1h' },
      { name: 'Sam Park',   avatar: 'https://i.pravatar.cc/150?img=7', text: 'The ramen alone is worth the trip 😂', time: '45m' },
    ]
  },
  {
    id: 'demo-2',
    author: { name: 'Jamie Morgan', avatar: 'https://i.pravatar.cc/150?img=12' },
    content: "Finally finished my home office setup after months of tweaking. Standing desk + ultrawide = game changer 🖥️✨",
    image: 'https://picsum.photos/seed/desk7/600/380',
    time: '4 hours ago', likes: 89,
    comments: [
      { name: 'Taylor Kim', avatar: 'https://i.pravatar.cc/150?img=9', text: 'What monitor is that?? 👀', time: '3h' },
    ]
  },
  {
    id: 'demo-3',
    author: { name: 'Priya Nair', avatar: 'https://i.pravatar.cc/150?img=47' },
    content: "Hot take: the best productivity hack is just going to bed on time. Wild, I know 😄",
    image: null,
    time: '5 hours ago', likes: 312,
    comments: [
      { name: 'Leo Fernandez', avatar: 'https://i.pravatar.cc/150?img=15', text: 'This hit differently at midnight 💀', time: '4h' },
      { name: 'Ava Thompson',  avatar: 'https://i.pravatar.cc/150?img=20', text: 'Sending this to my entire team lmao', time: '3h' },
      { name: 'Chris Wu',      avatar: 'https://i.pravatar.cc/150?img=33', text: 'Science backed and yet here I am at 2am', time: '2h' },
    ]
  },
  {
    id: 'demo-4',
    author: { name: 'Marcus Lee', avatar: 'https://i.pravatar.cc/150?img=52' },
    content: "Made sourdough from scratch for the first time. Three days of effort, zero regrets 🍞",
    image: 'https://picsum.photos/seed/brd22/600/400',
    time: '6 hours ago', likes: 134,
    comments: [
      { name: 'Sophie Adams', avatar: 'https://i.pravatar.cc/150?img=25', text: 'Recipe please!!', time: '5h' },
    ]
  },
  {
    id: 'demo-5',
    author: { name: 'Chloe Bennett', avatar: 'https://i.pravatar.cc/150?img=44' },
    content: "Golden hour today was something else 🌅",
    image: 'https://picsum.photos/seed/sun77/600/450',
    time: '8 hours ago', likes: 203,
    comments: []
  },
  {
    id: 'demo-6',
    author: { name: 'Daniel Osei', avatar: 'https://i.pravatar.cc/150?img=60' },
    content: "Reminder to drink water, close those 47 browser tabs, and text someone you've been meaning to reach out to. You're welcome 💧",
    image: null,
    time: '10 hours ago', likes: 521,
    comments: [
      { name: 'Nadia Patel', avatar: 'https://i.pravatar.cc/150?img=38', text: 'Closed 23 tabs just now. Thank you.', time: '9h' },
      { name: 'Jay Torres',  avatar: 'https://i.pravatar.cc/150?img=17', text: 'Texting my mum rn', time: '8h' },
    ]
  },
  {
    id: 'demo-7',
    author: { name: 'Elena Rossi', avatar: 'https://i.pravatar.cc/150?img=49' },
    content: "Three years at this job today 🎉 Grateful for the team and everything I've learned. Here's to many more!",
    image: 'https://picsum.photos/seed/cel3/600/400',
    time: '1 day ago', likes: 178,
    comments: [
      { name: 'Omar Hassan', avatar: 'https://i.pravatar.cc/150?img=55', text: 'Congrats!! Well deserved 🙌', time: '23h' },
    ]
  },
  {
    id: 'demo-8',
    author: { name: 'Ryan Cho', avatar: 'https://i.pravatar.cc/150?img=68' },
    content: "Spent the morning at the farmers market. Nothing beats fresh produce and good coffee to start the weekend 🌿",
    image: 'https://picsum.photos/seed/mkt5/600/380',
    time: '1 day ago', likes: 96,
    comments: [
      { name: 'Lily Zhang', avatar: 'https://i.pravatar.cc/150?img=29', text: 'Which market? I need this in my life', time: '22h' },
    ]
  },
];

// ── Local posts (stored in localStorage, survive refresh) ────────────

function getLocalPosts() {
  try { return JSON.parse(localStorage.getItem('lmb_local_posts') || '[]'); }
  catch (_) { return []; }
}
function saveLocalPost(post) {
  const posts = getLocalPosts();
  posts.unshift(post);
  localStorage.setItem('lmb_local_posts', JSON.stringify(posts));
}
function deleteLocalPost(id) {
  const posts = getLocalPosts().filter(p => p.id !== id);
  localStorage.setItem('lmb_local_posts', JSON.stringify(posts));
}

// ── Helpers ──────────────────────────────────────────────────────────

function av(url, name, size = 40) {
  const s = `width:${size}px;height:${size}px;font-size:${Math.round(size * .38)}px`;
  if (url) return `<img src="${url}" alt="${escHtml(name||'')}" style="${s};border-radius:50%;object-fit:cover">`;
  const ini = (name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  return `<div class="av-ph" style="${s}">${ini}</div>`;
}

function timeAgo(d) {
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 60)    return 'Just now';
  if (s < 3600)  return `${Math.floor(s/60)}m`;
  if (s < 86400) return `${Math.floor(s/3600)}h`;
  if (s < 604800)return `${Math.floor(s/86400)}d`;
  return new Date(d).toLocaleDateString('en', {month:'short', day:'numeric'});
}

function escHtml(t) {
  return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function imgViewer(src) {
  let v = document.getElementById('img-overlay');
  if (!v) {
    v = document.createElement('div');
    v.id = 'img-overlay'; v.className = 'img-overlay';
    v.innerHTML = `<button class="img-overlay-close">✕</button><img src="" alt="">`;
    v.addEventListener('click', e => { if (e.target===v) v.classList.remove('active'); });
    v.querySelector('.img-overlay-close').addEventListener('click', ()=>v.classList.remove('active'));
    document.body.appendChild(v);
  }
  v.querySelector('img').src = src;
  v.classList.add('active');
}

// ── Main render ───────────────────────────────────────────────────────

export async function renderFeed(currentUser, currentProfile) {
  const container = document.getElementById('content');
  container.style.alignItems = 'center';
  container.innerHTML = '';

  // Stories bar
  const storiesEl = document.createElement('div');
  storiesEl.className = 'stories-row';
  storiesEl.innerHTML = buildCreateStoryTile(currentProfile);
  container.appendChild(storiesEl);
  loadStoriesTiles(storiesEl, currentUser);

  // Create post card
  const createCard = document.createElement('div');
  createCard.className = 'card';
  createCard.innerHTML = `
    <div class="create-box">
      <div class="create-row">
        ${av(currentProfile?.avatar_url, currentProfile?.full_name)}
        <button class="create-prompt" id="cp-open">What's on your mind, ${escHtml((currentProfile?.full_name||'you').split(' ')[0])}?</button>
      </div>
      <hr class="create-divider">
      <div class="create-actions">
        <button class="create-action" id="cp-photo">🖼️ &nbsp;Photo / Video</button>
        <button class="create-action">😊 &nbsp;Feeling / Activity</button>
        <button class="create-action">📍 &nbsp;Check in</button>
      </div>
    </div>`;
  container.appendChild(createCard);

  const modal = buildCreatePostModal(currentUser, currentProfile, () => renderFeed(currentUser, currentProfile));
  document.body.appendChild(modal);
  createCard.querySelector('#cp-open').addEventListener('click', () => { modal.classList.add('active'); modal.querySelector('.modal-textarea').focus(); });
  createCard.querySelector('#cp-photo').addEventListener('click', () => { modal.classList.add('active'); modal.querySelector('#cp-img-input').click(); });

  // Posts wrapper
  const postsWrap = document.createElement('div');
  postsWrap.style.cssText = 'width:100%;max-width:590px';
  container.appendChild(postsWrap);
  postsWrap.innerHTML = '<div class="spinner"></div>';
  await loadFeedPosts(postsWrap, currentUser, currentProfile);
}

async function loadFeedPosts(wrap, currentUser, currentProfile) {
  wrap.innerHTML = '';

  // 1 — Render LOCAL posts first (posted by user, stored in localStorage)
  const localPosts = getLocalPosts();
  for (const lp of localPosts) {
    wrap.appendChild(buildLocalPostCard(lp, currentUser, currentProfile));
  }

  // 2 — Render REAL Supabase posts
  try {
    const { data: fs } = await supabase.from('friendships')
      .select('requester_id,addressee_id')
      .or(`requester_id.eq.${currentUser.id},addressee_id.eq.${currentUser.id}`)
      .eq('status','accepted');
    const ids = [...(fs||[]).map(f => f.requester_id===currentUser.id ? f.addressee_id : f.requester_id), currentUser.id];

    const { data: posts } = await supabase.from('posts')
      .select('*, profiles:user_id(id,full_name,avatar_url)')
      .in('user_id', ids)
      .order('created_at', { ascending: false })
      .limit(30);

    if (posts?.length) {
      for (const p of posts) wrap.appendChild(await buildPostCard(p, currentUser, currentProfile));
    }
  } catch (_) { /* Supabase not configured — fall through to demo posts */ }

  // 3 — Always show demo posts at the end
  if (wrap.children.length > 0) {
    const sep = document.createElement('div');
    sep.style.cssText = 'width:100%;font-size:13px;font-weight:600;color:var(--text2);text-align:center;padding:12px 0 4px;';
    sep.textContent = '— Suggested posts —';
    wrap.appendChild(sep);
  }
  for (const dp of DEMO_POSTS) wrap.appendChild(buildDemoPostCard(dp, currentProfile));
}

// ── Demo post card (fully local) ─────────────────────────────────────

function buildDemoPostCard(post, currentProfile) {
  const likedKey = `lmb_liked_${post.id}`;
  let liked = localStorage.getItem(likedKey) === '1';
  let likeCount = post.likes + (liked ? 1 : 0);
  const localComments = post.comments.map(c => ({ ...c }));

  const card = document.createElement('div');
  card.className = 'card';

  const render = () => {
    card.innerHTML = `
      <div class="post-head">
        <div class="post-head-av">${av(post.author.avatar, post.author.name, 42)}</div>
        <div class="post-head-info">
          <span class="post-author">${escHtml(post.author.name)}</span>
          <div class="post-time">${post.time} &nbsp;·&nbsp; 🌐</div>
        </div>
      </div>
      ${post.content ? `<p class="post-text${!post.image && post.content.length < 130 ? ' post-text-xl' : ''}">${escHtml(post.content)}</p>` : ''}
      ${post.image ? `<img class="post-img" src="${post.image}" alt="post" loading="lazy">` : ''}
      <div class="post-stats">
        <div class="post-stats-likes">
          ${likeCount > 0 ? `<div class="like-pill" style="background:var(--blue)">👍</div><span>${likeCount}</span>` : ''}
        </div>
        <div class="post-stats-right">
          ${localComments.length ? `<span>${localComments.length} comment${localComments.length !== 1 ? 's' : ''}</span>` : ''}
        </div>
      </div>
      <div class="post-actions">
        <button class="paction like-btn${liked ? ' liked' : ''}">
          <span class="paction-icon">👍</span>${liked ? 'Liked' : 'Like'}
        </button>
        <button class="paction comment-btn">
          <span class="paction-icon">💬</span>Comment
        </button>
        <button class="paction share-btn">
          <span class="paction-icon">↗️</span>Share
        </button>
      </div>
      <div class="comments-section" style="display:none">
        <div class="comments-wrap">
          <div class="comment-input-row">
            ${av(currentProfile?.avatar_url, currentProfile?.full_name, 32)}
            <div class="comment-field-wrap">
              <input class="comment-field" placeholder="Write a comment… Press Enter to post">
              <button class="comment-send">➤</button>
            </div>
          </div>
          <div class="comments-list">
            ${localComments.map(c => `
              <div class="comment-item">
                ${av(c.avatar, c.name, 32)}
                <div>
                  <div class="comment-bubble">
                    <div class="comment-name">${escHtml(c.name)}</div>
                    <div class="comment-body">${escHtml(c.text)}</div>
                  </div>
                  <div class="comment-time">${c.time || 'Just now'}</div>
                </div>
              </div>`).join('')}
          </div>
        </div>
      </div>`;

    // Like
    card.querySelector('.like-btn').addEventListener('click', () => {
      liked = !liked;
      likeCount += liked ? 1 : -1;
      localStorage.setItem(likedKey, liked ? '1' : '0');
      const btn = card.querySelector('.like-btn');
      btn.classList.toggle('liked', liked);
      btn.innerHTML = `<span class="paction-icon">👍</span>${liked ? 'Liked' : 'Like'}`;
      btn.classList.add('like-pop'); setTimeout(() => btn.classList.remove('like-pop'), 200);
      const sl = card.querySelector('.post-stats-likes');
      sl.innerHTML = likeCount > 0 ? `<div class="like-pill" style="background:var(--blue)">👍</div><span>${likeCount}</span>` : '';
    });

    // Comment toggle
    card.querySelector('.comment-btn').addEventListener('click', () => {
      const sec = card.querySelector('.comments-section');
      const open = sec.style.display !== 'none';
      sec.style.display = open ? 'none' : 'block';
      if (!open) card.querySelector('.comment-field').focus();
    });

    // Send comment
    const sendDemoComment = () => {
      const field = card.querySelector('.comment-field');
      const text = field.value.trim(); if (!text) return;
      field.value = '';
      localComments.push({ name: currentProfile?.full_name || 'You', avatar: currentProfile?.avatar_url, text, time: 'Just now' });
      render();
      card.querySelector('.comments-section').style.display = 'block';
      card.querySelector('.comment-field').focus();
    };
    card.querySelector('.comment-field').addEventListener('keydown', e => { if (e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); sendDemoComment(); }});
    card.querySelector('.comment-send').addEventListener('click', sendDemoComment);

    // Image viewer
    card.querySelector('.post-img')?.addEventListener('click', () => imgViewer(post.image));

    // Share
    card.querySelector('.share-btn').addEventListener('click', () => openShareModal(
      { id: post.id, content: post.content, image_url: post.image, profiles: { full_name: post.author.name, avatar_url: post.author.avatar }, created_at: new Date().toISOString() },
      null, currentProfile
    ));
  };

  render();
  return card;
}

// ── Local post card (user-created, stored in localStorage) ───────────

function buildLocalPostCard(post, currentUser, currentProfile) {
  const likedKey = `lmb_liked_local_${post.id}`;
  let liked = localStorage.getItem(likedKey) === '1';
  let likeCount = (post.likes || 0) + (liked ? 1 : 0);
  const localComments = [...(post.comments || [])];

  const card = document.createElement('div');
  card.className = 'card';

  const render = () => {
    card.innerHTML = `
      <div class="post-head">
        <div class="post-head-av">${av(post.avatar_url, post.author_name, 42)}</div>
        <div class="post-head-info">
          <span class="post-author">${escHtml(post.author_name || 'You')}</span>
          <div class="post-time">${timeAgo(post.created_at)} &nbsp;·&nbsp; 🌐</div>
        </div>
        <button class="post-menu" title="Options">···</button>
      </div>
      ${post.content ? `<p class="post-text${!post.image_url && post.content.length < 130 ? ' post-text-xl' : ''}">${escHtml(post.content)}</p>` : ''}
      ${post.image_url ? `<img class="post-img" src="${post.image_url}" alt="post" loading="lazy">` : ''}
      <div class="post-stats">
        <div class="post-stats-likes">
          ${likeCount > 0 ? `<div class="like-pill" style="background:var(--blue)">👍</div><span>${likeCount}</span>` : ''}
        </div>
        <div class="post-stats-right">
          ${localComments.length ? `<span>${localComments.length} comment${localComments.length !== 1 ? 's' : ''}</span>` : ''}
        </div>
      </div>
      <div class="post-actions">
        <button class="paction like-btn${liked ? ' liked' : ''}">
          <span class="paction-icon">👍</span>${liked ? 'Liked' : 'Like'}
        </button>
        <button class="paction comment-btn">
          <span class="paction-icon">💬</span>Comment
        </button>
        <button class="paction share-btn">
          <span class="paction-icon">↗️</span>Share
        </button>
      </div>
      <div class="comments-section" style="display:none">
        <div class="comments-wrap">
          <div class="comment-input-row">
            ${av(currentProfile?.avatar_url, currentProfile?.full_name, 32)}
            <div class="comment-field-wrap">
              <input class="comment-field" placeholder="Write a comment…">
              <button class="comment-send">➤</button>
            </div>
          </div>
          <div class="comments-list">
            ${localComments.map(c => `
              <div class="comment-item">
                ${av(c.avatar, c.name, 32)}
                <div>
                  <div class="comment-bubble">
                    <div class="comment-name">${escHtml(c.name)}</div>
                    <div class="comment-body">${escHtml(c.text)}</div>
                  </div>
                  <div class="comment-time">${c.time || 'Just now'}</div>
                </div>
              </div>`).join('')}
          </div>
        </div>
      </div>`;

    // Like
    card.querySelector('.like-btn').addEventListener('click', () => {
      liked = !liked;
      likeCount += liked ? 1 : -1;
      localStorage.setItem(likedKey, liked ? '1' : '0');
      const btn = card.querySelector('.like-btn');
      btn.classList.toggle('liked', liked);
      btn.innerHTML = `<span class="paction-icon">👍</span>${liked ? 'Liked' : 'Like'}`;
      btn.classList.add('like-pop'); setTimeout(() => btn.classList.remove('like-pop'), 200);
      const sl = card.querySelector('.post-stats-likes');
      sl.innerHTML = likeCount > 0 ? `<div class="like-pill" style="background:var(--blue)">👍</div><span>${likeCount}</span>` : '';
    });

    // Comment toggle
    card.querySelector('.comment-btn').addEventListener('click', () => {
      const sec = card.querySelector('.comments-section');
      const open = sec.style.display !== 'none';
      sec.style.display = open ? 'none' : 'block';
      if (!open) card.querySelector('.comment-field').focus();
    });

    // Send comment
    const sendComment = () => {
      const field = card.querySelector('.comment-field');
      const text = field.value.trim(); if (!text) return;
      field.value = '';
      localComments.push({ name: currentProfile?.full_name || 'You', avatar: currentProfile?.avatar_url, text, time: 'Just now' });
      render();
      card.querySelector('.comments-section').style.display = 'block';
      card.querySelector('.comment-field').focus();
    };
    card.querySelector('.comment-field').addEventListener('keydown', e => { if (e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); sendComment(); }});
    card.querySelector('.comment-send').addEventListener('click', sendComment);

    // Image viewer
    card.querySelector('.post-img')?.addEventListener('click', () => imgViewer(post.image_url));

    // Share
    card.querySelector('.share-btn').addEventListener('click', () => openShareModal(
      { id: post.id, content: post.content, image_url: post.image_url, profiles: { full_name: post.author_name, avatar_url: post.avatar_url }, created_at: post.created_at },
      currentUser, currentProfile
    ));

    // Delete menu
    card.querySelector('.post-menu').addEventListener('click', e => {
      e.stopPropagation();
      let menu = document.getElementById('post-ctx-menu');
      if (menu) menu.remove();
      menu = document.createElement('div');
      menu.id = 'post-ctx-menu';
      menu.className = 'dropdown open';
      const r = e.currentTarget.getBoundingClientRect();
      menu.style.cssText = `position:fixed;top:${r.bottom+4}px;right:${window.innerWidth-r.right}px`;
      menu.innerHTML = `<div class="dropdown-item" style="color:#fc8181" id="dmi-delete">🗑️ &nbsp;Delete post</div>`;
      document.body.appendChild(menu);
      menu.querySelector('#dmi-delete').addEventListener('click', () => {
        menu.remove();
        deleteLocalPost(post.id);
        card.style.transition = 'opacity .2s'; card.style.opacity = '0';
        setTimeout(() => card.remove(), 200);
      });
      setTimeout(() => { document.addEventListener('click', () => menu?.remove(), {once:true}); }, 0);
    });
  };

  render();
  return card;
}

// ── Supabase post card ───────────────────────────────────────────────

export async function buildPostCard(post, currentUser, currentProfile) {
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.postId = post.id;

  const [{ count: likeCount }, { count: commentCount }, { data: myLike }] = await Promise.all([
    supabase.from('likes').select('*',{count:'exact',head:true}).eq('post_id', post.id),
    supabase.from('comments').select('*',{count:'exact',head:true}).eq('post_id', post.id),
    supabase.from('likes').select('id').eq('post_id', post.id).eq('user_id', currentUser.id).maybeSingle()
  ]);

  const liked   = !!myLike;
  const author  = post.profiles || {};
  const isOwn   = post.user_id === currentUser.id;
  const bigText = !post.image_url && (post.content||'').length < 130;

  card.innerHTML = `
    <div class="post-head">
      <div class="post-head-av" onclick="window.location.hash='#profile/${author.id}'">${av(author.avatar_url, author.full_name, 42)}</div>
      <div class="post-head-info">
        <span class="post-author" onclick="window.location.hash='#profile/${author.id}'">${escHtml(author.full_name||'User')}</span>
        <div class="post-time">${timeAgo(post.created_at)} &nbsp;·&nbsp; 🌐</div>
      </div>
      ${isOwn ? `<button class="post-menu" title="Options">···</button>` : ''}
    </div>
    ${post.content ? `<p class="post-text${bigText?' post-text-xl':''}">${escHtml(post.content)}</p>` : ''}
    ${post.image_url ? `<img class="post-img" src="${post.image_url}" alt="post image" loading="lazy">` : ''}
    <div class="post-stats">
      <div class="post-stats-likes" data-likes="${likeCount||0}">
        ${likeCount ? `<div class="like-pill" style="background:var(--blue)">👍</div><span>${likeCount}</span>` : ''}
      </div>
      <div class="post-stats-right">
        ${commentCount ? `<span class="comment-count-label">${commentCount} comment${commentCount!==1?'s':''}</span>` : ''}
        <span style="color:var(--text2)">Share</span>
      </div>
    </div>
    <div class="post-actions">
      <button class="paction like-btn${liked?' liked':''}">
        <span class="paction-icon">👍</span>${liked?'Liked':'Like'}
      </button>
      <button class="paction comment-btn">
        <span class="paction-icon">💬</span>Comment
      </button>
      <button class="paction share-btn">
        <span class="paction-icon">↗️</span>Share
      </button>
    </div>
    <div class="comments-section" style="display:none">
      <div class="comments-wrap">
        <div class="comment-input-row">
          ${av(currentProfile?.avatar_url, currentProfile?.full_name, 32)}
          <div class="comment-field-wrap">
            <input class="comment-field" placeholder="Write a comment… Press Enter to post">
            <button class="comment-send">➤</button>
          </div>
        </div>
        <div class="comments-list"></div>
      </div>
    </div>`;

  // Like
  const likeBtn = card.querySelector('.like-btn');
  likeBtn.addEventListener('click', async () => {
    const isLiked = likeBtn.classList.contains('liked');
    likeBtn.classList.toggle('liked', !isLiked);
    likeBtn.innerHTML = `<span class="paction-icon">👍</span>${!isLiked ? 'Liked' : 'Like'}`;
    likeBtn.classList.add('like-pop'); setTimeout(() => likeBtn.classList.remove('like-pop'), 200);
    const statsLikes = card.querySelector('.post-stats-likes');
    let n = parseInt(statsLikes.dataset.likes||'0') + (isLiked ? -1 : 1);
    if (n < 0) n = 0;
    statsLikes.dataset.likes = n;
    statsLikes.innerHTML = n > 0 ? `<div class="like-pill" style="background:var(--blue)">👍</div><span>${n}</span>` : '';
    try {
      if (isLiked) {
        await supabase.from('likes').delete().eq('post_id', post.id).eq('user_id', currentUser.id);
      } else {
        await supabase.from('likes').insert({ post_id: post.id, user_id: currentUser.id });
        if (post.user_id !== currentUser.id) {
          await supabase.from('notifications').insert({ user_id: post.user_id, actor_id: currentUser.id, type: 'like', reference_id: post.id });
        }
      }
    } catch (_) {}
  });

  // Comment toggle
  card.querySelector('.comment-btn').addEventListener('click', () => {
    const section = card.querySelector('.comments-section');
    const open = section.style.display !== 'none';
    section.style.display = open ? 'none' : 'block';
    if (!open) {
      loadComments(card.querySelector('.comments-list'), post.id, currentUser, currentProfile);
      card.querySelector('.comment-field').focus();
    }
  });
  card.querySelector('.comment-count-label')?.addEventListener('click', () => card.querySelector('.comment-btn').click());

  // Send comment
  const sendComment = async () => {
    const field = card.querySelector('.comment-field');
    const text = field.value.trim(); if (!text) return;
    field.value = '';
    const list = card.querySelector('.comments-list');
    const tempEl = buildCommentEl({ profiles: currentProfile, content: text, created_at: new Date().toISOString() });
    list.appendChild(tempEl);
    list.scrollIntoView({ behavior:'smooth', block:'nearest' });
    const cl = card.querySelector('.comment-count-label');
    if (cl) { const c = parseInt(cl.textContent)||0; cl.textContent = `${c+1} comment${c+1!==1?'s':''}`; }
    try {
      const { data: saved } = await supabase.from('comments')
        .insert({ post_id: post.id, user_id: currentUser.id, content: text })
        .select('*, profiles:user_id(full_name,avatar_url)').single();
      if (saved) tempEl.replaceWith(buildCommentEl(saved));
      if (post.user_id !== currentUser.id) {
        await supabase.from('notifications').insert({ user_id: post.user_id, actor_id: currentUser.id, type: 'comment', reference_id: post.id });
      }
    } catch (_) {}
  };
  card.querySelector('.comment-field').addEventListener('keydown', e => { if (e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); sendComment(); }});
  card.querySelector('.comment-send').addEventListener('click', sendComment);

  // Share
  card.querySelector('.share-btn').addEventListener('click', () => openShareModal(post, currentUser, currentProfile));

  // Image click
  card.querySelector('.post-img')?.addEventListener('click', () => imgViewer(post.image_url));

  // Delete / Edit (own posts)
  if (isOwn) {
    card.querySelector('.post-menu').addEventListener('click', e => {
      e.stopPropagation();
      let menu = document.getElementById('post-ctx-menu');
      if (menu) menu.remove();
      menu = document.createElement('div');
      menu.id = 'post-ctx-menu';
      menu.className = 'dropdown open';
      const r = e.currentTarget.getBoundingClientRect();
      menu.style.cssText = `position:fixed;top:${r.bottom+4}px;right:${window.innerWidth-r.right}px`;
      menu.innerHTML = `
        <div class="dropdown-item" id="dmi-edit">✏️ &nbsp;Edit post</div>
        <div class="dropdown-item" style="color:#fc8181" id="dmi-delete">🗑️ &nbsp;Delete post</div>`;
      document.body.appendChild(menu);
      menu.querySelector('#dmi-delete').addEventListener('click', async () => {
        if (!confirm('Delete this post?')) return;
        menu.remove();
        if (post.image_url?.includes('supabase')) {
          try { const path = post.image_url.split('/posts/')[1]; await supabase.storage.from('posts').remove([path]); } catch(_){}
        }
        await supabase.from('posts').delete().eq('id', post.id);
        card.style.transition = 'opacity .2s'; card.style.opacity = '0';
        setTimeout(() => card.remove(), 200);
      });
      menu.querySelector('#dmi-edit').addEventListener('click', () => { menu.remove(); openEditPostModal(post, currentUser, card); });
      setTimeout(() => { document.addEventListener('click', () => menu?.remove(), {once:true}); }, 0);
    });
  }

  return card;
}

// ── Comments ─────────────────────────────────────────────────────────

async function loadComments(list, postId) {
  list.innerHTML = '<div class="spinner" style="width:24px;height:24px;margin:8px auto"></div>';
  try {
    const { data: comments } = await supabase.from('comments')
      .select('*, profiles:user_id(full_name,avatar_url)')
      .eq('post_id', postId).order('created_at',{ascending:true}).limit(20);
    list.innerHTML = '';
    (comments||[]).forEach(c => list.appendChild(buildCommentEl(c)));
  } catch(_) { list.innerHTML = ''; }
}

function buildCommentEl(c) {
  const el = document.createElement('div');
  el.className = 'comment-item';
  el.innerHTML = `
    ${av(c.profiles?.avatar_url, c.profiles?.full_name, 32)}
    <div>
      <div class="comment-bubble">
        <div class="comment-name">${escHtml(c.profiles?.full_name||'User')}</div>
        <div class="comment-body">${escHtml(c.content||'')}</div>
      </div>
      <div class="comment-time">${timeAgo(c.created_at)}</div>
    </div>`;
  return el;
}

// ── Share modal ──────────────────────────────────────────────────────

function openShareModal(post, currentUser, currentProfile) {
  let modal = document.getElementById('share-modal');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'share-modal';
  modal.className = 'modal-bg active';
  modal.innerHTML = `
    <div class="modal-box" style="max-width:420px">
      <div class="modal-head">
        <h2>Share post</h2>
        <button class="modal-x">✕</button>
      </div>
      <div class="modal-body" style="padding:12px 16px">
        <div class="share-option" id="so-feed">
          <div class="share-option-icon">📰</div>
          <div class="share-option-info">
            <h4>Share to your feed</h4>
            <p>Your friends will see this on your timeline</p>
          </div>
        </div>
        <div class="share-option" id="so-copy">
          <div class="share-option-icon">🔗</div>
          <div class="share-option-info">
            <h4>Copy link</h4>
            <p>Anyone with the link can view</p>
          </div>
        </div>
        <div class="share-option" id="so-msg">
          <div class="share-option-icon">💬</div>
          <div class="share-option-info">
            <h4>Send in Messenger</h4>
            <p>Share privately with a friend</p>
          </div>
        </div>
        <div id="share-feedback" style="display:none;margin-top:8px" class="ok-msg"></div>
        <div style="margin-top:12px;border:1px solid var(--border);border-radius:10px;overflow:hidden">
          <div style="display:flex;align-items:center;gap:8px;padding:10px 12px">
            ${av(post.profiles?.avatar_url, post.profiles?.full_name, 32)}
            <div>
              <div style="font-weight:700;font-size:14px">${escHtml(post.profiles?.full_name||'User')}</div>
              <div style="font-size:12px;color:var(--text2)">${timeAgo(post.created_at)}</div>
            </div>
          </div>
          ${post.content ? `<div style="padding:0 12px 10px;font-size:14px;color:var(--text)">${escHtml(post.content.slice(0,140))}${post.content.length>140?'…':''}</div>` : ''}
          ${post.image_url ? `<img src="${post.image_url}" style="width:100%;max-height:200px;object-fit:cover">` : ''}
        </div>
      </div>
    </div>`;

  modal.querySelector('.modal-x').addEventListener('click', ()=>modal.remove());
  modal.addEventListener('click', e=>{ if(e.target===modal) modal.remove(); });

  const feedback = modal.querySelector('#share-feedback');
  function showFeedback(msg) { feedback.textContent = msg; feedback.style.display='block'; setTimeout(()=>modal.remove(), 1400); }

  modal.querySelector('#so-feed').addEventListener('click', async () => {
    const quote = post.content ? `"${post.content.slice(0,100)}${post.content.length>100?'…':''}"` : '(image)';
    const newContent = `Shared a post: ${quote}`;
    try {
      await supabase.from('posts').insert({ user_id: currentUser.id, content: newContent, image_url: post.image_url||null });
      showFeedback('✓ Shared to your feed!');
    } catch(_) { showFeedback('✓ Shared! (demo mode)'); }
  });

  modal.querySelector('#so-copy').addEventListener('click', () => {
    navigator.clipboard.writeText(window.location.origin + window.location.pathname + '#feed')
      .then(() => showFeedback('✓ Link copied to clipboard!'))
      .catch(()=>showFeedback('✓ Link copied!'));
  });

  modal.querySelector('#so-msg').addEventListener('click', () => {
    modal.remove();
    if (post.profiles?.id) window.location.hash = '#messages/' + post.profiles.id;
    else window.location.hash = '#messages';
  });

  document.body.appendChild(modal);
}

// ── Edit post modal ──────────────────────────────────────────────────

function openEditPostModal(post, currentUser, card) {
  let modal = document.getElementById('edit-post-modal');
  if (modal) modal.remove();
  modal = document.createElement('div');
  modal.id = 'edit-post-modal';
  modal.className = 'modal-bg active';
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-head"><h2>Edit post</h2><button class="modal-x">✕</button></div>
      <div class="modal-body">
        <div id="ep-err" style="display:none" class="err-msg"></div>
        <textarea class="modal-textarea" style="min-height:100px">${escHtml(post.content||'')}</textarea>
        ${post.image_url ? `<img src="${post.image_url}" style="width:100%;border-radius:10px;margin-top:8px">` : ''}
      </div>
      <div class="modal-foot">
        <button class="btn-secondary" id="ep-cancel">Cancel</button>
        <button class="btn-primary" id="ep-save">Save</button>
      </div>
    </div>`;
  modal.querySelector('.modal-x').addEventListener('click',()=>modal.remove());
  modal.querySelector('#ep-cancel').addEventListener('click',()=>modal.remove());
  modal.addEventListener('click', e=>{if(e.target===modal)modal.remove();});
  modal.querySelector('#ep-save').addEventListener('click', async ()=>{
    const content = modal.querySelector('.modal-textarea').value.trim();
    const errEl = modal.querySelector('#ep-err');
    if (!content && !post.image_url) { errEl.textContent='Post cannot be empty.'; errEl.style.display='block'; return; }
    try {
      await supabase.from('posts').update({ content }).eq('id', post.id);
      const textEl = card.querySelector('.post-text');
      if (textEl) textEl.textContent = content;
      modal.remove();
    } catch(e) { errEl.textContent=e.message; errEl.style.display='block'; }
  });
  document.body.appendChild(modal);
}

// ── Create post modal ────────────────────────────────────────────────

function buildCreatePostModal(currentUser, currentProfile, onPost) {
  const existing = document.getElementById('create-post-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'create-post-modal';
  modal.className = 'modal-bg';
  modal.innerHTML = `
    <div class="modal-box">
      <div class="modal-head">
        <h2>Create post</h2>
        <button class="modal-x">✕</button>
      </div>
      <div class="modal-body" style="padding-bottom:0">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">
          ${av(currentProfile?.avatar_url, currentProfile?.full_name, 42)}
          <div>
            <div style="font-weight:700;font-size:15px;color:var(--text)">${escHtml(currentProfile?.full_name||'')}</div>
            <div style="font-size:13px;background:var(--hover);border:1px solid var(--border);border-radius:6px;padding:2px 8px;display:inline-flex;align-items:center;gap:4px;margin-top:3px;color:var(--text2)">🌐 Public</div>
          </div>
        </div>
        <textarea class="modal-textarea" id="cp-textarea" placeholder="What's on your mind, ${escHtml((currentProfile?.full_name||'you').split(' ')[0])}?"></textarea>
        <img id="cp-preview" class="modal-img-preview" src="" alt="">
        <div id="cp-err" style="color:#fc8181;font-size:13px;margin-top:6px;display:none"></div>
      </div>
      <div style="padding:10px 20px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
        <div style="display:flex;align-items:center;gap:6px;font-weight:600;font-size:14px;color:var(--text2)">
          Add to your post:
          <label style="cursor:pointer;padding:6px 8px;border-radius:8px;font-size:20px;transition:background .12s" title="Photo/Video">
            🖼️
            <input type="file" id="cp-img-input" accept="image/*,video/*" style="display:none">
          </label>
          <button style="background:none;border:none;font-size:20px;cursor:pointer;padding:6px 8px;border-radius:8px;font-family:inherit;color:var(--text)" title="Emoji">😊</button>
        </div>
        <button class="btn-primary" id="cp-submit" style="min-width:90px;justify-content:center">Post</button>
      </div>
    </div>`;

  const close = () => {
    modal.classList.remove('active');
    modal.querySelector('#cp-textarea').value='';
    modal.querySelector('#cp-img-input').value='';
    modal.querySelector('#cp-preview').style.display='none';
    modal.querySelector('#cp-err').style.display='none';
  };
  modal.querySelector('.modal-x').addEventListener('click', close);
  modal.addEventListener('click', e=>{ if(e.target===modal) close(); });

  const imgInput = modal.querySelector('#cp-img-input');
  const preview  = modal.querySelector('#cp-preview');
  imgInput.addEventListener('change', () => {
    if (!imgInput.files[0]) return;
    preview.src = URL.createObjectURL(imgInput.files[0]);
    preview.style.display = 'block';
  });

  modal.querySelector('#cp-submit').addEventListener('click', async () => {
    const content = modal.querySelector('#cp-textarea').value.trim();
    const file    = imgInput.files[0];
    const errEl   = modal.querySelector('#cp-err');
    const submitBtn = modal.querySelector('#cp-submit');
    errEl.style.display = 'none';
    if (!content && !file) { errEl.textContent='Write something or add a photo.'; errEl.style.display='block'; return; }

    submitBtn.textContent = 'Posting…';
    submitBtn.disabled = true;

    let image_url = null;

    // Try uploading image to Supabase storage
    if (file) {
      try {
        const path = `${currentUser.id}/${Date.now()}-${file.name.replace(/\s/g,'-')}`;
        const { error: upErr } = await supabase.storage.from('posts').upload(path, file);
        if (upErr) throw upErr;
        const { data } = supabase.storage.from('posts').getPublicUrl(path);
        image_url = data.publicUrl;
      } catch (_) {
        // Fallback: use local blob URL (won't persist across sessions, but post still works)
        image_url = URL.createObjectURL(file);
      }
    }

    // Try saving to Supabase
    let savedToDb = false;
    try {
      const { error } = await supabase.from('posts').insert({ user_id: currentUser.id, content, image_url: image_url && !image_url.startsWith('blob:') ? image_url : null });
      if (!error) savedToDb = true;
    } catch (_) {}

    // Always save locally too (so it shows immediately at the top)
    if (!savedToDb) {
      saveLocalPost({
        id: 'local-' + Date.now(),
        content,
        image_url,
        author_name: currentProfile?.full_name || 'You',
        avatar_url: currentProfile?.avatar_url || null,
        created_at: new Date().toISOString(),
        likes: 0,
        comments: []
      });
    }

    submitBtn.textContent = 'Post';
    submitBtn.disabled = false;
    close();
    onPost();
  });

  return modal;
}

// ── Stories tiles ────────────────────────────────────────────────────

function buildCreateStoryTile(profile) {
  const bg = profile?.avatar_url ? `background-image:url('${profile.avatar_url}')` : '';
  return `
    <div class="story-tile story-create" style="cursor:pointer" onclick="window.location.hash='#stories'">
      <div class="story-create-bg" style="${bg}"></div>
      <div class="story-plus">+</div>
      <div class="story-create-label">Create<br>Story</div>
    </div>`;
}

async function loadStoriesTiles(container, currentUser) {
  try {
    const now = new Date().toISOString();
    const { data: stories } = await supabase.from('stories')
      .select('*, profiles:user_id(full_name,avatar_url)')
      .gt('expires_at', now).order('created_at',{ascending:false}).limit(8);
    (stories||[]).forEach(s => {
      const tile = document.createElement('div');
      tile.className = 'story-tile';
      if (s.image_url) tile.innerHTML = `<img src="${s.image_url}" alt="story">`;
      else tile.style.background = 'linear-gradient(135deg, var(--blue), #7b2fff)';
      tile.innerHTML += `
        ${s.profiles?.avatar_url ? `<img class="story-tile-avatar" src="${s.profiles.avatar_url}" alt="">` : ''}
        <div class="story-tile-name">${escHtml(s.profiles?.full_name||'')}</div>`;
      tile.addEventListener('click', () => {
        import('./stories.js').then(m => m.openStoryViewer([s], 0));
      });
      container.appendChild(tile);
    });
  } catch(_) {}
}
