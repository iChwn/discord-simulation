// =====================================================================
//  BOT KAMU — Modul moderasi warn (discord.js v14, Components V2)
//  Di simulator: simpan file ini, lalu klik "↻ Restart bot".
//  Di bot asli: jalankan `node bot.js` (lihat README.md).
//
//  Command (staff): /mod warn | /mod warning-list | /mod warning-clear
//  Pengaturan: file settings.json (di simulator: tombol ⚙ Test settings)
// =====================================================================
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const {
  Client, GatewayIntentBits, Events, REST, Routes, SlashCommandBuilder, PermissionFlagsBits,
  MessageFlags, ContainerBuilder, SeparatorSpacingSize, ButtonBuilder, ButtonStyle,
} = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

// ------------------------------------------------------------------ konstanta
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MAX_TIMEOUT = 28 * DAY;          // batas timeout dari Discord
const MAX_EXPIRY_DAYS = 365;
const PAGE_SIZE = 10;                  // member per halaman di warning-list
const PANEL_TTL = 15 * MINUTE;         // umur sesi panel warning-list
const SWEEP_EVERY = MINUTE;            // cek ban sementara & data kedaluwarsa

const V2 = MessageFlags.IsComponentsV2;
const PRIVATE_V2 = MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral;
const NO_PINGS = { parse: [] };        // kartu menyebut member tanpa nge-ping
const COLOR = { warn: 0xf0b232, info: 0x5865f2, ok: 0x23a55a, danger: 0xed4245 };
const ACTIONS = { none: 'Tanpa tindakan', timeout: 'Timeout', kick: 'Kick', tempban: 'Ban sementara', ban: 'Ban permanen' };

const UNIT_MS = { minutes: MINUTE, hours: HOUR, days: DAY };

// Isi awal settings.json (dibuat otomatis kalau belum ada)
const DEFAULT_SETTINGS = {
  staffRoleIds: [],            // ID role yang boleh memakai /mod (admin selalu boleh)
  modLogChannelId: null,       // ID channel mod-log
  warnChannelId: null,         // ID channel pengumuman warn
  manualUnbanChannelId: null,  // ID channel staff kalau unban otomatis gagal
  expiryDays: 30,              // masa berlaku warn, 1–365 hari
  // sakelar pengaman — semua MATI secara default
  autoActions: false,          // sakelar utama tindakan otomatis
  allowBan: false,
  allowKick: false,
  allowTempban: false,
  escalation: [                // action: none | timeout | kick | tempban | ban ; unit: minutes | hours | days
    { warns: 3, periodDays: 30, action: 'timeout', duration: 1, unit: 'hours' },
    { warns: 5, periodDays: 30, action: 'timeout', duration: 1, unit: 'days' },
    { warns: 7, periodDays: 60, action: 'tempban', duration: 7, unit: 'days' },
  ],
};

// ------------------------------------------------------------------ penyimpanan
// File JSON + data sementara dengan masa kedaluwarsa (TTL).
// Ditulis ke file .tmp dulu lalu di-rename supaya file tidak rusak kalau bot mati di tengah jalan.
class JsonStore {
  constructor(file) {
    this.file = file;
    this.data = { guilds: {}, temp: {} };
    try {
      if (fs.existsSync(file)) this.data = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (e) {
      console.error('⚠ Gagal membaca data, mulai dari kosong:', e.message);
    }
    this.data.guilds ??= {};
    this.data.temp ??= {};
  }
  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(this.file + '.tmp', JSON.stringify(this.data, null, 2));
    fs.renameSync(this.file + '.tmp', this.file);
  }
  guild(id) {
    const g = (this.data.guilds[id] ??= { warns: [], tempBans: [] });
    g.warns ??= [];
    g.tempBans ??= [];
    // g.config = pengaturan dari settings.json (tidak ikut disimpan ke file data)
    if (!Object.getOwnPropertyDescriptor(g, 'config')?.get) {
      delete g.config;
      Object.defineProperty(g, 'config', { get: () => settings, enumerable: false, configurable: true });
    }
    return g;
  }
  setTemp(key, value, ttlMs) {
    this.data.temp[key] = { value, expiresAt: Date.now() + ttlMs };
    this.save();
  }
  getTemp(key) {
    const t = this.data.temp[key];
    if (!t) return null;
    if (t.expiresAt <= Date.now()) { delete this.data.temp[key]; this.save(); return null; }
    return t.value;
  }
  sweepTemp() {
    let removed = 0;
    for (const [k, t] of Object.entries(this.data.temp)) if (t.expiresAt <= Date.now()) { delete this.data.temp[k]; removed++; }
    return removed;
  }
}
const store = new JsonStore(path.join(__dirname, 'data', 'moderation.json'));

