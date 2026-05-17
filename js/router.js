import { renderFeed } from './feed.js';
import { renderProfile } from './profile.js';
import { renderFriends } from './friends.js';
import { renderMessages } from './messages.js';
import { renderNotifications } from './notifications.js';
import { renderStories } from './stories.js';
import { renderGroups } from './groups.js';

let currentUser = null;
let currentProfile = null;
let activeChannel = null;

export function setCurrentUser(user, profile) {
  currentUser = user;
  currentProfile = profile;
}

export function getCurrentUser() { return currentUser; }
export function getCurrentProfile() { return currentProfile; }

export function setActiveChannel(ch) {
  if (activeChannel) activeChannel.unsubscribe();
  activeChannel = ch;
}

const content = () => document.getElementById('content');

export function navigate(hash) {
  window.location.hash = hash;
}

export function initRouter() {
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
}

function handleRoute() {
  const hash = window.location.hash || '#feed';
  const [base, ...params] = hash.slice(1).split('/');

  // Update active nav tab
  document.querySelectorAll('.nav-tab').forEach(el => {
    el.classList.toggle('active', el.dataset.route === base);
  });
  document.querySelectorAll('.sidebar-link[data-route]').forEach(el => {
    el.classList.toggle('active', el.dataset.route === base);
  });

  content().innerHTML = '<div class="spinner"></div>';

  switch (base) {
    case 'feed':       renderFeed(currentUser, currentProfile); break;
    case 'profile':    renderProfile(params[0] || currentUser.id, currentUser, currentProfile); break;
    case 'friends':    renderFriends(currentUser, currentProfile); break;
    case 'messages':   renderMessages(currentUser, currentProfile, params[0]); break;
    case 'notifications': renderNotifications(currentUser, currentProfile); break;
    case 'stories':    renderStories(currentUser, currentProfile); break;
    case 'groups':     renderGroups(currentUser, currentProfile, params[0]); break;
    default:           renderFeed(currentUser, currentProfile);
  }
}
