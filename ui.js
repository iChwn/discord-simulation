/* Discord Bot Simulator — tampilan (UI). Nggak perlu diubah. */
(function () {
  'use strict';
  const S = window.SIM, N = S.native;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n) => String(n).padStart(2, '0');
  const hex = (n) => '#' + (n >>> 0).toString(16).padStart(6, '0').slice(-6);

  const el = {
    channels: $('#channels'), dm: $('#dm-channel'), me: $('#me'), roles: $('#roles'),
    chName: $('#ch-name'), chTopic: $('#ch-topic'), messages: $('#messages'), quick: $('#quick'),
    input: $('#input'), composer: $('#composer'), popup: $('#popup'), hint: $('#hint'),
    members: $('#members'), clock: $('#clock'), consoleBox: $('#console'), consoleLines: $('#console-lines'),
    errBadge: $('#err-badge'), typing: $('#typing'), toasts: $('#toasts'),
  };

  // --------------------------------------------------------------- helpers
  const me = () => S.user(S.currentUserId);
  const topRole = (u) => S.roles.find((r) => u.roles.includes(r.id));
  const nameColor = (u) => (u.bot ? 'var(--head)' : topRole(u)?.color || 'var(--head)');
  const isTimedOut = (u) => u.timeoutUntil > S.vNow();
  const goneLabel = (u) => ({ ban: 'di-ban', kick: 'dikick', unbanned: 'di-unban' }[u.gone] || 'keluar');
  function fmtTime(ts) {
    const d = new Date(ts), now = new Date();
    const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const sameDay = (a, b) => a.toDateString() === b.toDateString();
    if (sameDay(d, now)) return `Hari ini pukul ${hm}`;
    const y = new Date(now.getTime() - 864e5);
    if (sameDay(d, y)) return `Kemarin pukul ${hm}`;
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${hm}`;
  }
  const hm = (ts) => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  function relTime(ms) {
    const diff = ms - S.vNow(), a = Math.abs(diff);
    const unit = a < 6e4 ? [Math.round(a / 1e3), 'detik'] : a < 36e5 ? [Math.round(a / 6e4), 'menit'] : a < 864e5 ? [Math.round(a / 36e5), 'jam'] : [Math.round(a / 864e5), 'hari'];
    return diff >= 0 ? `dalam ${unit[0]} ${unit[1]}` : `${unit[0]} ${unit[1]} yang lalu`;
  }

  // markdown ala Discord
  function md(src) {
    let s = esc(src);
    const blocks = [];
    s = s.replace(/```(?:[\w+-]*\n)?([\s\S]*?)```/g, (_, c) => { blocks.push(`<pre><code>${c.replace(/^\n|\n$/g, '')}</code></pre>`); return `\u0000${blocks.length - 1}\u0000`; });
    s = s.replace(/`([^`\n]+)`/g, (_, c) => { blocks.push(`<code>${c}</code>`); return `\u0000${blocks.length - 1}\u0000`; });
    s = s.replace(/^### (.+)$/gm, '<span class="h3">$1</span>').replace(/^## (.+)$/gm, '<span class="h2">$1</span>').replace(/^# (.+)$/gm, '<span class="h1">$1</span>');
    s = s.replace(/^-# (.+)$/gm, '<span class="subtext">$1</span>');
    s = s.replace(/^[-*] (.+)$/gm, '<span class="li">$1</span>');
    s = s.replace(/^&gt; (.*)$/gm, '<span class="quote">$1</span>');
    s = s.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/__(.+?)__/g, '<u>$1</u>')
      .replace(/(^|[^*])\*(?!\s)(.+?)\*/g, '$1<i>$2</i>').replace(/(^|\W)_(?!\s)(.+?)_(?=\W|$)/g, '$1<i>$2</i>')
      .replace(/~~(.+?)~~/g, '<s>$1</s>').replace(/\|\|(.+?)\|\|/g, '<span class="spoiler">$1</span>');
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    s = s.replace(/(^|[\s(])(https?:\/\/[^\s<]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
    s = s.replace(/&lt;@!?(\d+)&gt;/g, (_, id) => `<span class="mention">@${esc(S.user(id)?.username || 'unknown-user')}</span>`);
    s = s.replace(/&lt;@&amp;(\d+)&gt;/g, (_, id) => { const r = S.role(id); return r ? `<span class="mention" style="color:${r.color};background:${r.color}26">@${esc(r.name)}</span>` : '@deleted-role'; });
    s = s.replace(/&lt;#(\d+)&gt;/g, (_, id) => `<span class="mention" data-ch="${id}">#${esc(S.channel(id)?.name || 'unknown')}</span>`);
    s = s.replace(/@(everyone|here)\b/g, '<span class="mention">@$1</span>');
    s = s.replace(/&lt;t:(\d+)(?::([tTdDfFR]))?&gt;/g, (_, t, st) => {
      const ms = +t * 1000, d = new Date(ms);
      const txt = st === 'R' ? relTime(ms) : st === 't' ? hm(ms) : st === 'd' || st === 'D' ? d.toLocaleDateString('id-ID') : d.toLocaleString('id-ID');
      return `<span class="ts">${txt}</span>`;
    });
    s = s.replace(/\n/g, '<br>');
    s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => blocks[+i]);
    return s;
  }

  // --------------------------------------------------------------- render
  let renderQueued = false;
  S.hooks.render = () => { if (!renderQueued) { renderQueued = true; requestAnimationFrame(renderAll); } };
  let forceBottom = true;

  function renderAll() {
    renderQueued = false;
    renderChannels(); renderMe(); renderMembers(); renderMessages(); renderComposerState();
  }

  function renderChannels() {
    el.channels.innerHTML = S.channels.map((c) => {
      const u = S.unread[c.id];
      return `<div class="ch ${c.id === S.currentChannelId ? 'active' : ''}" data-ch="${c.id}"><span class="ico">#</span>${esc(c.name)}${u ? `<span class="unread">${u}</span>` : ''}</div>`;
    }).join('');
    const myName = me().username;
    if (S.currentChannelId === 'dm') S.unread[`dm:${S.currentUserId}`] = 0; // sedang dibuka = sudah dibaca
    const u = S.unread[`dm:${S.currentUserId}`];
    el.dm.innerHTML = `<div class="ch ${S.currentChannelId === 'dm' ? 'active' : ''}" data-ch="dm" title="DM dari bot ke ${esc(myName)}"><span class="ico">📩</span>DM dari bot${u ? `<span class="unread">${u}</span>` : ''}</div>`;
    const c = S.channel(S.currentChannelId);
    el.chName.textContent = c ? c.name : `DM dari bot ke ${myName}`;
    el.chTopic.textContent = c ? c.topic : `Pesan yang dikirim bot ke ${myName} lewat user.send() / member.send()`;
    $('.ch-title .hash').textContent = c ? '#' : '📩';
  }

  function renderMe() {
    const u = me();
    const status = u.gone ? `⛔ Sudah ${goneLabel(u)}` : isTimedOut(u) ? `🔇 Timeout s/d ${hm(u.timeoutUntil)}` : 'Online';
    el.me.innerHTML = `<div class="me-top"><div class="av-wrap"><img class="av av-s" src="${S.avatarURL(u)}"><span class="online ${isTimedOut(u) ? 'timeout' : ''}"></span></div>
      <div class="who"><div class="name" style="color:${nameColor(u)}">${esc(u.username)}${u.owner ? ' 👑' : ''}</div><div class="status">${status}</div></div>
      <select id="me-select" title="Ganti user">${S.users.filter((x) => !x.bot).map((x) => `<option value="${x.id}" ${x.id === u.id ? 'selected' : ''}>${esc(x.username)}</option>`).join('')}</select></div>
      <label class="dm-toggle" title="Simulasi member yang menutup DM: user.send() dari bot akan gagal"><input type="checkbox" id="dm-closed" ${u.dmClosed ? 'checked' : ''}> DM ${esc(u.username)} tertutup</label>`;
    el.roles.innerHTML = S.roles.map((r) => `<button class="role-chip ${u.roles.includes(r.id) ? 'on' : ''}" data-role="${r.id}" style="${u.roles.includes(r.id) ? `color:${r.color}` : ''}"><span class="dot" style="color:${r.color}"></span><span style="color:var(--text)">${esc(r.name)}</span></button>`).join('');
  }

  function memberRow(u) {
    const cur = u.id === S.currentUserId;
    return `<div class="mem ${cur ? 'current' : ''} ${u.gone ? 'gone' : ''}" data-user="${u.id}" title="${u.gone === 'ban' ? 'Masih di-ban' : u.gone ? 'Klik untuk join lagi' : u.bot ? 'Bot kamu' : 'Klik untuk testing sebagai ' + esc(u.username)}">
      <div class="av-wrap"><img class="av av-s" src="${S.avatarURL(u)}">${u.gone ? '' : `<span class="online ${isTimedOut(u) ? 'timeout' : ''}"></span>`}</div>
      <div style="min-width:0"><div class="mname" style="color:${nameColor(u)}">${esc(u.username)}</div>${u.gone ? `<div class="sub">${goneLabel(u)}${u.gone === 'ban' ? '' : ' · klik untuk join'}</div>` : isTimedOut(u) ? `<div class="sub">timeout s/d ${hm(u.timeoutUntil)}</div>` : u.bot && !S.ready ? '<div class="sub">offline</div>' : ''}</div>
      ${u.owner ? '<span class="crown">👑</span>' : ''}${u.bot ? '<span class="app-badge">APP</span>' : ''}${cur ? '<span class="check">✓</span>' : ''}</div>`;
  }
  function renderMembers() {
    const present = S.users.filter((u) => !u.gone);
    const gone = S.users.filter((u) => u.gone);
    el.members.innerHTML = `<div class="mem-label">ONLINE — ${present.length}</div>${present.map(memberRow).join('')}` +
      (gone.length ? `<div class="mem-label" style="margin-top:14px">KELUAR — ${gone.length}</div>${gone.map(memberRow).join('')}` : '');
  }

  function renderEmbed(e) {
    const color = e.color != null ? hex(e.color) : '#1e1f22';
    const fields = (e.fields || []).map((f) => `<div class="e-field ${f.inline ? 'inline' : ''}"><div class="e-fname">${md(f.name)}</div><div class="e-fval">${md(f.value)}</div></div>`).join('');
    const foot = [e.footer?.text && esc(e.footer.text), e.timestamp && fmtTime(Date.parse(e.timestamp))].filter(Boolean).join(' • ');
    return `<div class="embed" style="border-left-color:${color}"><div class="e-main">
      ${e.author?.name ? `<div class="e-author">${e.author.icon_url ? `<img src="${esc(e.author.icon_url)}">` : ''}${esc(e.author.name)}</div>` : ''}
      ${e.title ? `<div class="e-title">${e.url ? `<a href="${esc(e.url)}" target="_blank">${md(e.title)}</a>` : md(e.title)}</div>` : ''}
      ${e.description ? `<div class="e-desc">${md(e.description)}</div>` : ''}
      ${fields ? `<div class="e-fields">${fields}</div>` : ''}
      ${e.image?.url ? `<img class="e-image" src="${esc(e.image.url)}">` : ''}
      ${foot ? `<div class="e-footer">${e.footer?.icon_url ? `<img src="${esc(e.footer.icon_url)}">` : ''}${foot}</div>` : ''}
    </div>${e.thumbnail?.url ? `<img class="e-thumb" src="${esc(e.thumbnail.url)}">` : ''}</div>`;
  }

  // urutan tombol harus sama dengan SIM.buttonsOf()
  function renderComponents(rec) {
    const ctx = { i: 0 };
    const button = (c) => {
      const emoji = c.emoji ? (c.emoji.name || '') : '';
      return `<button class="dbtn s${c.style || 2}" data-btn="${rec.id}:${ctx.i++}" ${c.disabled ? 'disabled' : ''}>${esc(emoji)}${c.label ? `<span>${esc(c.label)}</span>` : ''}${c.style === 5 ? ' ↗' : ''}</button>`;
    };
    const node = (c) => {
      switch (c.type) {
        case 1: return `<div class="row">${c.components.map(button).join('')}</div>`;
        case 2: return button(c);
        case 10: return `<div class="v2-text">${md(c.content)}</div>`;
        case 9: {
          const texts = c.components.map(node).join('');
          const acc = c.accessory?.type === 11 ? `<img class="v2-thumb" src="${esc(c.accessory.media?.url)}">` : c.accessory ? button(c.accessory) : '';
          return `<div class="v2-section"><div class="v2-texts">${texts}</div><div class="v2-acc">${acc}</div></div>`;
        }
        case 11: return `<img class="v2-thumb" src="${esc(c.media?.url)}">`;
        case 12: return `<div class="v2-gallery">${c.items.map((it) => `<img src="${esc(it.media?.url)}">`).join('')}</div>`;
        case 14: return `<div class="v2-sep ${c.divider === false ? 'nodiv' : ''} ${c.spacing === 2 ? 'large' : ''}"></div>`;
        case 17: return `<div class="v2-container" style="${c.accent_color != null ? `border-left-color:${hex(c.accent_color)}` : ''}">${c.components.map(node).join('')}</div>`;
        default: return '';
      }
    };
    const html = rec.components.map(node).join('');
    return rec.v2 ? `<div class="v2">${html}</div>` : html;
  }

  function snippet(rec) {
    if (!rec) return '<i>Pesan asli sudah dihapus</i>';
    const raw = rec.content || (rec.embeds.length ? '🖼 Klik untuk lihat lampiran' : S.textOf(rec)) || '…';
    const t = raw
      .replace(/<@!?(\d+)>/g, (_, id) => '@' + (S.user(id)?.username || '?'))
      .replace(/<@&(\d+)>/g, (_, id) => '@' + (S.role(id)?.name || '?'))
      .replace(/<#(\d+)>/g, (_, id) => '#' + (S.channel(id)?.name || '?'))
      .replace(/<t:(\d+)(?::\w)?>/g, (_, s) => hm(+s * 1000))
      .replace(/^-# /gm, '').replace(/[#*_`>]/g, '').replace(/\s+/g, ' ').trim();
    return esc(t.slice(0, 120));
  }

  function renderMessages() {
    const box = el.messages;
    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
    const prevTop = box.scrollTop;
    const cur = S.currentChannelId;
    const list = S.records.filter((r) => r.channelId === cur && (!r.ephemeralFor || r.ephemeralFor === S.currentUserId) && (cur !== 'dm' || r.dmTo === S.currentUserId));
    const ch = S.channel(cur);
    let html = '<div class="fill"></div>';
    html += ch
      ? `<div class="welcome"><div class="big">#</div><h1>Selamat datang di #${esc(ch.name)}!</h1><p>Ini awal channel #${esc(ch.name)}. ${S.ready ? 'Bot sudah online.' : 'Menunggu bot online…'}</p></div>`
      : `<div class="welcome"><div class="big">📩</div><h1>DM dari bot ke ${esc(me().username)}</h1><p>Cuma DM untuk <b>${esc(me().username)}</b> yang muncul di sini. Ganti user di kiri bawah untuk lihat DM user lain.</p></div>`;
    let prev = null;
    for (const r of list) {
      if (r.system && !r.failed) {
        html += `<div class="sysmsg">${md(r.content)}<span class="time">${fmtTime(r.ts)}</span></div>`;
        prev = null; continue;
      }
      const u = S.user(r.authorId) || { username: '?', color: '#555', roles: [] };
      const replied = r.replyTo ? S.records.find((x) => x.id === r.replyTo) : null;
      const hasHead = !!(r.interaction || r.replyTo);
      const grouped = prev && !hasHead && prev.authorId === r.authorId && r.ts - prev.ts < 5 * 60e3 && !prev.ephemeralFor && !r.ephemeralFor && !r.dmTo;
      const mentioned = r.content && (new RegExp(`<@!?${S.currentUserId}>`).test(r.content) || /@(everyone|here)/.test(r.content) || S.user(S.currentUserId).roles.some((id) => r.content.includes(`<@&${id}>`)) || (replied && replied.authorId === S.currentUserId && r.authorId !== S.currentUserId));
      html += `<div class="msg ${grouped ? '' : 'first'} ${hasHead ? 'has-head' : ''} ${mentioned ? 'mentioned' : ''}" data-id="${r.id}">`;
      if (r.interaction) {
        const iu = S.user(r.interaction.userId);
        html += `<div class="reply-head"><img class="av av-xs" style="position:static" src="${S.avatarURL(iu)}"><span class="rname" style="color:${nameColor(iu)}">${esc(iu.username)}</span> menggunakan <span class="cmd">/${esc(r.interaction.name)}</span></div>`;
      } else if (r.replyTo) {
        const ru = replied ? S.user(replied.authorId) : null;
        html += `<div class="reply-head">${ru ? `<img class="av av-xs" style="position:static" src="${S.avatarURL(ru)}"><span class="rname" style="color:${nameColor(ru)}">@${esc(ru.username)}</span>` : ''}<span class="snip" data-jump="${r.replyTo}">${snippet(replied)}</span></div>`;
      }
      if (grouped) html += `<span class="side-time">${hm(r.ts)}</span>`;
      else html += `<img class="av" src="${S.avatarURL(u)}"><div class="head"><span class="name" style="color:${nameColor(u)}">${esc(u.username)}</span>${u.bot ? '<span class="app-badge">APP</span>' : ''}<span class="time">${fmtTime(r.ts)}</span></div>`;
      if (r.thinking) html += `<div class="content thinking">${esc(u.username)} sedang berpikir<span class="dots"><span>.</span><span>.</span><span>.</span></span></div>`;
      else if (r.failed) html += `<div class="content failed">❗ ${esc(r.content)}</div>`;
      else if (r.content) html += `<div class="content">${md(r.content)}${r.edited ? '<span class="edited">(diedit)</span>' : ''}</div>`;
      html += r.embeds.map(renderEmbed).join('');
      html += renderComponents(r);
      if (r.reactions.length) html += `<div class="reactions">${r.reactions.map((x) => `<span class="reaction ${x.users.includes(S.currentUserId) ? 'mine' : ''}" data-react="${r.id}" data-emoji="${esc(x.emoji)}" title="${esc(x.users.map((id) => S.user(id)?.username).join(', '))}">${esc(x.emoji)} <b>${x.users.length}</b></span>`).join('')}</div>`;
      if (r.ephemeralFor) html += `<div class="eph-note">👁 Hanya kamu yang bisa melihat ini • <a data-dismiss="${r.id}">Tutup pesan</a></div>`;
      if (!r.thinking && !r.failed && !r.ephemeralFor && r.channelId !== 'dm') {
        html += `<div class="msg-tools"><button data-qr="${r.id}" data-e="👍" title="Reaksi">👍</button><button data-qr="${r.id}" data-e="😂" title="Reaksi">😂</button><button data-qr="${r.id}" data-e="❤️" title="Reaksi">❤️</button><button data-del="${r.id}" title="Hapus pesan">🗑</button></div>`;
      }
      html += '</div>';
      prev = r;
    }
    box.innerHTML = html;
    if (forceBottom || atBottom) box.scrollTop = box.scrollHeight;
    else box.scrollTop = prevTop;
    forceBottom = false;
  }

  function renderComposerState() {
    const u = me();
    const ch = S.channel(S.currentChannelId);
    let block = '';
    if (!ch) block = 'Ini cuma kotak masuk DM dari bot — pindah ke channel buat ngetik.';
    else if (u.gone) block = u.gone === 'ban' ? `${u.username} sedang di-ban.` : `${u.username} sudah ${goneLabel(u)}. Klik namanya di daftar member untuk join lagi.`;
    else if (isTimedOut(u)) block = `${u.username} sedang di-timeout sampai ${hm(u.timeoutUntil)} — majukan waktu atau ganti user.`;
    if (block && sc) exitSlash(false);
    el.input.disabled = !!block;
    el.composer.classList.toggle('disabled', !!block);
    el.input.placeholder = block || `Kirim pesan ke #${ch.name} sebagai ${u.username}  —  ketik / untuk slash command`;
  }

  function renderQuick() {
    const entries = S.commandEntries();
    el.quick.innerHTML = `<span class="lbl">JALANKAN</span>${entries.map((e, i) => `<button class="qchip" data-quick="${i}">/${esc(e.path)}</button>`).join('')}<button class="qchip" data-adv="3600000">⏱ 1 jam berlalu</button><span class="or">atau ketik di bawah</span>`;
  }
  S.hooks.commands = renderQuick;

  // --------------------------------------------------------------- konsol
  let errCount = 0;
  function addLogLine(e) {
    const div = document.createElement('div');
    div.className = 'cl ' + e.level;
    div.innerHTML = `<span class="t">${hm(e.time)}</span>${esc(e.text)}`;
    el.consoleLines.appendChild(div);
    while (el.consoleLines.childElementCount > 500) el.consoleLines.firstChild.remove();
    el.consoleLines.scrollTop = el.consoleLines.scrollHeight;
    if (e.level === 'error' && el.consoleBox.classList.contains('hidden')) { errCount++; el.errBadge.textContent = errCount; }
  }
  S.hooks.log = addLogLine;
  S.logs.forEach(addLogLine);
  if (S.logs.some((l) => l.level === 'error')) el.consoleBox.classList.remove('hidden');

  // --------------------------------------------------------------- toast & typing
  S.hooks.toast = (title, body) => {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<b>${esc(title)}</b><span>${esc(String(body).slice(0, 140))}</span>`;
    el.toasts.appendChild(t);
    N.setTimeout(() => t.remove(), 4500);
  };
  let typingTimer = null;
  S.hooks.typing = (channelId) => {
    if (channelId !== S.currentChannelId) return;
    el.typing.innerHTML = `<b>TestBot</b> sedang mengetik…`;
    N.clearTimeout(typingTimer);
    typingTimer = N.setTimeout(() => { el.typing.textContent = ''; }, 3000);
  };
  // hapus indikator mengetik kalau bot sudah kirim pesan
  const origPost = S.post;
  S.post = (d) => { const r = origPost(d); if (r.authorId === S.BOT_ID) { el.typing.textContent = ''; N.clearTimeout(typingTimer); } return r; };

  // --------------------------------------------------------------- jam
  function renderClock() {
    const d = new Date();
    const off = S.offset > 1000 ? ` (+${Math.floor(S.offset / 36e5)}j ${Math.floor((S.offset % 36e5) / 6e4)}m)` : '';
    el.clock.textContent = `🕒 ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}${off}`;
  }
  N.setInterval(() => { renderClock(); if (S.users.some((u) => u.timeoutUntil)) S.hooks.render(); }, 1000);

  // --------------------------------------------------------------- autocomplete
  let pop = { items: [], sel: 0, kind: null };
  function optSig(o) { return `${o.name}${o.required ? '*' : ''}`; }

  function computePopup() {
    const v = el.input.value, pos = el.input.selectionStart;
    const before = v.slice(0, pos);
    if (/^\/[\w-]*(?: [\w-]*){0,2}$/.test(before) && !v.slice(pos).trim()) {
      const q = before.slice(1).toLowerCase();
      const entries = S.commandEntries().filter((e) => e.path.startsWith(q) || (q && e.path.includes(q)));
      const exact = entries.length === 1 && q.trim() === entries[0].path;
      if (exact && before.endsWith(' ')) return { items: [], kind: null };
      return { kind: 'slash', items: entries.map((e) => ({ label: '/' + e.path, desc: e.desc, extra: e.opts.map(optSig).join(' '), apply: () => enterSlash(e) })) };
    }
    const m = before.match(/(^|\s)([@#])([\w-]*)$/);
    if (m) {
      const q = m[3].toLowerCase();
      const start = pos - m[3].length - 1;
      const replace = (txt) => { el.input.value = v.slice(0, start) + txt + ' ' + v.slice(pos); const p = start + txt.length + 1; el.input.setSelectionRange(p, p); };
      if (m[2] === '@') {
        const users = S.users.filter((u) => u.username.toLowerCase().startsWith(q)).map((u) => ({ label: '@' + u.username, desc: u.bot ? 'Bot' : (topRole(u)?.name || 'Tanpa role'), img: S.avatarURL(u), apply: () => replace('@' + u.username) }));
        const roles = S.roles.filter((r) => r.name.toLowerCase().startsWith(q)).map((r) => ({ label: '@' + r.name, desc: 'Role', color: r.color, apply: () => replace('@' + r.name) }));
        return { kind: 'mention', items: [...users, ...roles] };
      }
      return { kind: 'channel', items: S.channels.filter((c) => c.name.startsWith(q)).map((c) => ({ label: '#' + c.name, desc: c.topic, apply: () => replace('#' + c.name) })) };
    }
    return { items: [], kind: null };
  }

  // ------------------------------------------------ composer slash ala Discord
  // /mod warn [member] [reason] — tiap opsi kotak sendiri, popup pilihan di atasnya
  const bar = $('#slash-bar');
  let sc = null; // { entry, shown: [nama opsi], values: {nama: {raw, display}}, active, sel, closed }
  const PICKER = new Set([5, 6, 7, 8, 9]);
  const optOf = (name) => sc.entry.opts.find((o) => o.name === name);
  const isPicker = (o) => PICKER.has(o.type) || !!o.choices?.length;

  function enterSlash(entry) {
    sc = { entry, shown: entry.opts.filter((o) => o.required).map((o) => o.name), values: {}, active: null, sel: 0 };
    el.input.value = ''; autosize();
    el.input.classList.add('hidden'); bar.classList.remove('hidden');
    hintError = ''; renderHint();
    focusOpt(sc.shown[0] ?? null);
  }
  function exitSlash(restoreText) {
    if (!sc) return;
    const path = sc.entry.path;
    sc = null;
    bar.classList.add('hidden'); bar.innerHTML = '';
    el.input.classList.remove('hidden');
    el.popup.classList.add('hidden');
    el.input.value = restoreText ? `/${path}` : '';
    el.input.focus(); autosize(); renderHint();
  }

  function renderBar() {
    const optional = sc.entry.opts.filter((o) => !sc.shown.includes(o.name));
    bar.innerHTML = `<span class="sc-pill">/${esc(sc.entry.path)}</span>` +
      sc.shown.map((name) => {
        const v = sc.values[name];
        const on = sc.active === name;
        return `<label class="sc-opt ${on ? 'active' : ''} ${v ? 'filled' : ''}" data-opt="${esc(name)}"><span class="sc-name">${esc(name)}${on || v ? ':' : ''}</span><input class="sc-in" data-opt="${esc(name)}" value="${esc(v?.display ?? '')}" size="${Math.max(1, (v?.display || '').length)}" spellcheck="false" autocomplete="off"></label>`;
      }).join('') +
      optional.map((o) => `<button class="sc-more" data-add-opt="${esc(o.name)}" title="${esc(o.description || '')}">＋ ${esc(o.name)}</button>`).join('');
  }
  function focusOpt(name) {
    sc.active = name; sc.sel = 0; sc.closed = false;
    renderBar();
    const inp = name ? bar.querySelector(`.sc-in[data-opt="${CSS.escape(name)}"]`) : null;
    if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
    else bar.tabIndex = -1, bar.focus();
    renderSlashPopup();
  }

  function pickerItems(o, q) {
    q = (q || '').toLowerCase().replace(/^[@#]/, '');
    const match = (s) => !q || s.toLowerCase().includes(q);
    const users = () => S.users.filter((u) => !u.gone && match(u.username)).map((u) => ({
      raw: `<@${u.id}>`, display: '@' + u.username, label: '@' + u.username, img: S.avatarURL(u),
      tag: u.id === S.currentUserId ? 'kamu' : u.bot ? 'APP' : '',
    }));
    const roles = () => S.roles.filter((r) => match(r.name)).map((r) => ({ raw: `<@&${r.id}>`, display: '@' + r.name, label: '@' + r.name, color: r.color, tag: 'role' }));
    let items = [];
    if (o.choices?.length) items = o.choices.filter((c) => match(String(c.name))).map((c) => ({ raw: String(c.name), display: String(c.name), label: String(c.name) }));
    else if (o.type === 6) items = users();
    else if (o.type === 9) items = [...users(), ...roles()];
    else if (o.type === 8) items = roles();
    else if (o.type === 7) items = S.channels.filter((c) => match(c.name)).map((c) => ({ raw: `<#${c.id}>`, display: '#' + c.name, label: '#' + c.name, tag: c.topic }));
    else if (o.type === 5) items = ['True', 'False'].filter(match).map((b) => ({ raw: b.toLowerCase(), display: b, label: b }));
    return items.slice(0, 25);
  }
  function freeHint(o) {
    const t = { 3: 'Teks', 4: 'Bilangan bulat', 10: 'Angka' }[o.type] || 'Nilai';
    const lim = [];
    if (o.min_value != null) lim.push(`min ${o.min_value}`);
    if (o.max_value != null) lim.push(`maks ${o.max_value}`);
    if (o.min_length) lim.push(`min ${o.min_length} karakter`);
    if (o.max_length) lim.push(`maks ${o.max_length} karakter`);
    return `${t}${lim.length ? ' · ' + lim.join(', ') : ''} — ketik di kotak lalu tekan Tab/Enter`;
  }

  function renderSlashPopup() {
    if (!sc) return;
    const head = (title, desc) => `<div class="sc-head"><span><b>${esc(title)}</b> <span class="muted">${esc(desc || '')}</span></span><button class="sc-x" data-sc="cancel" title="Batal (Esc)">×</button></div>`;
    const o = sc.active ? optOf(sc.active) : null;
    let html;
    if (!o) {
      const missing = sc.entry.opts.filter((x) => x.required && !sc.values[x.name]);
      html = head('/' + sc.entry.path, sc.entry.desc) + `<div class="sc-note">${missing.length ? `Isi dulu: ${missing.map((x) => esc(x.name)).join(', ')}` : '↵ Tekan <b>Enter</b> untuk kirim'}</div>`;
    } else if (isPicker(o) && !sc.values[o.name] && !sc.closed) {
      const items = pickerItems(o, bar.querySelector(`.sc-in[data-opt="${CSS.escape(o.name)}"]`)?.value);
      sc.items = items;
      sc.sel = Math.min(sc.sel, Math.max(0, items.length - 1));
      html = head(o.name, o.description) + (items.length ? items.map((it, i) => `<div class="pop-item ${i === sc.sel ? 'sel' : ''}" data-sc-item="${i}">
          ${it.img ? `<img class="av" style="width:24px;height:24px" src="${it.img}">` : it.color ? `<span style="color:${it.color}">●</span>` : ''}
          <span class="pn">${esc(it.label)}</span>${it.tag ? `<span class="pd">${esc(it.tag)}</span>` : ''}</div>`).join('') : '<div class="sc-note">Tidak ada yang cocok.</div>');
    } else {
      sc.items = [];
      const done = sc.entry.opts.every((x) => !x.required || sc.values[x.name]);
      html = head(o.name, o.description) + `<div class="sc-note">${isPicker(o) ? '✓ Sudah dipilih — hapus untuk ganti' : esc(freeHint(o))}${done ? ' · <b>Enter</b> untuk kirim' : ''}</div>`;
    }
    el.popup.innerHTML = html;
    el.popup.classList.remove('hidden');
    el.popup.querySelector('.pop-item.sel')?.scrollIntoView({ block: 'nearest' });
  }

  function nextEmpty(after) {
    const order = sc.shown;
    const start = after ? order.indexOf(after) + 1 : 0;
    return [...order.slice(start), ...order.slice(0, start)].find((n) => !sc.values[n] && optOf(n).required) ?? null;
  }
  function chooseItem(i) {
    const it = sc.items?.[i];
    if (!it || !sc.active) return;
    sc.values[sc.active] = { raw: it.raw, display: it.display };
    const nxt = nextEmpty(sc.active);
    focusOpt(nxt ?? sc.active);
  }
  function submitSlash() {
    const values = Object.fromEntries(Object.entries(sc.values).map(([k, v]) => [k, v.raw]));
    const res = S.runSlashEntry(sc.entry.path, values);
    if (res.error) { hintError = res.error; renderHint(); return; }
    forceBottom = true;
    exitSlash(false);
  }

  bar.addEventListener('focusin', (e) => {
    const n = e.target.dataset?.opt;
    if (n && sc && sc.active !== n) { sc.active = n; sc.sel = 0; sc.closed = false; bar.querySelectorAll('.sc-opt').forEach((x) => x.classList.toggle('active', x.dataset.opt === n)); bar.querySelectorAll('.sc-opt').forEach((x) => { x.querySelector('.sc-name').textContent = x.dataset.opt + (x.dataset.opt === n || sc.values[x.dataset.opt] ? ':' : ''); }); renderSlashPopup(); }
  });
  bar.addEventListener('input', (e) => {
    const inp = e.target, o = optOf(inp.dataset.opt);
    inp.size = Math.max(1, inp.value.length);
    hintError = ''; renderHint();
    if (isPicker(o)) delete sc.values[o.name]; // ketik ulang = cari lagi
    else if (inp.value.trim()) sc.values[o.name] = { raw: inp.value, display: inp.value };
    else delete sc.values[o.name];
    inp.closest('.sc-opt').classList.toggle('filled', !!sc.values[o.name]);
    sc.sel = 0; sc.closed = false;
    renderSlashPopup();
  });
  bar.addEventListener('keydown', (e) => {
    if (!sc) return;
    const inp = e.target.closest?.('.sc-in');
    const o = sc.active && optOf(sc.active);
    const listOpen = o && isPicker(o) && !sc.values[o.name] && sc.items?.length;
    if (e.key === 'ArrowDown' && listOpen) { e.preventDefault(); sc.sel = (sc.sel + 1) % sc.items.length; renderSlashPopup(); return; }
    if (e.key === 'ArrowUp' && listOpen) { e.preventDefault(); sc.sel = (sc.sel - 1 + sc.items.length) % sc.items.length; renderSlashPopup(); return; }
    if (e.key === 'Escape') { e.preventDefault(); exitSlash(false); return; }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      if (listOpen) { chooseItem(sc.sel); return; }
      if (e.key === 'Tab') {
        const i = sc.shown.indexOf(sc.active);
        const n = sc.shown[(i + (e.shiftKey ? -1 : 1) + sc.shown.length) % sc.shown.length];
        if (n) focusOpt(n);
        return;
      }
      submitSlash();
      return;
    }
    if (e.key === 'Backspace' && inp && inp.value === '') {
      e.preventDefault();
      const i = sc.shown.indexOf(sc.active);
      if (i > 0) { focusOpt(sc.shown[i - 1]); return; }
      if (!Object.keys(sc.values).length) exitSlash(true);
    }
  });
  bar.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add-opt]');
    if (add) { sc.shown.push(add.dataset.addOpt); focusOpt(add.dataset.addOpt); return; }
    if (e.target.classList.contains('sc-in')) { sc.closed = false; renderSlashPopup(); return; }
    if (e.target === bar || e.target.classList.contains('sc-pill')) focusOpt(sc.active ?? sc.shown[0] ?? null);
  });
  el.popup.addEventListener('mousedown', (e) => {
    if (!sc) return;
    const it = e.target.closest('[data-sc-item]');
    if (it) { e.preventDefault(); chooseItem(+it.dataset.scItem); return; }
    if (e.target.closest('[data-sc="cancel"]')) { e.preventDefault(); exitSlash(false); }
  });

  function renderPopup() {
    pop = { ...computePopup(), sel: 0 };
    if (!pop.items.length) { el.popup.classList.add('hidden'); return; }
    const title = pop.kind === 'slash' ? 'SLASH COMMAND' : pop.kind === 'mention' ? 'MEMBER & ROLE' : 'CHANNEL';
    el.popup.innerHTML = `<div class="pop-title">${title}</div>` + pop.items.map((it, i) => `<div class="pop-item ${i === pop.sel ? 'sel' : ''}" data-pop="${i}">
      ${it.img ? `<img class="av" style="width:24px;height:24px" src="${it.img}">` : it.color ? `<span style="color:${it.color}">●</span>` : ''}
      <span class="pn">${esc(it.label)}</span><span class="pd">${esc(it.desc || '')}</span>${it.extra ? `<span class="po">${esc(it.extra)}</span>` : ''}</div>`).join('');
    el.popup.classList.remove('hidden');
  }
  function movePop(d) {
    pop.sel = (pop.sel + d + pop.items.length) % pop.items.length;
    el.popup.querySelectorAll('.pop-item').forEach((n, i) => n.classList.toggle('sel', i === pop.sel));
    el.popup.querySelector('.pop-item.sel')?.scrollIntoView({ block: 'nearest' });
  }
  function choosePop(i) { const it = pop.items[i]; if (!it) return; it.apply(); if (sc) return; el.input.focus(); autosize(); renderPopup(); renderHint(); }

  let hintError = '';
  function renderHint() {
    const v = el.input.value;
    if (hintError) { el.hint.className = 'err'; el.hint.innerHTML = '⚠ ' + md(hintError); return; }
    if (!v.startsWith('/')) { el.hint.className = 'hidden'; return; }
    const entries = S.commandEntries().filter((e) => v === '/' + e.path || v.startsWith('/' + e.path + ' ')).sort((a, b) => b.path.length - a.path.length);
    const e = entries[0];
    if (!e) { el.hint.className = 'hidden'; return; }
    const opts = e.opts.map((o) => {
      const filled = new RegExp(`(^|\\s)${o.name}:\\s*\\S`).test(v);
      const typ = S.OPT_NAMES[o.type] || '?';
      const ch = o.choices?.length ? ` [${o.choices.map((c) => c.name).join(' | ')}]` : '';
      return `<span class="opt ${filled ? 'filled' : ''}"><b>${esc(o.name)}</b>${o.required ? '<span class="req">*</span>' : ''} <span class="muted">${typ}${esc(ch)}${o.description ? ' — ' + esc(o.description) : ''}</span></span>`;
    }).join('');
    el.hint.className = '';
    el.hint.innerHTML = `<b>/${esc(e.path)}</b> <span class="muted">${esc(e.desc || '')}</span>${opts ? `<div style="margin-top:4px">${opts}</div><div class="muted" style="font-size:12px;margin-top:3px">Format: <code>nama: nilai</code> · user pakai <code>@Nama</code> · <span class="req">*</span> = wajib · Enter untuk kirim</div>` : '<div class="muted" style="font-size:12px;margin-top:3px">Tanpa opsi — tekan Enter untuk kirim</div>'}`;
  }

  function autosize() { el.input.style.height = 'auto'; el.input.style.height = Math.min(el.input.scrollHeight, 200) + 'px'; }

  // --------------------------------------------------------------- kirim
  function send() {
    const text = el.input.value.trim();
    if (!text || el.input.disabled) return;
    hintError = '';
    if (text.startsWith('/')) {
      const res = S.runSlash(text);
      if (res.error) { hintError = res.error; renderHint(); return; }
      if (res.ok) { el.input.value = ''; autosize(); renderPopup(); renderHint(); forceBottom = true; return; }
    }
    if (text.length > 2000) { hintError = `Pesan terlalu panjang (${text.length}/2000 karakter).`; renderHint(); return; }
    S.userSay(text);
    forceBottom = true;
    el.input.value = ''; autosize(); renderPopup(); renderHint();
  }

  el.input.addEventListener('input', () => { hintError = ''; autosize(); renderPopup(); renderHint(); });
  el.input.addEventListener('click', renderPopup);
  el.input.addEventListener('keydown', (e) => {
    const open = !el.popup.classList.contains('hidden') && pop.items.length;
    if (open && e.key === 'ArrowDown') { e.preventDefault(); movePop(1); return; }
    if (open && e.key === 'ArrowUp') { e.preventDefault(); movePop(-1); return; }
    if (open && (e.key === 'Tab' || (e.key === 'Enter' && !e.shiftKey))) { e.preventDefault(); choosePop(pop.sel); return; }
    if (e.key === 'Escape') { el.popup.classList.add('hidden'); return; }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });
  el.popup.addEventListener('mousedown', (e) => { const n = e.target.closest('[data-pop]'); if (n) { e.preventDefault(); choosePop(+n.dataset.pop); } });

  // --------------------------------------------------------------- klik-klik
  document.addEventListener('click', (e) => {
    const t = e.target;
    const ch = t.closest('[data-ch]');
    if (ch && (ch.classList.contains('ch') || ch.classList.contains('mention'))) {
      const id = ch.dataset.ch;
      if (id === 'dm' || S.channel(id)) { S.currentChannelId = id; S.unread[id === 'dm' ? `dm:${S.currentUserId}` : id] = 0; forceBottom = true; hintError = ''; renderAll(); renderHint(); }
      return;
    }
    const mem = t.closest('[data-user]');
    if (mem) {
      const u = S.user(mem.dataset.user);
      if (u.gone) { S.rejoin(u.id); return; }
      if (u.bot) return;
      S.currentUserId = u.id; forceBottom = true; renderAll(); return;
    }
    const role = t.closest('[data-role]');
    if (role) {
      const u = me(), id = role.dataset.role;
      u.roles = u.roles.includes(id) ? u.roles.filter((x) => x !== id) : [...u.roles, id].sort();
      renderAll(); return;
    }
    const btn = t.closest('[data-btn]');
    if (btn) {
      const [id, idx] = btn.dataset.btn.split(':');
      const rec = S.records.find((r) => r.id === id);
      if (rec) S.clickButton(rec, S.buttonsOf(rec)[+idx]);
      return;
    }
    const rx = t.closest('[data-react]');
    if (rx) {
      const rec = S.records.find((r) => r.id === rx.dataset.react);
      const emoji = rx.dataset.emoji;
      const r = rec.reactions.find((x) => x.emoji === emoji);
      if (r && r.users.includes(S.currentUserId)) S.unreact(rec, emoji, S.currentUserId); else S.react(rec, emoji, S.currentUserId);
      return;
    }
    const qr = t.closest('[data-qr]');
    if (qr) { const rec = S.records.find((r) => r.id === qr.dataset.qr); if (rec) S.react(rec, qr.dataset.e, S.currentUserId); return; }
    const del = t.closest('[data-del]');
    if (del) { S.remove(del.dataset.del); return; }
    const dis = t.closest('[data-dismiss]');
    if (dis) { S.records = S.records.filter((r) => r.id !== dis.dataset.dismiss); S.hooks.render(); return; }
    const jump = t.closest('[data-jump]');
    if (jump) { const n = el.messages.querySelector(`[data-id="${jump.dataset.jump}"]`); if (n) { n.scrollIntoView({ block: 'center' }); n.classList.add('flash'); N.setTimeout(() => n.classList.remove('flash'), 1200); } return; }
    if (t.classList.contains('spoiler')) { t.classList.add('shown'); return; }
    const q = t.closest('[data-quick]');
    if (q) { const entry = S.commandEntries()[+q.dataset.quick]; if (entry && !el.input.disabled) { exitSlash(false); el.popup.classList.add('hidden'); enterSlash(entry); } return; }
    const adv = t.closest('[data-adv]');
    if (adv) { S.advance(+adv.dataset.adv); renderClock(); return; }
    if (!t.closest('#composer-wrap')) { el.popup.classList.add('hidden'); if (sc) sc.closed = true; }
  });
  document.addEventListener('change', (e) => {
    if (e.target.id === 'me-select') { S.currentUserId = e.target.value; forceBottom = true; renderAll(); }
    if (e.target.id === 'dm-closed') { me().dmClosed = e.target.checked; renderAll(); }
  });

  $('#t-min').onclick = () => { S.advance(60e3); renderClock(); };
  $('#t-hour').onclick = () => { S.advance(36e5); renderClock(); };
  $('#t-restart').onclick = () => location.reload();
  $('#t-reset').onclick = () => {
    if (confirm('Hapus semua data yang disimpan bot (file di localStorage) dan reset waktu virtual?')) S.resetData();
  };
  $('#t-console').onclick = () => { el.consoleBox.classList.toggle('hidden'); errCount = 0; el.errBadge.textContent = ''; el.consoleLines.scrollTop = el.consoleLines.scrollHeight; };
  $('#console-clear').onclick = () => { el.consoleLines.innerHTML = ''; };

  // --------------------------------------------------------------- Test settings
  const sm = { box: $('#settings-modal'), body: $('#sm-body'), err: $('#sm-err') };
  let draft = null;
  const clone = (x) => JSON.parse(JSON.stringify(x));

  function openSettings() {
    const def = S.settingsDef;
    draft = def ? clone(def.get()) : null;
    sm.err.textContent = '';
    renderSettings();
    sm.box.classList.remove('hidden');
  }
  const closeSettings = () => sm.box.classList.add('hidden');

  const roleChip = (id) => { const r = S.role(id); return `<span class="pill"><span class="dot" style="background:${r?.color || '#888'}"></span>@${esc(r?.name || 'role-hilang')}</span>`; };
  const opt = (value, label, cur) => `<option value="${esc(value)}" ${String(cur) === String(value) ? 'selected' : ''}>${esc(label)}</option>`;
  const countBadge = (n) => `<span class="count">${n} item</span>`;

  function cellEnabled(col, row) { return !col.enabledWhen || col.enabledWhen.in.includes(row[col.enabledWhen.col]); }

  function fieldHTML(fd) {
    const v = draft[fd.key];
    const k = `data-k="${fd.key}"`;
    const line = (control, extra = '') => `<div class="sm-row"><div class="sm-label">${esc(fd.label)}${fd.hint ? `<div class="sm-hint">${esc(fd.hint)}</div>` : ''}</div><div class="sm-ctl">${extra}${control}</div></div>`;
    switch (fd.type) {
      case 'channel':
        return line(`<select class="sm-in" ${k}>${opt('', '— belum diatur —', v || '')}${S.channels.map((c) => opt(c.id, '#' + c.name, v)).join('')}</select>`);
      case 'number':
        return line(`<input class="sm-in num" type="number" ${k} value="${esc(v)}" ${fd.min != null ? `min="${fd.min}"` : ''} ${fd.max != null ? `max="${fd.max}"` : ''}>`);
      case 'boolean':
        return line(`<button class="sm-toggle ${v ? 'on' : ''}" data-act="toggle" ${k}><span class="led"></span>${v ? 'Enabled' : 'Disabled'}</button>`);
      case 'roles': {
        const list = v || [];
        const avail = S.roles.filter((r) => !list.includes(r.id));
        const rows = list.map((id, i) => `<tr><td class="n">${i + 1}</td><td>${roleChip(id)}</td><td class="x"><button data-act="rm-item" ${k} data-i="${i}" title="Hapus">×</button></td></tr>`).join('');
        return `<div class="sm-block"><div class="sm-bhead"><span class="sm-label">${esc(fd.label)}</span>${countBadge(list.length)}</div>
          <table class="sm-table"><thead><tr><th class="n">#</th><th>Role</th><th class="x"></th></tr></thead><tbody>${rows || '<tr><td colspan="3" class="empty">Belum ada — semua member non-admin ditolak.</td></tr>'}</tbody></table>
          ${avail.length ? `<select class="sm-in sm-add" data-act="add-role" ${k}><option value="">＋ Tambah role…</option>${avail.map((r) => `<option value="${r.id}">@${esc(r.name)}</option>`).join('')}</select>` : ''}</div>`;
      }
      case 'table': {
        const list = v || [];
        const rows = list.map((row, i) => `<tr><td class="n">${i + 1}</td>${fd.columns.map((c) => {
          const dis = cellEnabled(c, row) ? '' : 'disabled';
          const attrs = `${k} data-row="${i}" data-col="${c.key}" ${dis}`;
          const val = dis ? '' : row[c.key];
          return `<td>${c.type === 'select'
            ? `<select class="sm-in" ${attrs}>${c.options.map((o) => opt(o.value, o.label, row[c.key])).join('')}</select>`
            : `<input class="sm-in num" type="number" ${attrs} value="${esc(val)}" ${c.min != null ? `min="${c.min}"` : ''} ${c.max != null ? `max="${c.max}"` : ''}>`}</td>`;
        }).join('')}<td class="x"><button data-act="rm-item" ${k} data-i="${i}" title="Hapus tahap">×</button></td></tr>`).join('');
        return `<div class="sm-block"><div class="sm-bhead"><span class="sm-label">${esc(fd.label)}</span>${countBadge(list.length)}</div>
          <div class="sm-scroll"><table class="sm-table"><thead><tr><th class="n">#</th>${fd.columns.map((c) => `<th>${esc(c.label)}</th>`).join('')}<th class="x"></th></tr></thead>
          <tbody>${rows || `<tr><td colspan="${fd.columns.length + 2}" class="empty">Belum ada tahap.</td></tr>`}</tbody></table></div>
          <button class="sm-btn small" data-act="add-row" ${k}>＋ Tambah tahap</button></div>`;
      }
      default:
        return line(`<input class="sm-in" ${k} value="${esc(v ?? '')}">`);
    }
  }

  function renderSettings() {
    const def = S.settingsDef;
    if (!def) {
      sm.body.innerHTML = `<p class="sm-desc">bot.js belum mendaftarkan pengaturan. Tambahkan di bot.js:</p>
        <pre><code>globalThis.SIM?.registerSettings?.({\n  fields: [{ key: 'expiryDays', label: 'Masa berlaku (hari)', type: 'number' }],\n  get: () => config,\n  set: (v) => { Object.assign(config, v); return null; },\n});</code></pre>
        <p class="sm-desc">Tipe field: <code>roles</code>, <code>channel</code>, <code>number</code>, <code>boolean</code>, <code>table</code>. Di bot asli baris ini otomatis diabaikan.</p>`;
      $('[data-sm="save"]').classList.add('hidden');
      return;
    }
    $('[data-sm="save"]').classList.remove('hidden');
    const keep = sm.body.scrollTop;
    sm.body.innerHTML = `<p class="sm-desc">${esc(def.description || '')}</p>${def.fields.map(fieldHTML).join('')}`;
    sm.body.scrollTop = keep;
  }

  function fieldDef(key) { return S.settingsDef.fields.find((f) => f.key === key); }
  function readInput(t) {
    const fd = fieldDef(t.dataset.k);
    if (t.dataset.row !== undefined) {
      const col = fd.columns.find((c) => c.key === t.dataset.col);
      draft[fd.key][+t.dataset.row][col.key] = col.type === 'number' ? (t.value === '' ? '' : Number(t.value)) : t.value;
      return col.type === 'select';
    }
    if (fd.type === 'number') draft[fd.key] = t.value === '' ? '' : Number(t.value);
    else draft[fd.key] = t.value || null;
    return false;
  }

  sm.body.addEventListener('input', (e) => { const t = e.target; if (t.dataset.k && !t.dataset.act) readInput(t); });
  sm.body.addEventListener('change', (e) => {
    const t = e.target;
    if (t.dataset.act === 'add-role') { if (t.value) { draft[t.dataset.k] = [...(draft[t.dataset.k] || []), t.value]; renderSettings(); } return; }
    if (t.dataset.k && readInput(t)) renderSettings();
  });
  sm.box.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act],[data-sm]');
    if (e.target === sm.box) return closeSettings();
    if (!t) return;
    const key = t.dataset.k;
    switch (t.dataset.act || t.dataset.sm) {
      case 'close': return closeSettings();
      case 'toggle': draft[key] = !draft[key]; return renderSettings();
      case 'rm-item': draft[key].splice(+t.dataset.i, 1); return renderSettings();
      case 'add-row': draft[key].push(clone(fieldDef(key).newRow || {})); return renderSettings();
      case 'save': {
        let err;
        try { err = S.settingsDef.set(clone(draft)); } catch (x) { err = x.message; S.error(x, 'Test settings'); }
        if (err) { sm.err.textContent = '⚠ ' + err; return; }
        S.log('sys', '⚙ Test settings disimpan.');
        S.hooks.toast('⚙ Test settings disimpan', 'Langsung dipakai bot — tidak perlu restart.');
        closeSettings();
      }
    }
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !sm.box.classList.contains('hidden')) closeSettings(); });
  $('#open-settings').onclick = openSettings;

  // --------------------------------------------------------------- Versi (versions.js)
  const vm = { box: $('#versions-modal'), body: $('#vm-body') };
  const VERSIONS = window.SIM_VERSIONS || [];
  const TAG = { baru: 'Baru', ubah: 'Diubah', fix: 'Perbaikan' };
  if (VERSIONS[0]) $('#ver-badge').textContent = 'v' + VERSIONS[0].version;
  function openVersions() {
    vm.body.innerHTML = VERSIONS.length
      ? VERSIONS.map((v, i) => `<div class="ver ${i === 0 ? 'latest' : ''}">
          <div class="ver-top"><span class="ver-num">v${esc(v.version)}</span><span class="ver-title">${esc(v.title)}</span>${i === 0 ? '<span class="ver-now">TERBARU</span>' : ''}<span class="ver-date">${new Date(v.date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
          <ul>${v.changes.map((c) => `<li><span class="tag ${esc(c.type)}">${esc(TAG[c.type] || c.type)}</span><span>${md(c.text)}</span></li>`).join('')}</ul></div>`).join('')
      : '<p class="sm-desc">Belum ada catatan versi. Isi file versions.js.</p>';
    vm.box.classList.remove('hidden');
  }
  vm.box.addEventListener('click', (e) => { if (e.target === vm.box || e.target.closest('[data-vm="close"]')) vm.box.classList.add('hidden'); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') vm.box.classList.add('hidden'); });
  $('#open-versions').onclick = openVersions;

  // --------------------------------------------------------------- start
  renderQuick();
  renderClock();
  renderAll();
  renderHint();
  el.input.focus();
  N.setTimeout(() => {
    if (!S.client) S.log('warn', '⚠ bot.js belum bikin "new Client()". Cek file bot.js kamu.');
    else if (!S.client._loggingIn) S.log('warn', '⚠ Bot belum login. Jangan lupa client.login(process.env.TOKEN) di akhir bot.js.');
  }, 1500);
})();