// ------------------------------------------------------------------ pengaturan (settings.json)
// File ini diisi admin (ID role & channel). Di simulator diisi lewat tombol ⚙ Test settings.
const SETTINGS_FILE = path.join(__dirname, 'settings.json');
const toAmountUnit = (ms) => (ms % DAY === 0 ? [ms / DAY, 'days'] : ms % HOUR === 0 ? [ms / HOUR, 'hours'] : [Math.round(ms / MINUTE), 'minutes']);

// pengaturan internal (durationMs) → format file (duration + unit)
function settingsToFile(cfg) {
  return {
    ...cfg,
    escalation: cfg.escalation.map(({ durationMs, ...s }) => {
      if (!durationMs) return s;
      const [duration, unit] = toAmountUnit(durationMs);
      return { ...s, duration, unit };
    }),
  };
}
// format file → pengaturan internal; kembalikan { config } atau { error }
function settingsFromFile(raw) {
  const v = { ...DEFAULT_SETTINGS, ...raw };
  const isId = (x) => x === null || x === '' || /^\d+$/.test(String(x));
  if (!Array.isArray(v.staffRoleIds) || !v.staffRoleIds.every((x) => /^\d+$/.test(String(x)))) return { error: 'staffRoleIds harus daftar ID role (angka).' };
  for (const k of ['modLogChannelId', 'warnChannelId', 'manualUnbanChannelId']) if (!isId(v[k])) return { error: `${k} harus ID channel (angka) atau null.` };
  if (!Number.isInteger(v.expiryDays) || v.expiryDays < 1 || v.expiryDays > MAX_EXPIRY_DAYS) return { error: 'Masa berlaku warn harus 1–365 hari.' };
  if (!Array.isArray(v.escalation)) return { error: 'escalation harus berupa daftar tahap.' };
  const escalation = [];
  for (const [n, r] of v.escalation.entries()) {
    const stage = { warns: r.warns, periodDays: r.periodDays, action: r.action };
    if (needsDuration(r.action)) stage.durationMs = (Number(r.duration) || 0) * (UNIT_MS[r.unit] || 0);
    const err = stageError(stage);
    if (err) return { error: `Tahap ${n + 1}: ${err}` };
    if (escalation.some((s) => s.warns === stage.warns)) return { error: `Tahap ${n + 1}: jumlah warn ${stage.warns} dipakai dua kali.` };
    escalation.push(stage);
  }
  return {
    config: {
      staffRoleIds: [...new Set(v.staffRoleIds.map(String))],
      modLogChannelId: v.modLogChannelId ? String(v.modLogChannelId) : null,
      warnChannelId: v.warnChannelId ? String(v.warnChannelId) : null,
      manualUnbanChannelId: v.manualUnbanChannelId ? String(v.manualUnbanChannelId) : null,
      expiryDays: v.expiryDays,
      autoActions: v.autoActions === true,
      allowBan: v.allowBan === true,
      allowKick: v.allowKick === true,
      allowTempban: v.allowTempban === true,
      escalation: escalation.sort((a, b) => a.warns - b.warns),
    },
  };
}
function saveSettings(cfg) {
  fs.writeFileSync(SETTINGS_FILE + '.tmp', JSON.stringify(settingsToFile(cfg), null, 2));
  fs.renameSync(SETTINGS_FILE + '.tmp', SETTINGS_FILE);
}
function loadSettings() {
  let raw;
  try {
    raw = fs.existsSync(SETTINGS_FILE) ? JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')) : null;
  } catch (e) {
    console.error(`⚠ settings.json tidak bisa dibaca (${e.message}) — pakai pengaturan default.`);
    return settingsFromFile({}).config;
  }
  if (!raw) {
    // versi lama menyimpan pengaturan di data/moderation.json → pindahkan
    const old = Object.values(store.data.guilds).find((g) => g.config)?.config;
    const { config } = settingsFromFile(old ? settingsToFile({
      ...old,
      staffRoleIds: [...(old.staffRoleIds || []), ...(old.staffRoleId ? [old.staffRoleId] : [])],
      escalation: old.escalation || [],
    }) : {});
    const cfg = config ?? settingsFromFile({}).config;
    saveSettings(cfg);
    for (const g of Object.values(store.data.guilds)) delete g.config;
    store.save();
    console.log(old ? '📄 Pengaturan lama dipindah ke settings.json' : '📄 settings.json dibuat dengan pengaturan default');
    return cfg;
  }
  const { config, error } = settingsFromFile(raw);
  if (error) {
    console.error(`⚠ settings.json tidak valid: ${error} — pakai pengaturan default.`);
    return settingsFromFile({}).config;
  }
  return config;
}
let settings; // diisi setelah semua helper siap (lihat bawah)

