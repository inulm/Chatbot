const EMJS = ['😀','😂','❤️','😍','🔥','👍','😭','🙏','😊','💯','🎉','😎','🤔','😴','🥰','😅','💪','🤩','😤','🫡','😆','🥹','🫶','✨','🎊','👋','😌','😋','🤗'];
const REACT_EMJS = ['❤️','😂','😮','😢','👍','🔥'];
const COLORS = ['#7c6fff','#f472b6','#34d399','#fb923c','#60a5fa','#a78bfa','#f87171','#facc15'];

let ME = null, CHAT_WITH = null, CHAT_ID = null, replyTo = null, editingId = null;
let allUsers = {}, unsubMessages = null, unsubTyping = null, unsubUsers = null, unsubChatMeta = null, unsubUnread = null, typTimer = null;
let allChatMeta = {}, allUnread = {};

// FIX: in-chat search state
let searchMatches = [], searchIdx = 0;

function getInitial(name) { return (name || '?')[0].toUpperCase(); }
function getChatId(a, b) { return [a, b].sort().join('__'); }
function hashColor(uid) {
  let h = 0; for (let c of uid) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return COLORS[Math.abs(h) % COLORS.length];
}
function fmtTime(ts) { if (!ts) return ''; return new Date(ts).toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12:true }); }
function fmtDate(ts) { if (!ts) return 'আজ'; return new Date(ts).toLocaleDateString('bn-BD', { day:'numeric', month:'long' }); }

// Firebase Auth handles password security — no manual hashing needed

function toast(m) {
  const t = document.getElementById('toast'); t.textContent = m; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}
function showErr(msg) {
  const e = document.getElementById('authErr'); e.textContent = msg; e.classList.add('show');
  setTimeout(() => e.classList.remove('show'), 3500);
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach((b,i) => b.classList.toggle('active', (i===0) === (tab==='login')));
  document.getElementById('loginForm').style.display = tab === 'login' ? '' : 'none';
  document.getElementById('registerForm').style.display = tab === 'register' ? '' : 'none';
}
window.switchTab = switchTab;

function setAuthBusy(busy) {
  // FIX: disable both auth buttons during async ops to prevent duplicate submits
  document.getElementById('loginBtn').disabled = busy;
  document.getElementById('registerBtn').disabled = busy;
  document.getElementById('loginBtn').textContent = busy ? 'অপেক্ষা করো…' : 'লগইন করো →';
  document.getElementById('registerBtn').textContent = busy ? 'অপেক্ষা করো…' : 'অ্যাকাউন্ট খোলো →';
}

function whenReady(fn) { if (window.FB_READY) fn(); else window.addEventListener('fb-ready', fn, { once: true }); }

async function doRegister() {
  const username    = document.getElementById('regUser').value.trim().toLowerCase();
  const displayName = document.getElementById('regDisplay').value.trim();
  const email       = document.getElementById('regEmail').value.trim();
  const password    = document.getElementById('regPass').value;

  if (!/^[a-z0-9_]{3,20}$/.test(username)) return showErr('ইউজারনেম ৩-২০ অক্ষর, শুধু a-z, 0-9, _ ব্যবহার করো');
  if (!displayName)          return showErr('ডিসপ্লে নাম দাও');
  if (!email)                return showErr('ইমেইল দাও');
  if (password.length < 6)  return showErr('পাসওয়ার্ড কমপক্ষে ৬ অক্ষর হতে হবে');

  setAuthBusy(true);
  try {
    // ইউজারনেম ইতিমধ্যে নেওয়া কিনা চেক করো
    const uSnap = await FB.get(FB.r('usernames/' + username));
    if (uSnap.exists()) { showErr('ইউজারনেমটি ইতিমধ্যে ব্যবহৃত!'); setAuthBusy(false); return; }

    // Firebase Auth দিয়ে অ্যাকাউন্ট তৈরি করো
    const cred  = await FB.createUserWithEmailAndPassword(email, password);
    const uid   = cred.user.uid;
    const color = hashColor(uid);

    // Realtime DB-তে profile সেভ করো
    const userData = { username, displayName, email, color, createdAt: Date.now(), online: false };
    await FB.set(FB.r('users/' + uid), userData);
    // username → uid mapping (uniqueness enforce করতে)
    await FB.set(FB.r('usernames/' + username), uid);

    ME = { uid, username, displayName, color };
    setAuthBusy(false);
    goHome();
  } catch(e) {
    const msgs = {
      'auth/email-already-in-use': 'এই ইমেইল দিয়ে আগেই অ্যাকাউন্ট আছে!',
      'auth/invalid-email':        'ইমেইল ঠিকমতো লিখো',
      'auth/weak-password':        'পাসওয়ার্ড কমপক্ষে ৬ অক্ষর হতে হবে',
    };
    showErr(msgs[e.code] || ('Error: ' + (e.code || e.message || 'unknown')));
    setAuthBusy(false);
  }
}
window.doRegister = doRegister;

