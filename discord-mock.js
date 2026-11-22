/* =====================================================================
   Discord Bot Simulator — tiruan (mock) sebagian API discord.js v14
   Kamu nggak perlu ubah file ini. Tulis bot kamu di bot.js.
   ===================================================================== */
(function () {
  'use strict';

  const RealDate = window.Date;
  const realNow = () => RealDate.now();
  const N = {
    setTimeout: window.setTimeout.bind(window),
    setInterval: window.setInterval.bind(window),
    clearTimeout: window.clearTimeout.bind(window),
    clearInterval: window.clearInterval.bind(window),
  };
  const nativeConsole = {
    log: console.log.bind(console), info: console.info.bind(console),
    warn: console.warn.bind(console), error: console.error.bind(console),
  };

  const BOT_ID = '999';
  const GUILD_ID = '1';
  let seq = 0;
  const nextId = () => String(realNow()) + String(++seq).padStart(4, '0');

  // ------------------------------------------------------------------ state
  const SIM = (window.SIM = {
    BOT_ID, GUILD_ID, native: N, offset: 0, ready: false,
    env: {
      TOKEN: 'token-palsu-simulator',
      DISCORD_TOKEN: 'token-palsu-simulator',
      CLIENT_ID: BOT_ID,
      GUILD_ID: GUILD_ID,
    },
    roles: [
      { id: '201', name: 'Admin', color: '#ED4245', perms: ['Administrator'] },
      { id: '202', name: 'Moderator', color: '#E67E22', perms: ['KickMembers', 'BanMembers', 'ModerateMembers', 'ManageMessages', 'ManageRoles'] },
      { id: '203', name: 'Staff', color: '#1ABC9C', perms: ['ManageMessages'] },
      { id: '204', name: 'Member', color: '#99AAB5', perms: [] },
    ],
    users: [
      { id: '100', username: 'Kamu', color: '#5865F2', roles: ['201', '203'], owner: true },
      { id: '101', username: 'Alex', color: '#3BA55C', roles: ['202', '203'] },
      { id: '102', username: 'Riley', color: '#FAA61A', roles: ['204'] },
      { id: '103', username: 'Sam', color: '#EB459E', roles: [] },
      ...['Budi', 'Citra', 'Dewi', 'Eko', 'Fajar', 'Gita', 'Hadi', 'Intan', 'Joko', 'Kiki'].map((n, i) => ({
        id: String(110 + i), username: n, color: ['#7289DA', '#43B581', '#F04747', '#9B59B6', '#1ABC9C', '#E91E63', '#E67E22', '#3498DB', '#95A5A6', '#F1C40F'][i], roles: ['204'],
      })),
      { id: BOT_ID, username: 'TestBot', color: '#00A8FC', roles: [], bot: true, emoji: '🤖' },
    ],
    channels: [
      { id: '301', name: 'general', topic: 'Ngobrol santai + tes bot di sini' },
      { id: '302', name: 'mod-log', topic: 'Log moderasi dari bot' },
      { id: '303', name: 'warnings', topic: 'Daftar peringatan' },
    ],
    records: [], commands: [], logs: [],
    currentUserId: '100', currentChannelId: '301', unread: {},
    hooks: { render() {}, log() {}, toast() {}, typing() {}, commands() {} },
  });

  // ------------------------------------------------------------ penyimpanan lokal
  const LS = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage diblokir */ } },
    del(k) { try { localStorage.removeItem(k); } catch { /* */ } },
    keys() { try { return Object.keys(localStorage); } catch { return []; } },
  };
  SIM.TEST = /[?&]test\b/.test(location.search);
  const FS_PREFIX = SIM.TEST ? 'simfs-test:' : 'simfs:';
  if (SIM.TEST) for (const k of LS.keys()) if (k.startsWith('simfs-test:')) LS.del(k);
  // waktu virtual ikut disimpan, biar data bot (timestamp) tetap masuk akal setelah restart
  SIM.offset = SIM.TEST ? 0 : (+LS.get('sim:offset') || 0);
  SIM.resetData = () => {
    for (const k of LS.keys()) if (k.startsWith('simfs:') || k === 'sim:offset') LS.del(k);
    location.reload();
  };

  // bot.js bisa mendaftarkan panel "Test settings":
  //   globalThis.SIM?.registerSettings?.({ description, fields: [...], get(), set(values) })
  SIM.settingsDef = null;
  SIM.registerSettings = (def) => { SIM.settingsDef = def; };

  SIM.user = (id) => SIM.users.find((u) => u.id === id);
  SIM.channel = (id) => SIM.channels.find((c) => c.id === id);
  SIM.role = (id) => SIM.roles.find((r) => r.id === id);
  SIM.vNow = () => realNow() + SIM.offset;

  SIM.avatarURL = (u) => {
    const label = u.emoji || u.username[0].toUpperCase();
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><circle cx='40' cy='40' r='40' fill='${u.color}'/><text x='50%' y='53%' dominant-baseline='middle' text-anchor='middle' font-family='Segoe UI, Arial, sans-serif' font-size='${u.emoji ? 42 : 36}' font-weight='700' fill='white'>${label}</text></svg>`;
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  };

  // ------------------------------------------------------------- waktu virtual
  class SimDate extends RealDate {
    constructor(...a) { if (a.length === 0) super(SIM.vNow()); else super(...a); }
    static now() { return SIM.vNow(); }
  }
  window.Date = SimDate;

  const timers = new Map();
  let tseq = 1;
  window.setTimeout = function (fn, ms, ...args) {
    if (typeof fn !== 'function') return 0;
    const id = tseq++;
    timers.set(id, { fn, args, at: SIM.vNow() + Math.max(0, +ms || 0), every: 0 });
    return id;
  };
  window.setInterval = function (fn, ms, ...args) {
    if (typeof fn !== 'function') return 0;
    const id = tseq++;
    const every = Math.max(10, +ms || 0);
    timers.set(id, { fn, args, at: SIM.vNow() + every, every });
    return id;
  };
  window.clearTimeout = window.clearInterval = (id) => { timers.delete(id); };

  function runTimer(id, t) {
    if (t.every) t.at += t.every; else timers.delete(id);
    try {
      const r = t.fn(...t.args);
      if (r && typeof r.catch === 'function') r.catch((e) => SIM.error(e, 'timer'));
    } catch (e) { SIM.error(e, 'timer'); }
  }
  function runDue(limit) {
    let guard = 0;
    while (guard++ < 5000) {
      let best = null, bid = null;
      for (const [id, t] of timers) if (t.at <= limit && (!best || t.at < best.at)) { best = t; bid = id; }
      if (!best) return;
      SIM.offset = Math.max(SIM.offset, best.at - realNow());
      runTimer(bid, best);
    }
    // kebanyakan (misal interval 1 detik dimajukan 1 jam) -> lompati sisanya
    let skipped = 0;
    for (const [id, t] of timers) if (t.at <= limit) {
      if (t.every) { t.at = limit + t.every; skipped++; } else { timers.delete(id); skipped++; }
    }
    if (skipped) SIM.log('warn', `⚠ ${skipped} timer dilewati karena terlalu banyak yang jalan sekaligus.`);
  }
  N.setInterval(() => runDue(SIM.vNow()), 100);

  SIM.timerCount = () => timers.size;
  SIM.advance = (ms) => {
    const target = SIM.vNow() + ms;
    SIM.log('sys', `⏩ Waktu dimajukan ${ms >= 3600000 ? ms / 3600000 + ' jam' : ms / 60000 + ' menit'}`);
    runDue(target);
    SIM.offset = target - realNow();
    if (!SIM.TEST) LS.set('sim:offset', String(SIM.offset));
    SIM.hooks.render();
  };

  // ------------------------------------------------------------------ log
  function inspect(x, depth = 0, seen = new WeakSet()) {
    if (x === null || x === undefined) return String(x);
    if (typeof x === 'string') return depth ? JSON.stringify(x) : x;
    if (typeof x === 'bigint') return x + 'n';
    if (typeof x !== 'object' && typeof x !== 'function') return String(x);
    if (typeof x === 'function') return `[Function ${x.name || 'anonim'}]`;
    if (x instanceof Error) return (x.stack && !/^\s*at /m.test(x.stack) ? x.stack : `${x.name}: ${x.message}`);
    if (seen.has(x)) return '[Circular]';
    seen.add(x);
    if (depth > 2) return Array.isArray(x) ? '[Array]' : '[Object]';
    if (x instanceof Map) return `Collection(${x.size}) [${[...x.values()].slice(0, 10).map((v) => inspect(v, depth + 1, seen)).join(', ')}]`;
    if (Array.isArray(x)) return `[${x.slice(0, 20).map((v) => inspect(v, depth + 1, seen)).join(', ')}]`;
    if (x instanceof RealDate) return x.toISOString();
    const parts = [];
    for (const k of Object.keys(x).slice(0, 15)) {
      let v; try { v = x[k]; } catch { v = '?'; }
      if (typeof v === 'function') continue;
      parts.push(`${k}: ${inspect(v, depth + 1, seen)}`);
    }
    return `{ ${parts.join(', ')} }`;
  }
  SIM.log = (level, ...parts) => {
    const e = { level, text: parts.map((p) => inspect(p)).join(' '), time: SIM.vNow() };
    SIM.logs.push(e);
    if (SIM.logs.length > 500) SIM.logs.shift();
    SIM.hooks.log(e);
  };
  SIM.error = (err, where) => {
    nativeConsole.error(err);
    SIM.log('error', `❌ Error di ${where}:`, err);
  };
  for (const lvl of ['log', 'info', 'warn', 'error']) {
    console[lvl] = (...a) => { nativeConsole[lvl](...a); SIM.log(lvl, ...a); };
  }
  console.debug = console.log;
  window.addEventListener('error', (e) => {
    SIM.log('error', `❌ ${e.message}${e.filename ? ` (${e.filename.split('/').pop()} baris ${e.lineno})` : ''}`);
  });
  window.addEventListener('unhandledrejection', (e) => {
    SIM.log('error', '❌ Promise gagal tanpa .catch():', e.reason);
  });

  // ------------------------------------------------------------ util
  class Collection extends Map {
    find(fn) { for (const [k, v] of this) if (fn(v, k, this)) return v; return undefined; }
    findKey(fn) { for (const [k, v] of this) if (fn(v, k, this)) return k; return undefined; }
    filter(fn) { const c = new Collection(); for (const [k, v] of this) if (fn(v, k, this)) c.set(k, v); return c; }
    map(fn) { const o = []; for (const [k, v] of this) o.push(fn(v, k, this)); return o; }
    some(fn) { for (const [k, v] of this) if (fn(v, k, this)) return true; return false; }
    every(fn) { for (const [k, v] of this) if (!fn(v, k, this)) return false; return true; }
    first(n) { const a = [...this.values()]; return n === undefined ? a[0] : a.slice(0, n); }
    last(n) { const a = [...this.values()]; return n === undefined ? a[a.length - 1] : a.slice(-n); }
    random() { const a = [...this.values()]; return a[Math.floor(Math.random() * a.length)]; }
    sort(fn = (a, b) => (a > b ? 1 : -1)) { return new Collection([...this.entries()].sort((a, b) => fn(a[1], b[1], a[0], b[0]))); }
    toJSON() { return [...this.values()]; }
  }
  const coll = (arr) => new Collection(arr.map((x) => [x.id, x]));

  class DiscordAPIError extends Error {
    constructor(code, message, status = 400) { super(message); this.name = 'DiscordAPIError'; this.code = code; this.status = status; }
  }
  class DiscordjsError extends Error {
    constructor(code, message) { super(message); this.name = `Error [${code}]`; this.code = code; }
  }
  const attempt = (fn) => { try { return Promise.resolve(fn()); } catch (e) { return Promise.reject(e); } };

  const COLORS = {
    Default: 0x000000, White: 0xffffff, Aqua: 0x1abc9c, Green: 0x57f287, Blue: 0x3498db, Yellow: 0xfee75c,
    Purple: 0x9b59b6, LuminousVividPink: 0xe91e63, Fuchsia: 0xeb459e, Gold: 0xf1c40f, Orange: 0xe67e22,
    Red: 0xed4245, Grey: 0x95a5a6, Navy: 0x34495e, DarkAqua: 0x11806a, DarkGreen: 0x1f8b4c, DarkBlue: 0x206694,
    DarkPurple: 0x71368a, DarkGold: 0xc27c0e, DarkOrange: 0xa84300, DarkRed: 0x992d22, DarkGrey: 0x979c9f,
    LightGrey: 0xbcc0c0, Blurple: 0x5865f2, Greyple: 0x99aab5, NotQuiteBlack: 0x23272a,
  };
  function resolveColor(c) {
    if (c == null) return null;
    if (typeof c === 'number') return c;
    if (Array.isArray(c)) return (c[0] << 16) + (c[1] << 8) + c[2];
    if (c === 'Random') return Math.floor(Math.random() * 0xffffff);
    if (typeof c === 'string' && c.startsWith('#')) return parseInt(c.slice(1), 16);
    if (c in COLORS) return COLORS[c];
    throw new DiscordjsError('ColorConvert', `Warna tidak dikenal: ${c}`);
  }

  // ------------------------------------------------------------ permission
  SIM.permsOf = (u) => {
    const set = new Set();
    for (const rid of u.roles) for (const p of SIM.role(rid)?.perms || []) set.add(p);
    return set;
  };
  SIM.hasPerm = (u, p) => {
    if (!u || u.owner) return true;
    const perms = SIM.permsOf(u);
    if (perms.has('Administrator')) return true;
    const list = Array.isArray(p) ? p : [p];
    return list.every((x) => typeof x !== 'string' || perms.has(x));
  };

  // ------------------------------------------------------------ wrappers
  function wrapUser(u) {
    if (!u) return null;
    return {
      id: u.id, username: u.username, globalName: u.username, displayName: u.username, tag: u.username,
      discriminator: '0', bot: !!u.bot, system: false, avatar: null,
      createdAt: new RealDate(1600000000000), createdTimestamp: 1600000000000,
      displayAvatarURL: () => SIM.avatarURL(u), avatarURL: () => SIM.avatarURL(u),
      toString: () => `<@${u.id}>`,
      send: (p) => SIM.dm(u, p),
      fetch() { return Promise.resolve(this); },
    };
  }
  function wrapRole(r) {
    if (!r) return null;
    return {
      id: r.id, name: r.name, color: parseInt(r.color.slice(1), 16), hexColor: r.color.toLowerCase(),
      position: SIM.roles.length - SIM.roles.indexOf(r),
      permissions: { has: (p) => r.perms.includes('Administrator') || [].concat(p).every((x) => r.perms.includes(x)), toArray: () => [...r.perms] },
      get members() { return coll(SIM.users.filter((u) => !u.gone && u.roles.includes(r.id)).map(wrapMember)); },
      toString: () => `<@&${r.id}>`,
    };
  }
  const roleIdOf = (r) => (typeof r === 'string' ? (SIM.role(r) ? r : SIM.roles.find((x) => x.name === r)?.id) : r?.id);

  function wrapMember(u) {
    if (!u) return null;
    return {
      id: u.id, user: wrapUser(u), displayName: u.username, nickname: null,
      joinedAt: new RealDate(1700000000000), joinedTimestamp: 1700000000000,
      get guild() { return wrapGuild(); },
      get communicationDisabledUntilTimestamp() { return u.timeoutUntil > SIM.vNow() ? u.timeoutUntil : null; },
      get communicationDisabledUntil() { return u.timeoutUntil > SIM.vNow() ? new RealDate(u.timeoutUntil) : null; },
      isCommunicationDisabled: () => u.timeoutUntil > SIM.vNow(),
      get displayHexColor() { const r = SIM.roles.find((r) => u.roles.includes(r.id)); return r ? r.color.toLowerCase() : '#000000'; },
      get kickable() { return !u.owner && !u.bot; }, get bannable() { return !u.owner && !u.bot; },
      get moderatable() { return !u.owner && !u.bot; }, get manageable() { return !u.owner && !u.bot; },
      roles: {
        get cache() { return coll(u.roles.map(SIM.role).filter(Boolean).map(wrapRole)); },
        get highest() { const r = SIM.roles.find((r) => u.roles.includes(r.id)); return r ? wrapRole(r) : { id: GUILD_ID, name: '@everyone', position: 0 }; },
        add(r) {
          const ids = [].concat(r).map(roleIdOf);
          return attempt(() => {
            for (const id of ids) {
              if (!id) throw new DiscordAPIError(10011, 'Unknown Role', 404);
              if (!u.roles.includes(id)) u.roles.push(id);
              SIM.system(`🏷 Bot memberi role **${SIM.role(id).name}** ke **${u.username}**`);
            }
            SIM.hooks.render();
            return wrapMember(u);
          });
        },
        remove(r) {
          const ids = [].concat(r).map(roleIdOf);
          return attempt(() => {
            for (const id of ids) {
              if (u.roles.includes(id)) { u.roles = u.roles.filter((x) => x !== id); SIM.system(`🏷 Bot mencabut role **${SIM.role(id)?.name}** dari **${u.username}**`); }
            }
            SIM.hooks.render();
            return wrapMember(u);
          });
        },
      },
      permissions: { has: (p) => SIM.hasPerm(u, p), toArray: () => (u.owner ? ['Administrator'] : [...SIM.permsOf(u)]) },
      permissionsIn() { return this.permissions; },
      kick: (reason) => SIM.modAction(u, 'kick', { reason }),
      ban: (opts = {}) => SIM.modAction(u, 'ban', opts),
      timeout: (ms, reason) => SIM.modAction(u, 'timeout', { ms, reason }),
      disableCommunicationUntil: (ts, reason) => SIM.modAction(u, 'timeout', { ms: ts ? ts - SIM.vNow() : null, reason }),
      send: (p) => SIM.dm(u, p),
      fetch() { return Promise.resolve(wrapMember(u)); },
      toString: () => `<@${u.id}>`,
    };
  }

  function findUser(x) {
    const id = typeof x === 'string' ? x : x?.id;
    return SIM.user(id);
  }

  function wrapGuild() {
    const present = () => SIM.users.filter((u) => !u.gone);
    return {
      id: GUILD_ID, name: 'Test Server', ownerId: '100', available: true,
      get memberCount() { return present().length; },
      iconURL: () => null,
      members: {
        get cache() { return coll(present().map(wrapMember)); },
        get me() { return wrapMember(SIM.user(BOT_ID)); },
        fetch(arg) {
          if (arg === undefined || (typeof arg === 'object' && !arg.id && !arg.user)) return Promise.resolve(this.cache);
          const u = findUser(arg.user || arg);
          if (!u || u.gone) return Promise.reject(new DiscordAPIError(10007, 'Unknown Member', 404));
          return Promise.resolve(wrapMember(u));
        },
        kick: (x, reason) => SIM.modAction(findUser(x), 'kick', { reason }),
        ban: (x, opts = {}) => SIM.modAction(findUser(x), 'ban', opts),
        unban: (x, reason) => SIM.unban(findUser(x), reason),
      },
      bans: {
        get cache() { return coll(SIM.users.filter((u) => u.gone === 'ban').map((u) => ({ id: u.id, user: wrapUser(u), reason: u.banReason || null }))); },
        fetch(x) {
          if (x === undefined) return Promise.resolve(this.cache);
          const u = findUser(x.user || x);
          return u?.gone === 'ban' ? Promise.resolve({ user: wrapUser(u), reason: u.banReason || null }) : Promise.reject(new DiscordAPIError(10026, 'Unknown Ban', 404));
        },
        remove: (x, reason) => SIM.unban(findUser(x), reason),
      },
      channels: {
        get cache() { return coll(SIM.channels.map(wrapChannel)); },
        fetch: (id) => Promise.resolve(id ? wrapChannel(SIM.channel(id)) : coll(SIM.channels.map(wrapChannel))),
      },
      roles: {
        get cache() { return coll(SIM.roles.map(wrapRole)); },
        get everyone() { return { id: GUILD_ID, name: '@everyone', toString: () => '@everyone' }; },
        fetch: (id) => Promise.resolve(id ? wrapRole(SIM.role(id)) : coll(SIM.roles.map(wrapRole))),
      },
      toString: () => 'Test Server',
    };
  }

  function wrapChannel(c) {
    if (!c) return null;
    return {
      id: c.id, name: c.name, topic: c.topic, type: 0, guildId: GUILD_ID,
      get guild() { return wrapGuild(); },
      isTextBased: () => true, isVoiceBased: () => false, isDMBased: () => false, isThread: () => false, isSendable: () => true,
      toString: () => `<#${c.id}>`,
      send: (p) => attempt(() => wrapMessage(SIM.post({ channelId: c.id, authorId: BOT_ID, ...normalize(p) }))),
      sendTyping: () => { SIM.hooks.typing(c.id); return Promise.resolve(); },
      messages: {
        get cache() { return coll(SIM.records.filter((r) => r.channelId === c.id && !r.ephemeralFor && !r.system).map(wrapMessage)); },
        fetch(arg) {
          if (typeof arg === 'string') {
            const r = SIM.records.find((r) => r.id === arg && r.channelId === c.id);
            return r ? Promise.resolve(wrapMessage(r)) : Promise.reject(new DiscordAPIError(10008, 'Unknown Message', 404));
          }
          const limit = arg?.limit || 50;
          const list = SIM.records.filter((r) => r.channelId === c.id && !r.ephemeralFor && !r.system).slice(-limit).reverse();
          return Promise.resolve(coll(list.map(wrapMessage)));
        },
      },
      bulkDelete(n) {
        return attempt(() => {
          const count = typeof n === 'number' ? n : (n?.size ?? n?.length ?? 0);
          const list = SIM.records.filter((r) => r.channelId === c.id && !r.ephemeralFor && !r.system).slice(-count);
          for (const r of list) SIM.remove(r.id, true);
          return coll(list.map(wrapMessage));
        });
      },
    };
  }

  function mentionsOf(rec) {
    const ids = [...(rec.content || '').matchAll(/<@!?(\d+)>/g)].map((m) => m[1]);
    const users = ids.map(SIM.user).filter(Boolean);
    const roles = [...(rec.content || '').matchAll(/<@&(\d+)>/g)].map((m) => SIM.role(m[1])).filter(Boolean);
    const chans = [...(rec.content || '').matchAll(/<#(\d+)>/g)].map((m) => SIM.channel(m[1])).filter(Boolean);
    const rep = rec.replyTo ? SIM.records.find((r) => r.id === rec.replyTo) : null;
    return {
      users: coll(users.map(wrapUser)),
      members: coll(users.filter((u) => !u.gone).map(wrapMember)),
      roles: coll(roles.map(wrapRole)),
      channels: coll(chans.map(wrapChannel)),
      everyone: /@(everyone|here)/.test(rec.content || ''),
      repliedUser: rep ? wrapUser(SIM.user(rep.authorId)) : null,
      has: (x) => ids.includes(typeof x === 'string' ? x : x?.id),
    };
  }

  function wrapRow(row) {
    return {
      ...row, type: row.type, data: row,
      components: (row.components || []).map((c) => ({ ...c, customId: c.custom_id, data: c, disabled: !!c.disabled })),
      toJSON: () => row,
    };
  }
  function wrapEmbed(e) { return { ...e, data: e, toJSON: () => e }; }

  function wrapReaction(rec, r) {
    return {
      emoji: { name: r.emoji, id: null, toString: () => r.emoji },
      get count() { return r.users.length; },
      get me() { return r.users.includes(BOT_ID); },
      get message() { return wrapMessage(rec); },
      partial: false,
      users: {
        get cache() { return coll(r.users.map(SIM.user).filter(Boolean).map(wrapUser)); },
        fetch() { return Promise.resolve(this.cache); },
        remove: (u) => attempt(() => SIM.unreact(rec, r.emoji, (u && (u.id || u)) || BOT_ID)),
      },
      remove: () => attempt(() => { rec.reactions = rec.reactions.filter((x) => x !== r); SIM.hooks.render(); }),
      fetch() { return Promise.resolve(this); },
    };
  }

  function wrapMessage(rec) {
    if (!rec) return null;
    const author = SIM.user(rec.authorId);
    return {
      id: rec.id, channelId: rec.channelId, guildId: GUILD_ID, type: rec.replyTo ? 19 : 0,
      get content() { return rec.content; },
      get cleanContent() { return rec.content.replace(/<@!?(\d+)>/g, (_, id) => '@' + (SIM.user(id)?.username || 'unknown')); },
      get embeds() { return rec.embeds.map(wrapEmbed); },
      get components() { return rec.components.map(wrapRow); },
      get editedTimestamp() { return rec.edited ? rec.ts : null; },
      get pinned() { return !!rec.pinned; },
      author: wrapUser(author),
      get member() { return author && !author.gone ? wrapMember(author) : null; },
      get channel() { return wrapChannel(SIM.channel(rec.channelId)); },
      get guild() { return wrapGuild(); },
      get client() { return SIM.client; },
      get mentions() { return mentionsOf(rec); },
      get reference() { return rec.replyTo ? { messageId: rec.replyTo, channelId: rec.channelId, guildId: GUILD_ID } : null; },
      get interaction() { return rec.interaction ? { commandName: rec.interaction.name, user: wrapUser(SIM.user(rec.interaction.userId)) } : null; },
      get reactions() {
        return {
          get cache() { return new Collection(rec.reactions.map((r) => [r.emoji, wrapReaction(rec, r)])); },
          removeAll: () => attempt(() => { rec.reactions = []; SIM.hooks.render(); }),
        };
      },
      createdTimestamp: rec.ts, createdAt: new RealDate(rec.ts),
      system: false, webhookId: null, deletable: true, editable: rec.authorId === BOT_ID,
      url: `https://discord.com/channels/${GUILD_ID}/${rec.channelId}/${rec.id}`,
      inGuild: () => true,
      reply: (p) => attempt(() => wrapMessage(SIM.post({ channelId: rec.channelId, authorId: BOT_ID, replyTo: rec.id, ...normalize(p) }))),
      react: (e) => attempt(() => { SIM.react(rec, String(e), BOT_ID); return wrapReaction(rec, rec.reactions.find((r) => r.emoji === String(e))); }),
      edit: (p) => attempt(() => {
        if (rec.authorId !== BOT_ID) throw new DiscordAPIError(50005, 'Cannot edit a message authored by another user', 403);
        applyEdit(rec, normalize(p, true)); rec.edited = true; SIM.hooks.render(); return wrapMessage(rec);
      }),
      delete: () => attempt(() => { SIM.remove(rec.id, true); return wrapMessage(rec); }),
      pin: () => attempt(() => { rec.pinned = true; SIM.system(`📌 Bot menyematkan sebuah pesan.`, rec.channelId); return wrapMessage(rec); }),
      unpin: () => attempt(() => { rec.pinned = false; return wrapMessage(rec); }),
      startThread: () => Promise.reject(new Error('Thread belum didukung di simulator.')),
      fetch() { return Promise.resolve(wrapMessage(rec)); },
      fetchReference: () => {
        const r = SIM.records.find((x) => x.id === rec.replyTo);
        return r ? Promise.resolve(wrapMessage(r)) : Promise.reject(new DiscordAPIError(10008, 'Unknown Message', 404));
      },
      toString: () => rec.content,
    };
  }
  SIM.wrapMessage = wrapMessage;

  // --------------------------------------------------------- payload
  function normEmbed(e) {
    const d = e && typeof e.toJSON === 'function' ? e.toJSON() : { ...(e?.data || e) };
    if (d.color !== undefined) d.color = resolveColor(d.color);
    return d;
  }
  // ubah builder / objek apa pun jadi JSON polos (rekursif)
  function normAny(c) {
    if (c == null) return c;
    const d = typeof c.toJSON === 'function' ? c.toJSON() : c.data && typeof c.data === 'object' ? { ...c.data } : { ...c };
    if (Array.isArray(d.components)) d.components = d.components.map(normAny);
    if (d.accessory) d.accessory = normAny(d.accessory);
    if (d.type === undefined && Array.isArray(d.components)) d.type = 1;
    return d;
  }
  function flagsHas(fl, bit, name) {
    if (fl == null) return false;
    if (typeof fl === 'number' || typeof fl === 'bigint') return (Number(fl) & bit) !== 0;
    if (Array.isArray(fl)) return fl.some((f) => flagsHas(f, bit, name));
    if (typeof fl === 'string') return fl === name;
    return false;
  }
  function normalize(p, partial = false) {
    if (p == null) p = {};
    if (typeof p !== 'object') p = { content: String(p) };
    const out = {};
    if ('content' in p || !partial) out.content = p.content == null ? '' : String(p.content);
    if ('embeds' in p || !partial) out.embeds = (p.embeds || []).map(normEmbed);
    if ('components' in p || !partial) out.components = (p.components || []).map(normAny);
    const fl = p.flags;
    out.ephemeral = !!(p.ephemeral || flagsHas(fl, 64, 'Ephemeral'));
    if (flagsHas(fl, 32768, 'IsComponentsV2')) out.v2 = true; else if (!partial) out.v2 = false;
    if (p.files?.length) SIM.log('warn', '⚠ Lampiran file (files) belum ditampilkan di simulator.');
    if (partial) delete out.ephemeral;
    return out;
  }
  SIM.normalize = normalize;

  const formErr = (msg) => new DiscordAPIError(50035, 'Invalid Form Body\n' + msg);
  function checkButton(b) {
    if (b.style === 5 ? !b.url : !b.custom_id) throw formErr(`Tombol "${b.label || '?'}" butuh ${b.style === 5 ? 'setURL()' : 'setCustomId()'}.`);
    if (!b.label && !b.emoji) throw formErr('Tombol butuh label atau emoji.');
    if (b.custom_id && b.custom_id.length > 100) throw formErr(`customId "${b.custom_id}" lebih dari 100 karakter.`);
    if (b.label && b.label.length > 80) throw formErr('Label tombol maksimal 80 karakter.');
  }
  function checkRow(row) {
    if (!row.components?.length || row.components.length > 5) throw formErr('Action row harus berisi 1-5 tombol.');
    for (const b of row.components) { if (b.type !== 2) throw formErr(`Komponen tipe ${b.type} di action row belum didukung simulator.`); checkButton(b); }
  }
  function validateV2(rec) {
    if (rec.content) throw formErr('content: Tidak boleh dipakai bersama flag IsComponentsV2 (pakai TextDisplay).');
    if (rec.embeds.length) throw formErr('embeds: Tidak boleh dipakai bersama flag IsComponentsV2.');
    if (!rec.components.length) throw new DiscordAPIError(50006, 'Cannot send an empty message');
    let count = 0, chars = 0;
    const TOP = [1, 9, 10, 12, 13, 14, 17];
    const walk = (c, parent) => {
      count++;
      switch (c.type) {
        case 1: checkRow(c); count += c.components.length; break;
        case 9:
          if (!c.components?.length || c.components.length > 3) throw formErr('Section harus berisi 1-3 TextDisplay.');
          if (!c.accessory) throw formErr('Section wajib punya accessory (setButtonAccessory / setThumbnailAccessory).');
          for (const t of c.components) { if (t.type !== 10) throw formErr('Isi Section hanya boleh TextDisplay.'); walk(t, 9); }
          if (c.accessory.type === 2) { count++; checkButton(c.accessory); }
          else if (c.accessory.type === 11) { count++; if (!c.accessory.media?.url) throw formErr('Thumbnail butuh setURL().'); }
          else throw formErr('Accessory Section harus tombol atau thumbnail.');
          break;
        case 10:
          if (!c.content) throw formErr('TextDisplay tidak boleh kosong.');
          chars += c.content.length; break;
        case 12: if (!c.items?.length) throw formErr('MediaGallery butuh minimal 1 item.'); break;
        case 13: case 14: break;
        case 17:
          if (parent === 17) throw formErr('Container tidak boleh di dalam container.');
          if (!c.components?.length) throw formErr('Container tidak boleh kosong.');
          for (const x of c.components) { if (!TOP.includes(x.type) || x.type === 17) throw formErr(`Komponen tipe ${x.type} tidak boleh di dalam container.`); walk(x, 17); }
          break;
        default: throw formErr(`Tipe komponen ${c.type} tidak dikenal.`);
      }
    };
    for (const c of rec.components) { if (!TOP.includes(c.type)) throw formErr(`Komponen tipe ${c.type} tidak boleh di level atas.`); walk(c, 0); }
    if (count > 40) throw formErr(`components: Maksimal 40 komponen per pesan (sekarang ${count}).`);
    if (chars > 4000) throw formErr(`components: Total teks maksimal 4000 karakter (sekarang ${chars}).`);
  }
  function validate(rec) {
    if (rec.v2) return validateV2(rec);
    if (!rec.content && !rec.embeds.length && !rec.components.length) throw new DiscordAPIError(50006, 'Cannot send an empty message');
    if (rec.content.length > 2000) throw formErr('content[BASE_TYPE_MAX_LENGTH]: Must be 2000 or fewer in length.');
    if (rec.embeds.length > 10) throw formErr('embeds: Maksimal 10 embed.');
    if (rec.components.length > 5) throw formErr('components: Maksimal 5 baris (action row).');
    for (const row of rec.components) {
      if (row.type !== 1) throw formErr(`Komponen tipe ${row.type} butuh flags: MessageFlags.IsComponentsV2.`);
      checkRow(row);
    }
  }
  // edit pesan: gabung isi lama + baru lalu cek
  function applyEdit(rec, n) {
    const merged = { content: rec.content, embeds: rec.embeds, components: rec.components, v2: rec.v2, ...n };
    if (rec.v2 && n.v2 === undefined) merged.v2 = true;
    if (rec.v2 && n.v2 === false) throw formErr('flags: Flag IsComponentsV2 tidak bisa dilepas dari pesan.');
    validate(merged);
    Object.assign(rec, merged);
  }

  // daftar tombol dalam urutan tampil (dipakai UI & tes)
  SIM.buttonsOf = (rec) => {
    const out = [];
    const walk = (c) => {
      if (!c) return;
      if (c.type === 2) out.push(c);
      (c.components || []).forEach(walk);
      if (c.accessory) walk(c.accessory);
    };
    rec.components.forEach(walk);
    return out;
  };
  // semua teks dalam pesan (content + embed + TextDisplay), buat tes & toast
  SIM.textOf = (rec) => {
    const parts = [rec.content];
    for (const e of rec.embeds) parts.push(e.title, e.description, ...(e.fields || []).flatMap((f) => [f.name, f.value]), e.footer?.text);
    const walk = (c) => { if (!c) return; if (c.type === 10) parts.push(c.content); if (c.type === 2) parts.push(c.label); (c.components || []).forEach(walk); if (c.accessory) walk(c.accessory); };
    rec.components.forEach(walk);
    return parts.filter(Boolean).join('\n');
  };

  // --------------------------------------------------------- core actions
  SIM.emit = (name, ...args) => { if (SIM.client) SIM.client.emit(name, ...args); };

  SIM.post = (data) => {
    const rec = Object.assign({
      id: nextId(), channelId: SIM.currentChannelId, authorId: BOT_ID, content: '', embeds: [], components: [],
      reactions: [], ts: SIM.vNow(), edited: false, replyTo: null, interaction: null, ephemeralFor: null,
      system: false, thinking: false, failed: false, v2: false,
    }, data);
    delete rec.ephemeral;
    if (!rec.system && !rec.thinking) validate(rec);
    SIM.records.push(rec);
    // DM dihitung per penerima: kotak DM tiap user terpisah
    const key = rec.channelId === 'dm' ? `dm:${rec.dmTo}` : rec.channelId;
    const viewing = rec.channelId === SIM.currentChannelId && (rec.channelId !== 'dm' || rec.dmTo === SIM.currentUserId);
    if (!viewing && !rec.ephemeralFor && !rec.system) SIM.unread[key] = (SIM.unread[key] || 0) + 1;
    SIM.hooks.render();
    if (!rec.system && !rec.ephemeralFor && !rec.thinking && rec.channelId !== 'dm') {
      queueMicrotask(() => SIM.emit('messageCreate', wrapMessage(rec)));
    }
    return rec;
  };
  SIM.system = (text, channelId = '301') => SIM.post({ channelId, system: true, content: text, authorId: BOT_ID });

  SIM.remove = (id, emit) => {
    const rec = SIM.records.find((r) => r.id === id);
    if (!rec) return;
    SIM.records = SIM.records.filter((r) => r.id !== id);
    SIM.hooks.render();
    if (emit !== false && !rec.system && !rec.ephemeralFor) queueMicrotask(() => SIM.emit('messageDelete', wrapMessage(rec)));
  };

  SIM.react = (rec, emoji, userId) => {
    let r = rec.reactions.find((x) => x.emoji === emoji);
    if (!r) { r = { emoji, users: [] }; rec.reactions.push(r); }
    if (r.users.includes(userId)) return;
    r.users.push(userId);
    SIM.hooks.render();
    if (userId !== BOT_ID) SIM.emit('messageReactionAdd', wrapReaction(rec, r), wrapUser(SIM.user(userId)));
  };
  SIM.unreact = (rec, emoji, userId) => {
    const r = rec.reactions.find((x) => x.emoji === emoji);
    if (!r || !r.users.includes(userId)) return;
    r.users = r.users.filter((x) => x !== userId);
    if (!r.users.length) rec.reactions = rec.reactions.filter((x) => x !== r);
    SIM.hooks.render();
    if (userId !== BOT_ID) SIM.emit('messageReactionRemove', wrapReaction(rec, r), wrapUser(SIM.user(userId)));
  };

  SIM.dm = (u, p) => attempt(() => {
    if (u.bot || u.dmClosed) throw new DiscordAPIError(50007, 'Cannot send messages to this user', 403);
    const n = normalize(p);
    const rec = SIM.post({ channelId: 'dm', authorId: BOT_ID, dmTo: u.id, ...n, ephemeral: undefined });
    const preview = (n.content || n.embeds[0]?.title || SIM.textOf(rec)).replace(/^#+ |^-# /gm, '').replace(/[*_`~|]/g, '').replace(/\s+/g, ' ').trim();
    const hint = u.id === SIM.currentUserId ? '' : ` — ganti user ke ${u.username} untuk membaca`;
    SIM.hooks.toast(`📩 DM dari bot ke ${u.username}`, (preview.slice(0, 100) || '[pesan]') + hint);
    return wrapMessage(rec);
  });

  SIM.modAction = (u, action, opts = {}) => attempt(() => {
    if (!u) throw new DiscordAPIError(10013, 'Unknown User', 404);
    if (u.owner || u.bot) throw new DiscordAPIError(50013, 'Missing Permissions', 403);
    if (u.gone && action !== 'ban') throw new DiscordAPIError(10007, 'Unknown Member', 404);
    const why = opts.reason ? ` — alasan: ${opts.reason}` : '';
    if (action === 'kick') {
      u.gone = 'kick';
      SIM.system(`🚪 **${u.username}** dikeluarkan (kick) oleh bot${why}`);
      SIM.emit('guildMemberRemove', wrapMember(u));
    } else if (action === 'ban') {
      const wasMember = !u.gone;
      u.gone = 'ban'; u.banReason = opts.reason || null; u.timeoutUntil = 0;
      SIM.system(`🔨 **${u.username}** di-ban oleh bot${why}`);
      if (wasMember) SIM.emit('guildMemberRemove', wrapMember(u));
    } else if (action === 'timeout') {
      if (opts.ms == null || opts.ms <= 0) { u.timeoutUntil = 0; SIM.system(`🔈 Timeout **${u.username}** dicabut oleh bot`); }
      else {
        if (opts.ms > 28 * 864e5) throw new DiscordAPIError(50035, 'Invalid Form Body\ncommunication_disabled_until: Maksimal 28 hari.');
        u.timeoutUntil = SIM.vNow() + opts.ms;
        SIM.system(`🔇 **${u.username}** di-timeout ${Math.round(opts.ms / 60000)} menit oleh bot${why}`);
      }
    }
    SIM.hooks.render();
    return wrapMember(u);
  });

  SIM.unban = (u, reason) => attempt(() => {
    if (!u || u.gone !== 'ban') throw new DiscordAPIError(10026, 'Unknown Ban', 404);
    u.gone = 'unbanned'; u.banReason = null;
    SIM.system(`🔓 **${u.username}** di-unban oleh bot${reason ? ` — ${reason}` : ''}`);
    SIM.hooks.render();
    return wrapUser(u);
  });

  SIM.rejoin = (id, silent) => {
    const u = SIM.user(id);
    if (!u || !u.gone) return;
    if (u.gone === 'ban') { SIM.hooks.toast(`${u.username} masih di-ban`, 'User yang di-ban tidak bisa join lagi sampai di-unban.'); return; }
    delete u.gone;
    u.timeoutUntil = 0;
    if (!silent) SIM.system(`➡️ **${u.username}** bergabung ke server.`);
    SIM.hooks.render();
    if (!silent) SIM.emit('guildMemberAdd', wrapMember(u));
  };

  // user (kamu) ngirim pesan biasa
  SIM.userSay = (text) => {
    let content = text;
    const users = [...SIM.users].sort((a, b) => b.username.length - a.username.length);
    for (const u of users) content = content.replace(new RegExp(`@${u.username}\\b`, 'gi'), `<@${u.id}>`);
    for (const r of SIM.roles) content = content.replace(new RegExp(`@${r.name}\\b`, 'gi'), `<@&${r.id}>`);
    for (const c of SIM.channels) content = content.replace(new RegExp(`#${c.name}(?![\\w-])`, 'gi'), `<#${c.id}>`);
    SIM.post({ channelId: SIM.currentChannelId, authorId: SIM.currentUserId, content });
  };

  // --------------------------------------------------------- slash commands
  const OT = { Subcommand: 1, SubcommandGroup: 2, String: 3, Integer: 4, Boolean: 5, User: 6, Channel: 7, Role: 8, Mentionable: 9, Number: 10, Attachment: 11 };
  SIM.OPT_NAMES = Object.fromEntries(Object.entries(OT).map(([k, v]) => [v, k]));

  function toPlain(c) {
    const d = c && typeof c.toJSON === 'function' ? c.toJSON() : { ...c };
    if (d.options) d.options = d.options.map(toPlain);
    return d;
  }
  SIM.setCommands = (arr) => {
    SIM.commands = (arr || []).map(toPlain);
    SIM.log('sys', `✅ ${SIM.commands.length} slash command terdaftar: ${SIM.commands.map((c) => '/' + c.name).join(', ')}`);
    SIM.hooks.commands();
    SIM.hooks.render();
  };

  // semua kombinasi command (+subcommand) yang bisa diketik
  SIM.commandEntries = () => {
    const out = [];
    for (const c of SIM.commands) {
      const opts = c.options || [];
      const subs = opts.filter((o) => o.type === 1 || o.type === 2);
      if (!subs.length) { out.push({ path: c.name, desc: c.description, opts, cmd: c }); continue; }
      for (const s of subs) {
        if (s.type === 1) out.push({ path: `${c.name} ${s.name}`, desc: s.description, opts: s.options || [], cmd: c });
        else for (const ss of s.options || []) out.push({ path: `${c.name} ${s.name} ${ss.name}`, desc: ss.description, opts: ss.options || [], cmd: c });
      }
    }
    return out;
  };

  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function resolveUserText(raw) {
    raw = raw.trim();
    const m = raw.match(/^<@!?(\d+)>$/);
    if (m) return SIM.user(m[1]);
    const name = raw.replace(/^@/, '').toLowerCase();
    return SIM.users.find((u) => u.username.toLowerCase() === name) || SIM.users.find((u) => u.username.toLowerCase().startsWith(name));
  }
  function resolveChannelText(raw) {
    raw = raw.trim();
    const m = raw.match(/^<#(\d+)>$/);
    if (m) return SIM.channel(m[1]);
    const name = raw.replace(/^#/, '').toLowerCase();
    return SIM.channels.find((c) => c.name === name);
  }
  function resolveRoleText(raw) {
    raw = raw.trim();
    const m = raw.match(/^<@&(\d+)>$/);
    if (m) return SIM.role(m[1]);
    const name = raw.replace(/^@/, '').toLowerCase();
    return SIM.roles.find((r) => r.name.toLowerCase() === name);
  }

  function convertOpt(o, raw) {
    const v = raw.trim();
    switch (o.type) {
      case 3: {
        if (o.choices?.length) {
          const ch = o.choices.find((c) => String(c.name).toLowerCase() === v.toLowerCase() || String(c.value).toLowerCase() === v.toLowerCase());
          if (!ch) throw `Opsi \`${o.name}\` harus salah satu dari: ${o.choices.map((c) => c.name).join(', ')}`;
          return ch.value;
        }
        if (o.min_length && v.length < o.min_length) throw `Opsi \`${o.name}\` minimal ${o.min_length} karakter.`;
        if (o.max_length && v.length > o.max_length) throw `Opsi \`${o.name}\` maksimal ${o.max_length} karakter.`;
        return v;
      }
      case 4: case 10: {
        if (o.choices?.length) {
          const ch = o.choices.find((c) => String(c.name).toLowerCase() === v.toLowerCase() || String(c.value) === v);
          if (!ch) throw `Opsi \`${o.name}\` harus salah satu dari: ${o.choices.map((c) => c.name).join(', ')}`;
          return ch.value;
        }
        const n = o.type === 4 ? (/^-?\d+$/.test(v) ? parseInt(v, 10) : NaN) : parseFloat(v);
        if (Number.isNaN(n)) throw `Opsi \`${o.name}\` harus ${o.type === 4 ? 'bilangan bulat' : 'angka'}.`;
        if (o.min_value != null && n < o.min_value) throw `Opsi \`${o.name}\` minimal ${o.min_value}.`;
        if (o.max_value != null && n > o.max_value) throw `Opsi \`${o.name}\` maksimal ${o.max_value}.`;
        return n;
      }
      case 5: {
        if (/^(true|ya|yes|y|1|on)$/i.test(v)) return true;
        if (/^(false|tidak|no|n|0|off)$/i.test(v)) return false;
        throw `Opsi \`${o.name}\` harus true atau false.`;
      }
      case 6: { const u = resolveUserText(v); if (!u) throw `User "${v}" tidak ditemukan.`; return u.id; }
      case 7: { const c = resolveChannelText(v); if (!c) throw `Channel "${v}" tidak ditemukan.`; return c.id; }
      case 8: { const r = resolveRoleText(v); if (!r) throw `Role "${v}" tidak ditemukan.`; return r.id; }
      case 9: { const u = resolveUserText(v); if (u) return u.id; const r = resolveRoleText(v); if (r) return r.id; throw `"${v}" bukan user/role.`; }
      case 11: throw 'Opsi lampiran (attachment) belum didukung simulator.';
      default: return v;
    }
  }

  // cari command + subcommand dari kata-kata awal
  function locateCommand(words) {
    const cmd = SIM.commands.find((c) => c.name === words[0]);
    if (!cmd) return { notCommand: true };
    if (!SIM.ready) return { error: 'Bot belum online. Cek konsol (mungkin ada error atau lupa client.login()).' };
    const dmp = cmd.default_member_permissions;
    if (dmp && typeof dmp === 'string' && isNaN(+dmp) && !SIM.hasPerm(SIM.user(SIM.currentUserId), dmp)) {
      return { error: `Command /${cmd.name} disembunyikan untuk kamu (butuh izin ${dmp}). Ganti role di kiri bawah.` };
    }
    let idx = 1, group = null, sub = null, opts = cmd.options || [];
    const g = opts.find((o) => o.type === 2 && o.name === words[1]);
    if (g) { group = g.name; idx++; opts = g.options || []; }
    if (opts.some((o) => o.type === 1)) {
      const s = opts.find((o) => o.type === 1 && o.name === words[idx]);
      if (!s) return { error: `Pilih subcommand: ${opts.filter((o) => o.type === 1).map((o) => o.name).join(', ')}` };
      sub = s.name; idx++; opts = s.options || [];
    }
    return { cmd, group, sub, opts, idx };
  }
  // ubah nilai mentah (teks) per opsi jadi nilai bertipe, lalu kirim interaksi
  function finishSlash(loc, values) {
    const resolved = {};
    try {
      for (const o of loc.opts) {
        const raw = values[o.name];
        if (raw === undefined || raw === null || String(raw).trim() === '') {
          if (o.required) throw `Opsi \`${o.name}\` wajib diisi.`;
          continue;
        }
        resolved[o.name] = { name: o.name, type: o.type, value: convertOpt(o, String(raw)) };
      }
    } catch (e) { return { error: String(e) }; }
    SIM.fireCommand({ cmd: loc.cmd, group: loc.group, sub: loc.sub, options: resolved });
    return { ok: true };
  }

  // dari teks: "/mod warn member: @Riley reason: spam"
  SIM.runSlash = (text) => {
    const body = text.replace(/^\//, '').trim();
    const loc = locateCommand(body.split(/\s+/));
    if (loc.notCommand || loc.error) return loc;
    let rest = body;
    for (let i = 0; i < loc.idx; i++) rest = rest.replace(/^\S+\s*/, '');
    const values = {};
    if (loc.opts.length && rest) {
      const re = new RegExp(`(?:^|\\s)(${loc.opts.map((o) => escRe(o.name)).join('|')}):`, 'g');
      const hits = [...rest.matchAll(re)];
      if (!hits.length && loc.opts.length === 1) values[loc.opts[0].name] = rest;
      hits.forEach((h, i) => {
        const start = h.index + h[0].length;
        const end = i + 1 < hits.length ? hits[i + 1].index : rest.length;
        values[h[1]] = rest.slice(start, end).trim();
      });
    }
    return finishSlash(loc, values);
  };
  // dari composer slash (nilai per opsi sudah terpisah): SIM.runSlashEntry('mod warn', { member: '<@102>', reason: 'spam' })
  SIM.runSlashEntry = (path, values) => {
    const loc = locateCommand(path.split(' '));
    if (loc.notCommand) return { error: `Command /${path} tidak ada.` };
    if (loc.error) return loc;
    return finishSlash(loc, values);
  };

  function makeOptions(b) {
    const o = b.options || {};
    const need = (n, req) => {
      const v = o[n];
      if (!v && req) throw new DiscordjsError('CommandInteractionOptionNotFound', `Opsi "${n}" tidak ditemukan.`);
      return v || null;
    };
    return {
      data: Object.values(o),
      get: (n, r) => need(n, r),
      getString: (n, r) => { const v = need(n, r); return v ? String(v.value) : null; },
      getInteger: (n, r) => { const v = need(n, r); return v ? v.value : null; },
      getNumber: (n, r) => { const v = need(n, r); return v ? v.value : null; },
      getBoolean: (n, r) => { const v = need(n, r); return v ? v.value : null; },
      getUser: (n, r) => { const v = need(n, r); return v ? wrapUser(SIM.user(v.value)) : null; },
      getMember: (n) => { const v = o[n]; const u = v && SIM.user(v.value); return u && !u.gone ? wrapMember(u) : null; },
      getChannel: (n, r) => { const v = need(n, r); return v ? wrapChannel(SIM.channel(v.value)) : null; },
      getRole: (n, r) => { const v = need(n, r); return v ? wrapRole(SIM.role(v.value)) : null; },
      getMentionable: (n, r) => { const v = need(n, r); if (!v) return null; return SIM.user(v.value) ? wrapUser(SIM.user(v.value)) : wrapRole(SIM.role(v.value)); },
      getAttachment: () => null,
      getSubcommand: (req = true) => { if (!b.sub && req) throw new DiscordjsError('CommandInteractionOptionNoSubcommand', 'Tidak ada subcommand.'); return b.sub || null; },
      getSubcommandGroup: () => b.group || null,
      getFocused: () => '',
    };
  }

  function makeInteraction(kind, b) {
    const u = SIM.user(SIM.currentUserId);
    const channelId = b.channelId || SIM.currentChannelId;
    const fullName = kind === 'command' ? [b.cmd.name, b.group, b.sub].filter(Boolean).join(' ') : null;
    let replyRec = null;
    const it = {
      id: nextId(), type: kind === 'command' ? 2 : 3, applicationId: BOT_ID,
      commandName: b.cmd?.name ?? null, commandId: b.cmd?.id ?? null,
      customId: b.comp?.custom_id ?? null, componentType: b.comp ? 2 : null,
      user: wrapUser(u), member: wrapMember(u), channelId, guildId: GUILD_ID,
      get channel() { return wrapChannel(SIM.channel(channelId)); },
      get guild() { return wrapGuild(); },
      get client() { return SIM.client; },
      createdTimestamp: SIM.vNow(), locale: 'id', guildLocale: 'id',
      replied: false, deferred: false, ephemeral: null,
      message: b.message ? wrapMessage(b.message) : null,
      options: makeOptions(b),
      isChatInputCommand: () => kind === 'command', isCommand: () => kind === 'command',
      isButton: () => kind === 'button', isMessageComponent: () => kind === 'button',
      isStringSelectMenu: () => false, isAnySelectMenu: () => false, isAutocomplete: () => false,
      isModalSubmit: () => false, isContextMenuCommand: () => false, isRepliable: () => true,
      inGuild: () => true, inCachedGuild: () => true,
      reply(p) {
        return attempt(() => {
          if (this.replied || this.deferred) throw new DiscordjsError('InteractionAlreadyReplied', 'Interaksi ini sudah dibalas/di-defer. Pakai editReply() atau followUp().');
          const n = normalize(p);
          replyRec = SIM.post({
            channelId, authorId: BOT_ID, ...n,
            replyTo: kind === 'button' ? b.message.id : null,
            interaction: kind === 'command' ? { name: fullName, userId: u.id } : null,
            ephemeralFor: n.ephemeral ? u.id : null,
          });
          this.replied = true; this.ephemeral = n.ephemeral;
          const msg = wrapMessage(replyRec);
          return (p && (p.fetchReply || p.withResponse)) ? (p.withResponse ? { resource: { message: msg } } : msg)
            : { id: replyRec.id, interaction: this, fetch: () => Promise.resolve(msg), resource: { message: msg } };
        });
      },
      deferReply(o = {}) {
        return attempt(() => {
          if (this.replied || this.deferred) throw new DiscordjsError('InteractionAlreadyReplied', 'Interaksi ini sudah dibalas/di-defer.');
          const eph = normalize({ ...o, content: '.' }).ephemeral;
          replyRec = SIM.post({
            channelId, authorId: BOT_ID, thinking: true,
            interaction: kind === 'command' ? { name: fullName, userId: u.id } : null,
            replyTo: kind === 'button' ? b.message.id : null,
            ephemeralFor: eph ? u.id : null,
          });
          this.deferred = true; this.ephemeral = eph;
          return { id: replyRec.id, interaction: this };
        });
      },
      editReply(p) {
        return attempt(() => {
          if (!replyRec) throw new DiscordjsError('InteractionNotReplied', 'Belum ada balasan. Panggil reply() atau deferReply() dulu.');
          const n = normalize(p, true);
          const wasThinking = replyRec.thinking;
          if (wasThinking) { replyRec.content = ''; replyRec.embeds = []; replyRec.components = []; replyRec.v2 = false; }
          applyEdit(replyRec, n);
          replyRec.thinking = false; replyRec.edited = !wasThinking;
          SIM.hooks.render();
          return wrapMessage(replyRec);
        });
      },
      followUp(p) {
        return attempt(() => {
          if (!replyRec) throw new DiscordjsError('InteractionNotReplied', 'Belum ada balasan. Panggil reply() atau deferReply() dulu.');
          const n = normalize(p);
          return wrapMessage(SIM.post({ channelId, authorId: BOT_ID, ...n, replyTo: replyRec.id, ephemeralFor: n.ephemeral ? u.id : null }));
        });
      },
      deleteReply() { return attempt(() => { if (replyRec) SIM.remove(replyRec.id); }); },
      fetchReply() { return replyRec ? Promise.resolve(wrapMessage(replyRec)) : Promise.reject(new DiscordjsError('InteractionNotReplied', 'Belum ada balasan.')); },
      update(p) {
        return attempt(() => {
          if (kind !== 'button') throw new Error('update() hanya untuk interaksi tombol.');
          if (this.replied || this.deferred) throw new DiscordjsError('InteractionAlreadyReplied', 'Interaksi ini sudah dibalas.');
          const n = normalize(p, true);
          applyEdit(b.message, n); b.message.edited = true;
          this.replied = true; replyRec = b.message;
          SIM.hooks.render();
          return { interaction: this };
        });
      },
      deferUpdate() { return attempt(() => { this.deferred = true; replyRec = b.message; }); },
      showModal() { return Promise.reject(new Error('Modal belum didukung di simulator.')); },
      toString: () => (kind === 'command' ? '/' + fullName : `[button ${b.comp?.custom_id}]`),
    };
    return it;
  }

  function dispatch(it, label) {
    SIM.log('sys', `→ ${SIM.user(SIM.currentUserId).username} ${label}`);
    SIM.emit('interactionCreate', it);
    N.setTimeout(() => {
      if (!it.replied && !it.deferred) {
        SIM.post({
          channelId: it.channelId, authorId: BOT_ID, system: true, failed: true,
          content: 'Aplikasi tidak merespons',
          interaction: it.isChatInputCommand() ? { name: String(it).slice(1), userId: it.user.id } : null,
          ephemeralFor: it.user.id,
        });
        SIM.log('warn', `⚠ ${label} tidak dibalas dalam 3 detik. Lupa interaction.reply() / deferReply()?`);
      }
    }, 3000);
  }

  SIM.fireCommand = (b) => {
    const it = makeInteraction('command', b);
    const opts = Object.values(b.options).map((o) => `${o.name}:${o.value}`).join(' ');
    dispatch(it, `pakai ${String(it)}${opts ? ' ' + opts : ''}`);
  };

  SIM.clickButton = (rec, comp) => {
    if (comp.disabled) return;
    if (comp.style === 5) { window.open(comp.url, '_blank'); return; }
    if (!SIM.ready) { SIM.hooks.toast('Bot belum online', 'Cek konsol.'); return; }
    const it = makeInteraction('button', { message: rec, comp, channelId: rec.channelId });
    dispatch(it, `klik tombol "${comp.label || comp.emoji?.name || comp.custom_id}" (customId: ${comp.custom_id})`);
  };

  // --------------------------------------------------------- builders
  class EmbedBuilder {
    constructor(d = {}) { this.data = { ...(d.data || d) }; if (this.data.fields) this.data.fields = [...this.data.fields]; }
    static from(e) { return new EmbedBuilder(e?.data || e); }
    setTitle(t) { this.data.title = t; return this; }
    setDescription(t) { this.data.description = t; return this; }
    setURL(u) { this.data.url = u; return this; }
    setColor(c) { this.data.color = resolveColor(c); return this; }
    setAuthor(a) { this.data.author = a == null ? undefined : typeof a === 'string' ? { name: a } : { name: a.name, icon_url: a.iconURL || a.icon_url, url: a.url }; return this; }
    setFooter(f) { this.data.footer = f == null ? undefined : typeof f === 'string' ? { text: f } : { text: f.text, icon_url: f.iconURL || f.icon_url }; return this; }
    setTimestamp(t) { this.data.timestamp = t === null ? undefined : new RealDate(t instanceof RealDate ? t.getTime() : t ?? SIM.vNow()).toISOString(); return this; }
    setThumbnail(u) { this.data.thumbnail = u ? { url: u } : undefined; return this; }
    setImage(u) { this.data.image = u ? { url: u } : undefined; return this; }
    addFields(...f) {
      const list = f.flat();
      for (const x of list) if (x.value === undefined || x.value === '' || x.name === undefined || x.name === '') throw new DiscordjsError('EmbedFieldInvalid', `Field embed butuh name & value yang tidak kosong (dapat: ${JSON.stringify(x)})`);
      (this.data.fields ??= []).push(...list.map((x) => ({ name: String(x.name), value: String(x.value), inline: !!x.inline })));
      if (this.data.fields.length > 25) throw new DiscordjsError('EmbedFieldLimit', 'Maksimal 25 field per embed.');
      return this;
    }
    setFields(...f) { this.data.fields = []; return this.addFields(...f); }
    spliceFields(i, d, ...f) { (this.data.fields ??= []).splice(i, d, ...f.flat()); return this; }
    toJSON() { return JSON.parse(JSON.stringify(this.data)); }
  }

  const ButtonStyle = { Primary: 1, Secondary: 2, Success: 3, Danger: 4, Link: 5, Premium: 6 };
  class ButtonBuilder {
    constructor(d = {}) { this.data = { type: 2, ...(d.data || d) }; if (d.customId) this.data.custom_id = d.customId; }
    static from(c) { return new ButtonBuilder(c?.data || c); }
    setCustomId(id) { this.data.custom_id = id; return this; }
    setLabel(l) { this.data.label = l; return this; }
    setStyle(s) { this.data.style = typeof s === 'string' ? ButtonStyle[s] : s; return this; }
    setEmoji(e) { this.data.emoji = typeof e === 'string' ? { name: e } : e; return this; }
    setURL(u) { this.data.url = u; return this; }
    setDisabled(d = true) { this.data.disabled = d; return this; }
    toJSON() {
      if (!this.data.style) throw new DiscordjsError('ButtonStyle', 'Tombol butuh setStyle(ButtonStyle.xxx).');
      return { ...this.data };
    }
  }
  class ActionRowBuilder {
    constructor(d = {}) { this.data = { type: 1 }; this.components = (d.components || []).map((c) => (c.toJSON ? c : new ButtonBuilder(c))); }
    static from(r) { return new ActionRowBuilder({ components: (r.components || []).map((c) => ButtonBuilder.from(c)) }); }
    addComponents(...c) { this.components.push(...c.flat()); return this; }
    setComponents(...c) { this.components = c.flat(); return this; }
    toJSON() { return { type: 1, components: this.components.map(normAny) }; }
  }

  // ---------------- Components V2
  const SeparatorSpacingSize = { Small: 1, Large: 2 };
  const build = (Cls, x) => { if (typeof x !== 'function') return x; const b = new Cls(); return x(b) || b; };
  class TextDisplayBuilder {
    constructor(d = {}) { this.data = { type: 10, ...(d.data || d) }; }
    setContent(s) { this.data.content = s; return this; }
    toJSON() { return { ...this.data }; }
  }
  class ThumbnailBuilder {
    constructor(d = {}) { this.data = { type: 11, ...(d.data || d) }; }
    setURL(u) { this.data.media = { url: u }; return this; }
    setDescription(s) { this.data.description = s; return this; }
    setSpoiler(v = true) { this.data.spoiler = v; return this; }
    toJSON() { return { ...this.data }; }
  }
  class SeparatorBuilder {
    constructor(d = {}) { this.data = { type: 14, divider: true, spacing: 1, ...(d.data || d) }; }
    setDivider(v = true) { this.data.divider = v; return this; }
    setSpacing(s) { this.data.spacing = s; return this; }
    toJSON() { return { ...this.data }; }
  }
  class SectionBuilder {
    constructor() { this.components = []; this.accessory = null; }
    addTextDisplayComponents(...c) { this.components.push(...c.flat().map((x) => build(TextDisplayBuilder, x))); return this; }
    setButtonAccessory(b) { this.accessory = build(ButtonBuilder, b); return this; }
    setThumbnailAccessory(t) { this.accessory = build(ThumbnailBuilder, t); return this; }
    toJSON() { return { type: 9, components: this.components.map(normAny), accessory: this.accessory ? normAny(this.accessory) : undefined }; }
  }
  class MediaGalleryBuilder {
    constructor() { this.items = []; }
    addItems(...items) { this.items.push(...items.flat().map((i) => (typeof i === 'function' ? i({ data: {}, setURL(u) { this.data.media = { url: u }; return this; }, setDescription(d) { this.data.description = d; return this; } }).data : i.data || i))); return this; }
    toJSON() { return { type: 12, items: this.items }; }
  }
  class ContainerBuilder {
    constructor() { this.components = []; this.accent = undefined; this.spoiler = false; }
    setAccentColor(c) { this.accent = c == null ? undefined : resolveColor(c); return this; }
    clearAccentColor() { this.accent = undefined; return this; }
    setSpoiler(v = true) { this.spoiler = v; return this; }
    addTextDisplayComponents(...c) { this.components.push(...c.flat().map((x) => build(TextDisplayBuilder, x))); return this; }
    addSectionComponents(...c) { this.components.push(...c.flat().map((x) => build(SectionBuilder, x))); return this; }
    addSeparatorComponents(...c) { this.components.push(...c.flat().map((x) => build(SeparatorBuilder, x))); return this; }
    addActionRowComponents(...c) { this.components.push(...c.flat().map((x) => build(ActionRowBuilder, x))); return this; }
    addMediaGalleryComponents(...c) { this.components.push(...c.flat().map((x) => build(MediaGalleryBuilder, x))); return this; }
    toJSON() { return { type: 17, accent_color: this.accent, spoiler: this.spoiler, components: this.components.map(normAny) }; }
  }

  class OptionBuilder {
    constructor(type) { this.type = type; this.name = undefined; this.description = undefined; this.required = false; }
    setName(n) { this.name = n; return this; }
    setDescription(d) { this.description = d; return this; }
    setRequired(r = true) { this.required = r; return this; }
    addChoices(...c) { (this.choices ??= []).push(...c.flat()); return this; }
    setChoices(...c) { this.choices = c.flat(); return this; }
    setMinValue(v) { this.min_value = v; return this; }
    setMaxValue(v) { this.max_value = v; return this; }
    setMinLength(v) { this.min_length = v; return this; }
    setMaxLength(v) { this.max_length = v; return this; }
    setAutocomplete() { return this; }
    addChannelTypes() { return this; }
    setNameLocalizations() { return this; }
    setDescriptionLocalizations() { return this; }
    toJSON() {
      check(this.name, this.description, 'opsi');
      const o = { type: this.type, name: this.name, description: this.description, required: this.required };
      for (const k of ['choices', 'min_value', 'max_value', 'min_length', 'max_length']) if (this[k] !== undefined) o[k] = this[k];
      return o;
    }
  }
  function check(name, desc, what) {
    if (!name || !/^[-_\p{Ll}\p{N}]{1,32}$/u.test(name)) throw new DiscordjsError('CommandName', `Nama ${what} "${name}" tidak valid: harus huruf kecil, tanpa spasi, maks 32 karakter.`);
    if (!desc || desc.length > 100) throw new DiscordjsError('CommandDescription', `Deskripsi ${what} "${name}" wajib diisi (1-100 karakter).`);
  }
  function addOptionAdders(proto) {
    for (const [key, type] of Object.entries(OT)) {
      if (type <= 2) continue;
      proto[`add${key}Option`] = function (fn) {
        const o = new OptionBuilder(type);
        const r = typeof fn === 'function' ? fn(o) : fn;
        this.options.push(r || o);
        return this;
      };
    }
  }
  class SlashCommandSubcommandBuilder {
    constructor() { this.type = 1; this.options = []; }
    setName(n) { this.name = n; return this; }
    setDescription(d) { this.description = d; return this; }
    toJSON() { check(this.name, this.description, 'subcommand'); return { type: 1, name: this.name, description: this.description, options: this.options.map((o) => (o.toJSON ? o.toJSON() : o)) }; }
  }
  addOptionAdders(SlashCommandSubcommandBuilder.prototype);
  class SlashCommandSubcommandGroupBuilder {
    constructor() { this.type = 2; this.options = []; }
    setName(n) { this.name = n; return this; }
    setDescription(d) { this.description = d; return this; }
    addSubcommand(fn) { const s = new SlashCommandSubcommandBuilder(); this.options.push((typeof fn === 'function' ? fn(s) : fn) || s); return this; }
    toJSON() { check(this.name, this.description, 'grup subcommand'); return { type: 2, name: this.name, description: this.description, options: this.options.map((o) => o.toJSON()) }; }
  }
  class SlashCommandBuilder {
    constructor() { this.options = []; }
    setName(n) { this.name = n; return this; }
    setDescription(d) { this.description = d; return this; }
    setDefaultMemberPermissions(p) { this.default_member_permissions = p == null ? undefined : String(p); return this; }
    setDMPermission() { return this; }
    setContexts() { return this; }
    setIntegrationTypes() { return this; }
    setNSFW() { return this; }
    setNameLocalizations() { return this; }
    setDescriptionLocalizations() { return this; }
    addSubcommand(fn) { const s = new SlashCommandSubcommandBuilder(); this.options.push((typeof fn === 'function' ? fn(s) : fn) || s); return this; }
    addSubcommandGroup(fn) { const s = new SlashCommandSubcommandGroupBuilder(); this.options.push((typeof fn === 'function' ? fn(s) : fn) || s); return this; }
    toJSON() {
      check(this.name, this.description, 'command');
      return { name: this.name, description: this.description, default_member_permissions: this.default_member_permissions, options: this.options.map((o) => (o.toJSON ? o.toJSON() : o)) };
    }
  }
  addOptionAdders(SlashCommandBuilder.prototype);

  // --------------------------------------------------------- Client
  const Events = {
    ClientReady: 'clientReady', MessageCreate: 'messageCreate', MessageDelete: 'messageDelete', MessageUpdate: 'messageUpdate',
    InteractionCreate: 'interactionCreate', MessageReactionAdd: 'messageReactionAdd', MessageReactionRemove: 'messageReactionRemove',
    GuildMemberAdd: 'guildMemberAdd', GuildMemberRemove: 'guildMemberRemove', Error: 'error', Warn: 'warn', Debug: 'debug',
  };

  class Client {
    constructor(opts = {}) {
      this.options = opts; this._l = {}; this.user = null; this.readyAt = null; this.ws = { ping: 42, status: 0 };
      SIM.client = this;
      const self = this;
      this.application = {
        id: BOT_ID,
        commands: {
          set: (arr) => attempt(() => { SIM.setCommands(arr); return coll(SIM.commands.map((c, i) => ({ id: 'cmd' + i, ...c }))); }),
          create: (c) => attempt(() => { SIM.setCommands([...SIM.commands, c]); return c; }),
          fetch: () => Promise.resolve(coll(SIM.commands.map((c, i) => ({ id: 'cmd' + i, ...c })))),
        },
        fetch() { return Promise.resolve(self.application); },
      };
    }
    on(e, f) { (this._l[e] ??= []).push({ f }); return this; }
    addListener(e, f) { return this.on(e, f); }
    once(e, f) { (this._l[e] ??= []).push({ f, once: true }); return this; }
    off(e, f) { this._l[e] = (this._l[e] || []).filter((l) => l.f !== f); return this; }
    removeListener(e, f) { return this.off(e, f); }
    removeAllListeners(e) { if (e) delete this._l[e]; else this._l = {}; return this; }
    listenerCount(e) { return (this._l[e] || []).length; }
    emit(e, ...a) {
      const ls = this._l[e];
      if (!ls || !ls.length) return false;
      for (const l of [...ls]) {
        if (l.once) this._l[e] = this._l[e].filter((x) => x !== l);
        try {
          const r = l.f.apply(this, a);
          if (r && typeof r.catch === 'function') r.catch((err) => SIM.error(err, `event "${e}"`));
        } catch (err) { SIM.error(err, `event "${e}"`); }
      }
      return true;
    }
    get guilds() { return { cache: new Collection([[GUILD_ID, wrapGuild()]]), fetch: (id) => Promise.resolve(id ? wrapGuild() : new Collection([[GUILD_ID, wrapGuild()]])) }; }
    get channels() { return { cache: coll(SIM.channels.map(wrapChannel)), fetch: (id) => { const c = SIM.channel(id); return c ? Promise.resolve(wrapChannel(c)) : Promise.reject(new DiscordAPIError(10003, 'Unknown Channel', 404)); } }; }
    get users() { return { cache: coll(SIM.users.map(wrapUser)), fetch: (id) => { const u = SIM.user(id); return u ? Promise.resolve(wrapUser(u)) : Promise.reject(new DiscordAPIError(10013, 'Unknown User', 404)); } }; }
    get uptime() { return this.readyAt ? SIM.vNow() - this.readyAt.getTime() : null; }
    isReady() { return SIM.ready; }
    login(token) {
      if (!token) return Promise.reject(new DiscordjsError('TokenMissing', 'Token kosong. Di simulator, process.env.TOKEN sudah diisi otomatis — cek nama variabelnya.'));
      if (this._loggingIn) return Promise.resolve(token);
      this._loggingIn = true;
      SIM.log('sys', '🔌 Menghubungkan bot…');
      return new Promise((res) => N.setTimeout(() => {
        this.user = wrapUser(SIM.user(BOT_ID));
        this.user.setActivity = () => {}; this.user.setPresence = () => {}; this.user.setStatus = () => {};
        this.readyAt = new RealDate(SIM.vNow());
        SIM.ready = true;
        SIM.hooks.render();
        SIM.log('sys', '🟢 Bot online.');
        this.emit('ready', this);
        this.emit('clientReady', this);
        res(token);
      }, 400));
    }
    destroy() { SIM.ready = false; SIM.hooks.render(); return Promise.resolve(); }
  }

  class REST {
    constructor() {}
    setToken() { return this; }
    put(route, opts = {}) { return attempt(() => { if (String(route).includes('/commands')) SIM.setCommands(opts.body); return (opts.body || []).map(toPlain); }); }
    post(route, opts = {}) { return attempt(() => { if (String(route).includes('/commands')) SIM.setCommands([...SIM.commands, opts.body]); return opts.body; }); }
    get(route) { return Promise.resolve(String(route).includes('/commands') ? SIM.commands : null); }
    delete() { return Promise.resolve(); }
    patch() { return Promise.resolve(); }
  }
  const Routes = {
    applicationCommands: (app) => `/applications/${app}/commands`,
    applicationGuildCommands: (app, g) => `/applications/${app}/guilds/${g}/commands`,
    applicationCommand: (app, id) => `/applications/${app}/commands/${id}`,
    applicationGuildCommand: (app, g, id) => `/applications/${app}/guilds/${g}/commands/${id}`,
  };

  const anyName = () => new Proxy({}, { get: (_, k) => (typeof k === 'string' ? k : undefined) });
  const anyNum = () => new Proxy({}, { get: (_, k) => (typeof k === 'string' ? 1 : undefined) });

  const Discord = {
    Client, Collection, Events, REST, Routes, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder,
    SlashCommandBuilder, SlashCommandSubcommandBuilder, SlashCommandSubcommandGroupBuilder,
    GatewayIntentBits: anyNum(), IntentsBitField: { Flags: anyNum() }, Partials: anyName(),
    PermissionFlagsBits: anyName(), PermissionsBitField: { Flags: anyName() },
    ContainerBuilder, TextDisplayBuilder, SectionBuilder, SeparatorBuilder, SeparatorSpacingSize, ThumbnailBuilder, MediaGalleryBuilder,
    ApplicationCommandOptionType: OT,
    ComponentType: { ActionRow: 1, Button: 2, StringSelect: 3, Section: 9, TextDisplay: 10, Thumbnail: 11, MediaGallery: 12, File: 13, Separator: 14, Container: 17 },
    InteractionType: { ApplicationCommand: 2, MessageComponent: 3 }, ChannelType: { GuildText: 0, DM: 1, GuildVoice: 2 },
    ActivityType: { Playing: 0, Streaming: 1, Listening: 2, Watching: 3, Custom: 4, Competing: 5 },
    MessageFlags: { Ephemeral: 64, SuppressEmbeds: 4, SuppressNotifications: 4096, IsComponentsV2: 32768 }, Colors: COLORS, DiscordAPIError,
    time: (d, style) => `<t:${Math.floor((d instanceof RealDate ? d.getTime() : (d ?? SIM.vNow())) / 1000)}${style ? ':' + style : ''}>`,
    userMention: (id) => `<@${id}>`, channelMention: (id) => `<#${id}>`, roleMention: (id) => `<@&${id}>`,
    bold: (s) => `**${s}**`, italic: (s) => `*${s}*`, inlineCode: (s) => '`' + s + '`', codeBlock: (l, s) => '```' + (s === undefined ? '\n' + l : l + '\n' + s) + '\n```',
    version: '14-simulator',
  };
  Discord.TimestampStyles = { ShortTime: 't', LongTime: 'T', ShortDate: 'd', LongDate: 'D', ShortDateTime: 'f', LongDateTime: 'F', RelativeTime: 'R' };
  window.Discord = Discord;

  // --------------------------------------------------------- require / process
  // fs tiruan: file disimpan di localStorage browser (tetap ada setelah Restart bot)
  const normPath = (p) => String(p).replace(/\\/g, '/').replace(/\/+/g, '/');
  const fsKey = (p) => FS_PREFIX + normPath(p);
  const enoent = (p) => Object.assign(new Error(`ENOENT: no such file or directory, open '${p}'`), { code: 'ENOENT' });
  const fs = {
    existsSync: (p) => LS.get(fsKey(p)) !== null || LS.keys().some((k) => k.startsWith(fsKey(p) + '/')),
    readFileSync: (p) => { const v = LS.get(fsKey(p)); if (v === null) throw enoent(p); return v; },
    writeFileSync: (p, d) => { LS.set(fsKey(p), String(d)); },
    appendFileSync: (p, d) => { LS.set(fsKey(p), (LS.get(fsKey(p)) || '') + String(d)); },
    mkdirSync: () => undefined,
    renameSync: (a, b) => { const v = fs.readFileSync(a); LS.set(fsKey(b), v); LS.del(fsKey(a)); },
    unlinkSync: (p) => { if (LS.get(fsKey(p)) === null) throw enoent(p); LS.del(fsKey(p)); },
  };
  fs.promises = {
    readFile: async (p, e) => fs.readFileSync(p, e), writeFile: async (p, d) => fs.writeFileSync(p, d),
    mkdir: async () => undefined, rename: async (a, b) => fs.renameSync(a, b), unlink: async (p) => fs.unlinkSync(p),
    access: async (p) => { if (!fs.existsSync(p)) throw enoent(p); },
  };
  const path = {
    sep: '/',
    join: (...a) => normPath(a.filter((x) => x !== '').join('/')),
    resolve: (...a) => normPath(a.join('/')),
    dirname: (p) => normPath(p).replace(/\/[^/]*$/, '') || '/',
    basename: (p, ext) => { const b = normPath(p).split('/').pop(); return ext && b.endsWith(ext) ? b.slice(0, -ext.length) : b; },
    extname: (p) => (normPath(p).match(/\.[^./]+$/) || [''])[0],
  };
  window.__dirname = '/bot';
  window.__filename = '/bot/bot.js';

  const modules = {
    'discord.js': Discord,
    dotenv: { config: () => ({ parsed: SIM.env }) },
    'dotenv/config': {},
    fs, 'node:fs': fs, 'fs/promises': fs.promises, 'node:fs/promises': fs.promises,
    path, 'node:path': path,
  };
  window.require = (name) => {
    if (name in modules) return modules[name];
    throw new Error(`Modul "${name}" tidak tersedia di simulator. Yang ada: ${Object.keys(modules).join(', ')}`);
  };
  window.process = { env: SIM.env, on() {}, exit() { SIM.log('warn', 'process.exit() dipanggil (diabaikan di simulator).'); }, argv: [], platform: 'browser' };
  window.module = { exports: {} };
  window.exports = window.module.exports;
})();