// ------------------------------------------------------------------ helper umum
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const unix = (ms) => Math.floor(ms / 1000);
const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

function formatDuration(ms) {
  if (ms % DAY === 0) return `${ms / DAY} hari`;
  if (ms % HOUR === 0) return `${ms / HOUR} jam`;
  return `${Math.round(ms / MINUTE)} menit`;
}
// Kenapa tahap ini tidak boleh dijalankan otomatis (null = boleh)
const ALLOW_KEY = { kick: 'allowKick', tempban: 'allowTempban', ban: 'allowBan' };
function blockedReason(cfg, action) {
  if (action === 'none') return null;
  if (!cfg.autoActions) return 'tindakan otomatis nonaktif';
  if (ALLOW_KEY[action] && !cfg[ALLOW_KEY[action]]) return `${ACTIONS[action].toLowerCase()} otomatis tidak diizinkan`;
  return null;
}
const needsDuration = (action) => action === 'timeout' || action === 'tempban';
function stageError(s) {
  if (!Number.isInteger(s.warns) || s.warns < 1 || s.warns > 50) return 'Jumlah warn harus 1–50.';
  if (!Number.isInteger(s.periodDays) || s.periodDays < 1 || s.periodDays > MAX_EXPIRY_DAYS) return 'Periode harus 1–365 hari.';
  if (!(s.action in ACTIONS)) return `Hukuman "${s.action}" tidak dikenal.`;
  if (needsDuration(s.action)) {
    if (!(s.durationMs > 0)) return `${ACTIONS[s.action]} butuh durasi.`;
    if (s.action === 'timeout' && s.durationMs > MAX_TIMEOUT) return 'Timeout maksimal 28 hari (batas Discord).';
    if (s.action === 'tempban' && s.durationMs > MAX_EXPIRY_DAYS * DAY) return 'Ban sementara maksimal 365 hari.';
  }
  return null;
}
const describeStage = (s) => (s.action === 'timeout' || s.action === 'tempban' ? `${ACTIONS[s.action]} ${formatDuration(s.durationMs)}` : ACTIONS[s.action]);
const stageLabel = (g, s) => `tahap ${g.config.escalation.indexOf(s) + 1}: ≥${s.warns} warn dalam ${s.periodDays} hari`;

settings = loadSettings();

// Kartu Components V2 standar: judul, garis, isi, footer kecil
function card(color, title, lines, footer) {
  const c = new ContainerBuilder()
    .setAccentColor(color)
    .addTextDisplayComponents((t) => t.setContent(`## ${title}`))
    .addSeparatorComponents((s) => s.setDivider(true).setSpacing(SeparatorSpacingSize.Small));
  if (lines.length) c.addTextDisplayComponents((t) => t.setContent(lines.join('\n')));
  if (footer) c.addTextDisplayComponents((t) => t.setContent(`-# ${footer}`));
  return c;
}