async function doLogin() {
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPass').value;
  if (!email || !password) return showErr('সব তথ্য দাও');

  setAuthBusy(true);
  try {
    // Firebase Auth দিয়ে লগইন করো
    const cred = await FB.signInWithEmailAndPassword(email, password);
    const uid  = cred.user.uid;

    // DB থেকে profile আনো
    const snap = await FB.get(FB.r('users/' + uid));
    if (!snap.exists()) { showErr('প্রোফাইল পাওয়া যায়নি'); setAuthBusy(false); return; }
    const data = snap.val();

    ME = { uid, username: data.username, displayName: data.displayName, color: data.color };
    setAuthBusy(false);
    goHome();
  } catch(e) {
    const msgs = {
      'auth/user-not-found':      'ইমেইল পাওয়া যায়নি',
      'auth/wrong-password':      'পাসওয়ার্ড ভুল!',
      'auth/invalid-email':       'ইমেইল ঠিকমতো লিখো',
      'auth/invalid-credential':  'ইমেইল বা পাসওয়ার্ড ভুল!',
      'auth/too-many-requests':   'অনেকবার চেষ্টা হয়েছে, কিছুক্ষণ পরে আবার চেষ্টা করো',
    };
    showErr(msgs[e.code] || 'কিছু একটা ভুল হয়েছে, আবার চেষ্টা করো');
    setAuthBusy(false);
  }
}
window.doLogin = doLogin;

async function doLogout() {
  if (!confirm('লগআউট করবে?')) return;
  if (ME) FB.set(FB.r('users/' + ME.uid + '/online'), false);
  // সব listeners বন্ধ করো
  if (unsubUsers)    { unsubUsers();    unsubUsers    = null; }
  if (unsubChatMeta) { unsubChatMeta(); unsubChatMeta = null; }
  if (unsubUnread)   { unsubUnread();   unsubUnread   = null; }
  if (unsubMessages) { unsubMessages(); unsubMessages = null; }
  if (unsubTyping)   { unsubTyping();   unsubTyping   = null; }
  ME = null; CHAT_WITH = null; CHAT_ID = null;
  await FB.signOut();          // Firebase Auth sign out
  showScreen('authScreen');
}
window.doLogout = doLogout;

function goHome() {
  if (!ME) return;
  FB.set(FB.r('users/' + ME.uid + '/online'), true);
  FB.onDisconnect(FB.r('users/' + ME.uid + '/online')).set(false);

  const av = document.getElementById('myAvatar');
  av.textContent = getInitial(ME.displayName);
  av.style.background = `linear-gradient(135deg, ${ME.color}, ${ME.color}aa)`;
  document.getElementById('myDisplayName').textContent = '@' + ME.username;

  showScreen('homeScreen');
  loadUsers();
}
window.goHome = goHome;

function loadUsers() {
  // FIX: unsubscribe old listeners before creating new ones (prevents memory leak + duplicate renders)
  if (unsubUsers) unsubUsers();
  if (unsubChatMeta) unsubChatMeta();
  if (unsubUnread) unsubUnread();

  let usersLoaded = false;

  unsubUsers = FB.onValue(FB.r('users'), snap => {
    allUsers = {};
    const data = snap.val() || {};
    Object.entries(data).forEach(([uid, u]) => { if (uid !== ME.uid) allUsers[uid] = u; });
    usersLoaded = true;
    renderUserList(allUsers);
  });

  // FIX: only re-render after users are loaded to avoid empty flash
  unsubChatMeta = FB.onValue(FB.r('chatMeta'), snap => {
    allChatMeta = snap.val() || {};
    if (usersLoaded) renderUserList(allUsers);
  });

  unsubUnread = FB.onValue(FB.r('unread/' + ME.uid), snap => {
    allUnread = snap.val() || {};
    if (usersLoaded) renderUserList(allUsers);
  });
}