// Kirim ke beberapa channel; kembalikan catatan kalau ada yang gagal (tidak melempar error)
async function postToChannels(guild, targets, payload) {
  const notes = [];
  const sent = new Set();
  for (const [label, id] of targets) {
    if (!id) { notes.push(`channel ${label} belum diatur`); continue; }
    if (sent.has(id)) continue;
    sent.add(id);
    const ch = guild.channels.cache.get(id) ?? (await guild.channels.fetch(id).catch(() => null));
    if (!ch?.isTextBased()) { notes.push(`channel ${label} tidak ditemukan`); continue; }
    try { await ch.send(payload); } catch (e) { notes.push(`gagal kirim ke ${label}: ${e.message}`); }
  }
  return notes;
}

// ------------------------------------------------------------------ logika warn
const expiresAt = (w, cfg) => w.createdAt + cfg.expiryDays * DAY;
const isActive = (w, cfg, now = Date.now()) => now < expiresAt(w, cfg);

function activeWarns(g, userId) {
  return g.warns.filter((w) => w.userId === userId && isActive(w, g.config)).sort((a, b) => a.createdAt - b.createdAt);
}
function warnedMembers(g) {
  const map = new Map();
  for (const w of g.warns) {
    if (!isActive(w, g.config)) continue;
    const e = map.get(w.userId) ?? { userId: w.userId, count: 0, last: 0 };
    e.count++;
    e.last = Math.max(e.last, w.createdAt);
    map.set(w.userId, e);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || b.last - a.last);
}
// Tahap eskalasi tertinggi yang terpenuhi (hanya warn aktif di dalam periode tahap itu)
function matchStage(g, userId) {
  const now = Date.now();
  const warns = activeWarns(g, userId);
  let best = null;
  for (const s of g.config.escalation) {
    const count = warns.filter((w) => w.createdAt > now - s.periodDays * DAY).length;
    if (count >= s.warns && (!best || s.warns > best.stage.warns)) best = { stage: s, count };
  }
  return best;
}

async function executeStage(guild, member, stage, reason) {
  try {
    const g = store.guild(guild.id);
    switch (stage.action) {
      case 'timeout':
        await member.timeout(Math.min(stage.durationMs, MAX_TIMEOUT), reason);
        return `${describeStage(stage)} ✅ (sampai <t:${unix(Date.now() + Math.min(stage.durationMs, MAX_TIMEOUT))}:f>)`;
      case 'kick':
        await member.kick(reason);
        return `${describeStage(stage)} ✅`;
      case 'tempban': {
        const until = Date.now() + stage.durationMs;
        await guild.members.ban(member.id, { reason });
        g.tempBans = g.tempBans.filter((b) => b.userId !== member.id);
        g.tempBans.push({ userId: member.id, unbanAt: until });
        store.save();
        return `${describeStage(stage)} ✅ (unban otomatis <t:${unix(until)}:f>)`;
      }
      case 'ban':
        await guild.members.ban(member.id, { reason });
        g.tempBans = g.tempBans.filter((b) => b.userId !== member.id);
        store.save();
        return `${describeStage(stage)} ✅`;
      default:
        return ACTIONS.none;
    }
  } catch (e) {
    return `${describeStage(stage)} — ❌ gagal: ${e.message}`;
  }
}

// ------------------------------------------------------------------ akses
const isAdmin = (member) => Boolean(member?.permissions.has(PermissionFlagsBits.Administrator) || member?.permissions.has(PermissionFlagsBits.ManageGuild));
function isStaff(member, cfg) {
  if (!member) return false;
  if (isAdmin(member)) return true;
  return cfg.staffRoleIds.some((id) => member.roles.cache.has(id));
}
async function denyIfNotStaff(i, cfg) {
  if (isStaff(i.member, cfg)) return false;
  await i.reply({
    content: cfg.staffRoleIds.length
      ? `⛔ Hanya staff (${cfg.staffRoleIds.map((id) => `<@&${id}>`).join(', ')}) yang bisa memakai ini.`
      : '⛔ Hanya staff yang bisa memakai ini. Role staff belum diatur — isi `staffRoleIds` di settings.json.',
    flags: MessageFlags.Ephemeral,
    allowedMentions: NO_PINGS,
  });
  return true;
}