function renderUserList(users) {
  const list = document.getElementById('userList');
  const entries = Object.entries(users);

  // FIX: update section label with online count
  const onlineCount = entries.filter(([,u]) => u.online).length;
  document.getElementById('sectionLabel').textContent =
    onlineCount > 0 ? `অনলাইন (${onlineCount})` : 'সবাই';

  if (!entries.length) {
    list.innerHTML = `<div class="empty-users"><div class="ico">👥</div>কোনো ইউজার নেই।</div>`; return;
  }
  list.innerHTML = '';
  entries.forEach(([uid, u]) => {
    const chatId = getChatId(ME.uid, uid);
    const meta = allChatMeta[chatId] || {};
    const unread = allUnread[chatId] || 0;

    // FIX: escape HTML to prevent XSS in user list
    const safeName = escHtml(u.displayName || uid);
    const safePreview = escHtml(meta.lastMessage || ('@' + uid));

    const item = document.createElement('div');
    item.className = 'user-item' + (unread > 0 ? ' unread' : '');
    item.onclick = () => openChat(uid, u);

    item.innerHTML = `
      <div class="ui-ava" style="background:linear-gradient(135deg,${u.color || '#7c6fff'},${u.color || '#7c6fff'}99)">
        ${getInitial(u.displayName)}
        ${u.online ? '<div class="online-ring"></div>' : ''}
      </div>
      <div class="ui-info">
        <div class="ui-name">${safeName}</div>
        <div class="ui-last">${safePreview}</div>
      </div>
      <div class="ui-meta">
        <div class="ui-time">${meta.lastTimestamp ? fmtTime(meta.lastTimestamp) : ''}</div>
        ${unread > 0 ? `<div class="ui-badge">${unread}</div>` : ''}
      </div>
    `;
    list.appendChild(item);
  });
}

// FIX: helper to escape HTML and prevent XSS
function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

function filterUsers(q) {
  if (!q) { renderUserList(allUsers); return; }
  const filtered = {};
  Object.entries(allUsers).forEach(([uid, u]) => {
    if (uid.includes(q.toLowerCase()) || u.displayName.toLowerCase().includes(q.toLowerCase())) filtered[uid] = u;
  });
  renderUserList(filtered);
}
window.filterUsers = filterUsers;