// ------------------------------------------------------------------ slash command
const commands = [
  new SlashCommandBuilder().setName('mod').setDescription('Moderasi warn')
    .addSubcommand((s) => s.setName('warn').setDescription('Beri warn ke member')
      .addUserOption((o) => o.setName('member').setDescription('Member yang diberi warn').setRequired(true))
      .addStringOption((o) => o.setName('reason').setDescription('Alasan warn').setRequired(true).setMaxLength(500)))
    .addSubcommand((s) => s.setName('warning-list').setDescription('Daftar member dengan warn aktif'))
    .addSubcommand((s) => s.setName('warning-clear').setDescription('Hapus semua warn aktif member & cabut timeout')
      .addUserOption((o) => o.setName('member').setDescription('Member yang warn-nya dihapus').setRequired(true))),
];

// ------------------------------------------------------------------ /mod warn
async function cmdWarn(i, g) {
  const cfg = g.config;
  const user = i.options.getUser('member', true);
  const reason = i.options.getString('reason', true).trim();
  if (user.bot) return i.reply({ content: '🤖 Bot tidak bisa diberi warn.', flags: MessageFlags.Ephemeral });
  if (user.id === i.user.id) return i.reply({ content: '🙃 Kamu tidak bisa memberi warn ke diri sendiri.', flags: MessageFlags.Ephemeral });
  const member = await i.guild.members.fetch(user.id).catch(() => null);
  if (!member) return i.reply({ content: '❌ Member itu tidak ada di server.', flags: MessageFlags.Ephemeral });

  await i.deferReply({ flags: MessageFlags.Ephemeral });

  const warn = { id: newId(), userId: user.id, moderatorId: i.user.id, reason, createdAt: Date.now() };
  g.warns.push(warn);
  store.save();

  const count = activeWarns(g, user.id).length;
  const match = matchStage(g, user.id);
  const blocked = match ? blockedReason(cfg, match.stage.action) : null;
  const willAct = Boolean(match && match.stage.action !== 'none' && !blocked);
  let actionText = 'Tidak ada';
  if (match && match.stage.action === 'none') actionText = `Tanpa tindakan (${stageLabel(g, match.stage)})`;
  else if (match && blocked) actionText = `${describeStage(match.stage)} — *tidak dijalankan, ${blocked}* (${stageLabel(g, match.stage)})`;

  // DM dulu (sebelum kick/ban, karena setelah itu DM biasanya tidak bisa sampai). Gagal DM tidak menghentikan proses.
  let dmStatus = '📨 DM terkirim';
  try {
    await user.send({
      components: [card(COLOR.warn, `⚠️ Kamu menerima warn di ${i.guild.name}`, [
        `**Alasan:** ${reason}`,
        `**Moderator:** ${i.user.username}`,
        `**Warn aktif:** ${count}`,
        `**Tindakan:** ${willAct ? describeStage(match.stage) : 'Tidak ada'}`,
      ], `Warn ini kedaluwarsa <t:${unix(expiresAt(warn, cfg))}:R>`)],
      flags: V2,
      allowedMentions: NO_PINGS,
    });
  } catch {
    dmStatus = '📪 DM gagal (DM member tertutup) — warn tetap tercatat';
  }

  if (willAct) actionText = `${await executeStage(i.guild, member, match.stage, `Eskalasi warn (${count} warn aktif)`)} (${stageLabel(g, match.stage)})`;

  const announce = card(COLOR.warn, '⚠️ Warn diberikan', [
    `**Member:** ${user} · \`${user.username}\``,
    `**Moderator:** ${i.user}`,
    `**Alasan:** ${reason}`,
    `**Warn aktif:** ${count} (berlaku ${cfg.expiryDays} hari)`,
    `**Tindakan:** ${actionText}`,
  ], `ID warn ${warn.id} • <t:${unix(warn.createdAt)}:f>`);
  const notes = await postToChannels(i.guild, [['mod-log', cfg.modLogChannelId], ['warn', cfg.warnChannelId]], {
    components: [announce], flags: V2, allowedMentions: NO_PINGS,
  });

  await i.editReply({
    components: [card(COLOR.ok, '✅ Warn tercatat', [
      `**Member:** ${user}`,
      `**Warn aktif:** ${count}`,
      `**Tindakan:** ${actionText}`,
      dmStatus,
      ...notes.map((n) => `⚠️ ${n}`),
    ])],
    flags: V2,
    allowedMentions: NO_PINGS,
  });
}