function openChat(uid, userData) {
  CHAT_WITH = { uid, username: uid, displayName: userData.displayName, color: userData.color || hashColor(uid) };
  CHAT_ID = getChatId(ME.uid, uid);

  // Clear unread immediately on open
  FB.remove(FB.r('unread/' + ME.uid + '/' + CHAT_ID));

  const ava = document.getElementById('chatAva');
  ava.style.background = `linear-gradient(135deg, ${CHAT_WITH.color}, ${CHAT_WITH.color}99)`;
  ava.innerHTML = getInitial(CHAT_WITH.displayName) + '<div class="online-dot"></div>';
  document.getElementById('chatName').textContent = CHAT_WITH.displayName;

  showScreen('chatScreen');
  buildEmj();

  // FIX: close search bar when opening a new chat
  document.getElementById('chatSearchBar').classList.remove('open');
  document.getElementById('chatSearchInp').value = '';
  searchMatches = []; searchIdx = 0;

  if (unsubMessages) unsubMessages();
  if (unsubTyping) unsubTyping();

  let first = true;
  let prevMsgIds = new Set();

  // FIX: track seen updates separately to avoid infinite write loop
  const pendingSeen = new Set();

  unsubMessages = FB.onValue(FB.r('chats/' + CHAT_ID + '/messages'), snap => {
    const data = snap.val() || {};
    const currentIds = new Set(Object.keys(data));

    // Only ping for genuinely new messages (not seen updates triggering re-render)
    if (!first) {
      const newIds = [...currentIds].filter(id => !prevMsgIds.has(id));
      if (newIds.length > 0) playPing();
    }
    prevMsgIds = currentIds;

    renderMsgs(data);

    // FIX: only write seen updates for messages not already processed
    Object.entries(data).forEach(([mId, m]) => {
      if (m.sender !== ME.uid && !m.seen && !pendingSeen.has(mId)) {
        pendingSeen.add(mId);
        FB.update(FB.r('chats/' + CHAT_ID + '/messages/' + mId), { seen: true, seenAt: Date.now() });
      }
    });

    if (first) { scBot(); first = false; } else setTimeout(scBot, 50);
  });

  unsubTyping = FB.onValue(FB.r('chats/' + CHAT_ID + '/typing'), snap => {
    const d = snap.val() || {};
    const other = d[CHAT_WITH.uid];
    const ex = document.getElementById('typrow');
    if (other) {
      if (!ex) {
        const row = document.createElement('div'); row.id = 'typrow'; row.className = 'typing-row';
        const av = document.createElement('div'); av.className = 'm-ava';
        av.style.background = `linear-gradient(135deg,${CHAT_WITH.color},${CHAT_WITH.color}99)`;
        av.textContent = getInitial(CHAT_WITH.displayName);
        const b = document.createElement('div'); b.className = 'typing-bub';
        b.innerHTML = '<div class="t-dot"></div><div class="t-dot"></div><div class="t-dot"></div>';
        row.appendChild(av); row.appendChild(b);
        document.getElementById('msgs').appendChild(row);
        scBot();
      }
    } else if (ex) { ex.remove(); }
  });

  // FIX: watch the chat partner's online status and update header
  FB.onValue(FB.r('users/' + uid + '/online'), snap => {
    const online = snap.val();
    document.getElementById('chatStatus').textContent = online ? '● অনলাইন' : '● অফলাইন';
    document.getElementById('chatStatus').style.color = online ? 'var(--green)' : 'var(--muted)';
    const dot = document.querySelector('#chatAva .online-dot');
    if (dot) dot.style.background = online ? 'var(--green)' : 'var(--muted2)';
  });

  FB.onDisconnect(FB.r('chats/' + CHAT_ID + '/typing/' + ME.uid)).remove();
}

function goBack() {
  if (unsubMessages) { unsubMessages(); unsubMessages = null; }
  if (unsubTyping) { unsubTyping(); unsubTyping = null; }
  clrTyp(); replyTo = null; editingId = null;
  document.getElementById('replyStrip').classList.remove('open');
  document.getElementById('msgInp').value = '';
  document.getElementById('chatSearchBar').classList.remove('open');
  showScreen('homeScreen');
}
window.goBack = goBack;

function renderMsgs(data) {
  const c = document.getElementById('msgs');
  c.innerHTML = '';
  if (!data || !Object.keys(data).length) {
    c.innerHTML = `<div class="empty-chat">💬 কোনো মেসেজ নেই।</div>`; return;
  }
  const msgs = Object.entries(data).map(([id, m]) => ({ id, ...m })).sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  let lastDate = null;
  msgs.forEach(m => {
    const d = fmtDate(m.timestamp);
    if (d !== lastDate) {
      const sep = document.createElement('div'); sep.className = 'date-sep'; sep.innerHTML = `<span>${d}</span>`;
      c.appendChild(sep); lastDate = d;
    }
    c.appendChild(makeBubble(m));
  });
}

// FIX: store message data in a WeakMap keyed by element, so actions use data not inline-encoded strings
const msgDataMap = new Map();