// ------------------------------------------------------------------ /mod warning-list
function listPanel(g, sid, page) {
  const rows = warnedMembers(g);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  page = Math.min(Math.max(0, page), pages - 1);

  const c = new ContainerBuilder()
    .setAccentColor(COLOR.info)
    .addTextDisplayComponents((t) => t.setContent(`## 📋 Member dengan warn aktif\n-# Warn berlaku ${g.config.expiryDays} hari • ${rows.length} member`))
    .addSeparatorComponents((s) => s.setDivider(true).setSpacing(SeparatorSpacingSize.Small));

  if (!rows.length) c.addTextDisplayComponents((t) => t.setContent('✨ Tidak ada member dengan warn aktif.'));
  rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).forEach((r, n) => {
    c.addTextDisplayComponents((t) => t.setContent(`**${page * PAGE_SIZE + n + 1}.** <@${r.userId}> — **${r.count}** warn aktif\n-# Warn terakhir <t:${unix(r.last)}:R>`));
    c.addActionRowComponents((row) => row.setComponents(
      new ButtonBuilder().setCustomId(`wl:${sid}:detail:${r.userId}`).setLabel('Lihat detail').setEmoji('🔎').setStyle(ButtonStyle.Secondary),
    ));
  });

  c.addSeparatorComponents((s) => s.setDivider(true).setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents((t) => t.setContent(`-# Halaman ${page + 1}/${pages} • tombol hanya untuk staff`))
    .addActionRowComponents((row) => row.setComponents(
      new ButtonBuilder().setCustomId(`wl:${sid}:prev`).setLabel('Sebelumnya').setEmoji('◀️').setStyle(ButtonStyle.Primary).setDisabled(page === 0),
      new ButtonBuilder().setCustomId(`wl:${sid}:next`).setLabel('Berikutnya').setEmoji('▶️').setStyle(ButtonStyle.Primary).setDisabled(page >= pages - 1),
    ));
  return { components: [c], page };
}

async function cmdList(i, g) {
  const sid = newId();
  const { components, page } = listPanel(g, sid, 0);
  store.setTemp(`panel:${sid}`, { guildId: i.guildId, page }, PANEL_TTL);
  await i.reply({ components, flags: V2, allowedMentions: NO_PINGS }); // publik
}

function detailCard(g, userId) {
  const warns = activeWarns(g, userId);
  const c = new ContainerBuilder()
    .setAccentColor(COLOR.warn)
    .addTextDisplayComponents((t) => t.setContent(`## 🔎 Detail warn\n<@${userId}> • **${warns.length}** warn aktif`))
    .addSeparatorComponents((s) => s.setDivider(true).setSpacing(SeparatorSpacingSize.Small));
  if (!warns.length) c.addTextDisplayComponents((t) => t.setContent('Member ini tidak punya warn aktif (sudah dihapus atau kedaluwarsa).'));
  const shown = warns.slice(-10).reverse(); // 10 terbaru
  for (const w of shown) {
    c.addTextDisplayComponents((t) => t.setContent([
      `**#${warns.indexOf(w) + 1}** • <t:${unix(w.createdAt)}:f>`,
      `**Alasan:** ${clip(w.reason, 250)}`,
      `**Moderator:** <@${w.moderatorId}>`,
      `-# Kedaluwarsa <t:${unix(expiresAt(w, g.config))}:R> • ID ${w.id}`,
    ].join('\n')));
  }
  if (warns.length > shown.length) c.addTextDisplayComponents((t) => t.setContent(`-# …dan ${warns.length - shown.length} warn yang lebih lama`));
  return c;
}

async function onListButton(i) {
  const g = store.guild(i.guildId);
  if (await denyIfNotStaff(i, g.config)) return;

  const [, sid, action, userId] = i.customId.split(':');
  const session = store.getTemp(`panel:${sid}`);
  if (!session) {
    await i.update({ components: [card(COLOR.danger, '⌛ Panel kedaluwarsa', ['Jalankan `/mod warning-list` lagi untuk melihat data terbaru.'])], flags: V2 });
    return;
  }

  if (action === 'detail') {
    await i.reply({ components: [detailCard(g, userId)], flags: PRIVATE_V2, allowedMentions: NO_PINGS });
  } else {
    const { components, page } = listPanel(g, sid, session.page + (action === 'next' ? 1 : -1));
    await i.update({ components, flags: V2, allowedMentions: NO_PINGS });
    session.page = page;
  }
  store.setTemp(`panel:${sid}`, session, PANEL_TTL); // perpanjang umur panel setiap dipakai
}