function makeBubble(m) {
  const isMine = m.sender === ME.uid;
  const row = document.createElement('div'); row.className = 'mrow' + (isMine ? ' me' : '');

  const wrap = document.createElement('div'); wrap.className = 'mwrap';
  const bub = document.createElement('div'); bub.className = 'bubble';

  if (m.replyTo) {
    const rp = document.createElement('div'); rp.className = 'reply-prev';
    // FIX: use textContent (not innerHTML) to prevent XSS
    rp.textContent = '↩️ ' + (m.replyTo.text || '');
    bub.appendChild(rp);
  }

  // Safe: createTextNode prevents XSS
  bub.appendChild(document.createTextNode(m.text || ''));
  if (m.edited) { const et = document.createElement('span'); et.className = 'edited-tag'; et.textContent = ' (সম্পাদিত)'; bub.appendChild(et); }

  // FIX: store message data in map so action buttons don't need inline encoded text
  msgDataMap.set(m.id, m);
  setupBubbleInteraction(bub, m, isMine);

  const t = document.createElement('div'); t.className = 'mtime';
  t.textContent = fmtTime(m.timestamp) + (isMine ? (m.seen ? ' ✓✓' : ' ✓') : '');

  // FIX: actions use data-id attribute, no inline btoa encoding
  const actions = document.createElement('div'); actions.className = 'msg-actions'; actions.id = 'act-' + m.id;

  const replyBtn = document.createElement('button');
  replyBtn.className = 'ma-btn'; replyBtn.textContent = '↩️';
  replyBtn.onclick = (e) => { e.stopPropagation(); startReply(m.id); };
  actions.appendChild(replyBtn);

  if (isMine) {
    const editBtn = document.createElement('button');
    editBtn.className = 'ma-btn'; editBtn.textContent = '✏️';
    editBtn.onclick = (e) => { e.stopPropagation(); startEdit(m.id); };

    const delBtn = document.createElement('button');
    delBtn.className = 'ma-btn del'; delBtn.textContent = '🗑';
    delBtn.onclick = (e) => { e.stopPropagation(); deleteMsg(m.id); };

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
  }

  wrap.appendChild(actions); wrap.appendChild(bub); wrap.appendChild(t);
  row.appendChild(wrap); return row;
}

function setupBubbleInteraction(bub, m, isMine) {
  bub.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.msg-actions').forEach(el => el.style.display = 'none');
    const act = document.getElementById('act-' + m.id);
    if (act) act.style.display = act.style.display === 'flex' ? 'none' : 'flex';
  });
}

// FIX: startReply uses msgDataMap — no btoa/atob needed
function startReply(id) {
  const m = msgDataMap.get(id);
  if (!m) return;
  // FIX: include sender in replyTo so it's stored correctly
  replyTo = { id, text: m.text, sender: m.sender };
  const strip = document.getElementById('replyTxt');
  strip.innerHTML = '';
  const label = document.createElement('span'); label.textContent = '↩️ রিপ্লাই:';
  strip.appendChild(label);
  strip.appendChild(document.createTextNode(' ' + (m.text || '').slice(0, 40)));
  document.getElementById('replyStrip').classList.add('open');
  document.getElementById('msgInp').focus();
}

function cancelReply() { replyTo = null; document.getElementById('replyStrip').classList.remove('open'); }
window.cancelReply = cancelReply;

// FIX: startEdit uses msgDataMap — no btoa/atob needed
function startEdit(id) {
  const m = msgDataMap.get(id);
  if (!m) return;
  editingId = id;
  const inp = document.getElementById('msgInp');
  inp.value = m.text || '';
  document.getElementById('sendBtn').disabled = false;
  inp.focus();
}

function deleteMsg(id) {
  if (confirm('মেসেজটি ডিলিট করতে চান?')) FB.remove(FB.r('chats/' + CHAT_ID + '/messages/' + id));
}

function sendMsg() {
  const inp = document.getElementById('msgInp'); const txt = inp.value.trim();
  if (!txt || !CHAT_ID) return;

  if (editingId) {
    FB.update(FB.r('chats/' + CHAT_ID + '/messages/' + editingId), { text: txt, edited: true });
    editingId = null;
  } else {
    const msg = { text: txt, sender: ME.uid, timestamp: Date.now(), seen: false };
    // FIX: replyTo.sender is now correctly set in startReply
    if (replyTo) msg.replyTo = { text: replyTo.text.slice(0, 50), sender: replyTo.sender };
    FB.push(FB.r('chats/' + CHAT_ID + '/messages'), msg);

    FB.update(FB.r('chatMeta/' + CHAT_ID), { lastMessage: txt.slice(0, 60), lastTimestamp: Date.now(), lastSender: ME.uid });

    // Receiver unread update
    FB.get(FB.r('unread/' + CHAT_WITH.uid + '/' + CHAT_ID)).then(snap => {
      FB.set(FB.r('unread/' + CHAT_WITH.uid + '/' + CHAT_ID), (snap.val() || 0) + 1);
    });
    cancelReply();
  }
  inp.value = ''; inp.style.height = 'auto'; document.getElementById('sendBtn').disabled = true; clrTyp(); scBot();
}
window.sendMsg = sendMsg;