// ------------------------------------------------------------------ /mod warning-clear
async function cmdClear(i, g) {
  const user = i.options.getUser('member', true);
  const removed = activeWarns(g, user.id).length;
  g.warns = g.warns.filter((w) => !(w.userId === user.id && isActive(w, g.config)));
  store.save();

  let timeoutNote;
  const member = await i.guild.members.fetch(user.id).catch(() => null);
  if (!member) timeoutNote = 'ℹ️ Member tidak ada di server, timeout tidak dicek.';
  else if (!member.isCommunicationDisabled()) timeoutNote = 'ℹ️ Member tidak sedang timeout.';
  else {
    try {
      await member.timeout(null, `warning-clear oleh ${i.user.username}`);
      timeoutNote = '🔈 Timeout dicabut.';
    } catch (e) {
      timeoutNote = `⚠️ Gagal mencabut timeout: ${e.message}`;
    }
  }

  const lines = [`**Member:** ${user}`, `**Warn aktif dihapus:** ${removed}`, timeoutNote];
  const notes = await postToChannels(i.guild, [['mod-log', g.config.modLogChannelId]], {
    components: [card(COLOR.ok, '🧹 Warn dihapus', [...lines, `**Staff:** ${i.user}`], `<t:${unix(Date.now())}:f>`)],
    flags: V2, allowedMentions: NO_PINGS,
  });
  await i.reply({
    components: [card(COLOR.ok, removed ? '🧹 Warn dihapus' : '✨ Tidak ada warn aktif', [...lines, ...notes.map((n) => `⚠️ ${n}`)])],
    flags: PRIVATE_V2, allowedMentions: NO_PINGS,
  });
}

// ------------------------------------------------------------------ penyapu berkala
let sweeping = false;
async function sweep() {
  if (sweeping) return;
  sweeping = true;
  try {
    const now = Date.now();
    let changed = store.sweepTemp() > 0;
    for (const [guildId, g] of Object.entries(store.data.guilds)) {
      // warn lewat 365 hari tidak mungkin aktif lagi → hapus permanen
      const before = g.warns.length;
      g.warns = g.warns.filter((w) => now < w.createdAt + MAX_EXPIRY_DAYS * DAY);
      if (g.warns.length !== before) changed = true;

      const due = (g.tempBans ?? []).filter((b) => b.unbanAt <= now);
      const guild = client.guilds.cache.get(guildId);
      if (!due.length || !guild) continue;
      for (const b of due) {
        try {
          await guild.members.unban(b.userId, 'Ban sementara selesai');
          await postToChannels(guild, [['mod-log', g.config?.modLogChannelId]], {
            components: [card(COLOR.ok, '🔓 Ban sementara selesai', [`**Member:** <@${b.userId}>`], `Otomatis • <t:${unix(now)}:f>`)],
            flags: V2, allowedMentions: NO_PINGS,
          });
        } catch (e) {
          if (e.code !== 10026) { // 10026 = sudah tidak di-ban → anggap selesai
            console.error(`Gagal unban ${b.userId}:`, e.message);
            await postToChannels(guild, [['unban manual', g.config?.manualUnbanChannelId || g.config?.modLogChannelId]], {
              components: [card(COLOR.danger, '⚠️ Perlu unban manual', [
                `**Member:** <@${b.userId}>`,
                `Ban sementara sudah selesai, tapi unban otomatis gagal: ${e.message}`,
                'Silakan unban manual lewat Server Settings → Bans.',
              ], `<t:${unix(now)}:f>`)],
              flags: V2, allowedMentions: NO_PINGS,
            });
          }
        }
        g.tempBans = g.tempBans.filter((x) => x !== b);
        changed = true;
      }
    }
    if (changed) store.save();
  } finally {
    sweeping = false;
  }
}