function setTyp(v) { if (ME && CHAT_ID) FB.set(FB.r('chats/' + CHAT_ID + '/typing/' + ME.uid), v || null); }
function clrTyp() { setTyp(null); clearTimeout(typTimer); }
function onType(el) {
  el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 90) + 'px';
  document.getElementById('sendBtn').disabled = !el.value.trim();
  setTyp(true); clearTimeout(typTimer); typTimer = setTimeout(clrTyp, 2000);
}
window.onType = onType;

function onKey(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } }
window.onKey = onKey;

function scBot() { const c = document.getElementById('msgs'); c.scrollTop = c.scrollHeight; }
window.scBot = scBot;

function buildEmj() {
  const p = document.getElementById('epanel'); p.innerHTML = '';
  EMJS.forEach(e => {
    const d = document.createElement('div'); d.className = 'ep'; d.textContent = e;
    d.onclick = () => { const i = document.getElementById('msgInp'); i.value += e; onType(i); };
    p.appendChild(d);
  });
}
function togEmj() { document.getElementById('epanel').classList.toggle('open'); }
window.togEmj = togEmj;

// FIX: togSearch — implemented (was missing, caused ReferenceError)
function togSearch() {
  const bar = document.getElementById('chatSearchBar');
  bar.classList.toggle('open');
  if (bar.classList.contains('open')) {
    document.getElementById('chatSearchInp').focus();
  } else {
    // Clear highlights when closing
    document.getElementById('chatSearchInp').value = '';
    document.querySelectorAll('.msg-highlight').forEach(el => el.classList.remove('msg-highlight'));
    searchMatches = []; searchIdx = 0;
  }
}
window.togSearch = togSearch;

function doMsgSearch(q) {
  document.querySelectorAll('.msg-highlight').forEach(el => el.classList.remove('msg-highlight'));
  searchMatches = [];
  if (!q.trim()) return;
  const lq = q.toLowerCase();
  document.querySelectorAll('.bubble').forEach(bub => {
    if (bub.textContent.toLowerCase().includes(lq)) {
      bub.classList.add('msg-highlight');
      searchMatches.push(bub);
    }
  });
  searchIdx = 0;
  if (searchMatches.length) searchMatches[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
}
window.doMsgSearch = doMsgSearch;

function navSearch(dir) {
  if (!searchMatches.length) return;
  searchIdx = (searchIdx + dir + searchMatches.length) % searchMatches.length;
  searchMatches[searchIdx].scrollIntoView({ behavior: 'smooth', block: 'center' });
}
window.navSearch = navSearch;

// FIX: clrChat — implemented (was missing, caused ReferenceError)
function clrChat() {
  if (!CHAT_ID) return;
  if (confirm('এই চ্যাটের সব মেসেজ ডিলিট করতে চান?')) {
    FB.remove(FB.r('chats/' + CHAT_ID + '/messages'));
    FB.remove(FB.r('chatMeta/' + CHAT_ID));
    toast('চ্যাট ক্লিয়ার হয়েছে');
  }
}
window.clrChat = clrChat;

document.addEventListener('click', () => {
  document.querySelectorAll('.msg-actions').forEach(el => el.style.display = 'none');
  document.getElementById('epanel').classList.remove('open');
});

function playPing() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain(); o.connect(g); g.connect(ctx.destination);
    o.frequency.setValueAtTime(600, ctx.currentTime); g.gain.setValueAtTime(0.15, ctx.currentTime);
    o.start(); o.stop(ctx.currentTime + 0.1);
  } catch(e) {}
}

// Session restore এখন onAuthStateChanged করে (firebase module script-এ)
// localStorage session আর দরকার নেই