// ------------------------------------------------------------------ event
client.once(Events.ClientReady, async (c) => {
  console.log(`✅ Login sebagai ${c.user.tag}`);
  const rest = new REST().setToken(process.env.TOKEN);
  await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), {
    body: commands.map((cmd) => cmd.toJSON()),
  });
  await sweep(); // kejar ketinggalan kalau bot sempat mati
  setInterval(() => sweep().catch((e) => console.error('Sweep gagal:', e)), SWEEP_EVERY);
});

client.on(Events.InteractionCreate, async (i) => {
  if (!i.inGuild()) return;
  try {
    if (i.isButton() && i.customId.startsWith('wl:')) return await onListButton(i);
    if (!i.isChatInputCommand()) return;

    if (i.commandName === 'mod') {
      const g = store.guild(i.guildId);
      if (await denyIfNotStaff(i, g.config)) return;
      const sub = i.options.getSubcommand();
      if (sub === 'warn') return await cmdWarn(i, g);
      if (sub === 'warning-list') return await cmdList(i, g);
      if (sub === 'warning-clear') return await cmdClear(i, g);
    }
  } catch (e) {
    console.error('Error saat menangani interaksi:', e);
    const msg = { content: '❌ Terjadi kesalahan. Cek log bot.', flags: MessageFlags.Ephemeral };
    if (i.deferred && !i.replied) await i.editReply({ content: msg.content }).catch(() => {});
    else if (!i.replied) await i.reply(msg).catch(() => {});
  }
});

// ------------------------------------------------------------------ panel "⚙ Test settings" (simulator)
// Di bot asli `globalThis.SIM` tidak ada, jadi blok ini otomatis diabaikan — di sana pakai settings.json.
globalThis.SIM?.registerSettings?.({
  description: 'Nilai untuk test server ini, disimpan ke settings.json. Di server asli, isi settings.json dengan ID role & channel server kamu lalu restart bot.',
  fields: [
    { key: 'staffRoleIds', label: 'Role yang boleh memakai perintah warn', type: 'roles' },
    { key: 'modLogChannelId', label: 'Channel mod-log (untuk staff)', type: 'channel' },
    { key: 'warnChannelId', label: 'Channel log warn untuk member', type: 'channel' },
    { key: 'expiryDays', label: 'Masa berlaku warn (hari)', type: 'number', min: 1, max: MAX_EXPIRY_DAYS },
    {
      key: 'escalation', label: 'Tahapan eskalasi hukuman berdasarkan jumlah warn', type: 'table',
      columns: [
        { key: 'warns', label: 'Jumlah warn', type: 'number', min: 1, max: 50 },
        { key: 'periodDays', label: 'Periode (hari)', type: 'number', min: 1, max: MAX_EXPIRY_DAYS },
        { key: 'action', label: 'Hukuman', type: 'select', options: Object.entries(ACTIONS).map(([value, label]) => ({ value, label })) },
        { key: 'duration', label: 'Durasi (angka)', type: 'number', min: 1, enabledWhen: { col: 'action', in: ['timeout', 'tempban'] } },
        { key: 'unit', label: 'Satuan durasi', type: 'select', options: [{ value: 'minutes', label: 'menit' }, { value: 'hours', label: 'jam' }, { value: 'days', label: 'hari' }], enabledWhen: { col: 'action', in: ['timeout', 'tempban'] } },
      ],
      newRow: { warns: 1, periodDays: 30, action: 'timeout', duration: 10, unit: 'minutes' },
    },
    { key: 'autoActions', label: 'Aktifkan hukuman otomatis dari eskalasi (mati secara default)', type: 'boolean' },
    { key: 'allowBan', label: 'Izinkan ban permanen otomatis dari eskalasi (mati secara default)', type: 'boolean' },
    { key: 'allowKick', label: 'Izinkan kick otomatis dari eskalasi (mati secara default)', type: 'boolean' },
    { key: 'allowTempban', label: 'Izinkan ban sementara otomatis (mati secara default)', type: 'boolean' },
    { key: 'manualUnbanChannelId', label: 'Channel staff untuk ban sementara yang perlu unban manual', type: 'channel' },
  ],
  get: () => settingsToFile(settings),
  set(values) {
    const { config, error } = settingsFromFile(values);
    if (error) return error;
    settings = config;
    saveSettings(settings);
    return null;
  },
});

client.login(process.env.TOKEN);
