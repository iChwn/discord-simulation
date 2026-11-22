/* =====================================================================
   Tes otomatis modul warn. Jalan hanya kalau halaman dibuka dengan ?test
   contoh: index.html?test   → hasil muncul di Konsol (PASS/FAIL).
   Data tes disimpan terpisah dan dihapus setiap tes dimulai.
   ===================================================================== */
(function () {
  'use strict';
  const S = window.SIM;
  if (!S || !S.TEST) return;

  const N = S.native;
  const wait = (ms) => new Promise((r) => N.setTimeout(r, ms));
  const results = [];
  const ok = (name, cond, info = '') => {
    results.push({ name, pass: !!cond, info });
    S.log(cond ? 'info' : 'error', `${cond ? '✅ PASS' : '❌ FAIL'} — ${name}${!cond && info ? `\n   ${info}` : ''}`);
  };

  const ID = { kamu: '100', alex: '101', riley: '102', sam: '103', budi: '110', citra: '111', hadi: '116' };
  const name = (id) => S.user(id).username;
  const text = (r) => S.textOf(r);
  const since = (n) => S.records.slice(n);

  async function slash(cmd, as, channel = '301') {
    S.currentUserId = as; S.currentChannelId = channel;
    const n = S.records.length;
    const res = S.runSlash(cmd);
    await wait(120);
    return { res, recs: since(n) };
  }
  async function click(rec, match, as) {
    S.currentUserId = as;
    const btn = S.buttonsOf(rec).find((b) => (typeof match === 'function' ? match(b) : b.label === match));
    if (!btn) throw new Error(`Tombol "${match}" tidak ada`);
    const n = S.records.length;
    S.clickButton(rec, btn);
    await wait(120);
    return since(n);
  }
  const g = () => JSON.parse(localStorage.getItem('simfs-test:/bot/data/moderation.json') || '{}').guilds?.[S.GUILD_ID];
  const cfgFile = () => JSON.parse(localStorage.getItem('simfs-test:/bot/settings.json') || 'null');
  const warnsOf = (id) => (g()?.warns || []).filter((w) => w.userId === id);
  // ubah pengaturan lewat panel Test settings (sama seperti klik Simpan)
  const setCfg = (patch) => { const e = S.settingsDef.set({ ...S.settingsDef.get(), ...patch }); if (e) throw new Error(e); };
  const setStages = (fn) => { const v = S.settingsDef.get(); v.escalation = fn(v.escalation); return S.settingsDef.set(v); };

  async function run() {
    S.log('sys', '🧪 Menjalankan tes modul warn…');
    await wait(900); // tunggu bot online + command terdaftar
    ok('Bot online & hanya /mod yang terdaftar', S.ready && S.commands.map((c) => c.name).join() === 'mod');

    // ---------- settings.json
    let cfg = cfgFile();
    ok('settings.json dibuat otomatis dengan default', cfg && cfg.expiryDays === 30 && cfg.escalation.length === 3 && cfg.escalation[0].unit === 'hours');
    ok('Semua sakelar tindakan otomatis mati secara default', !cfg.autoActions && !cfg.allowKick && !cfg.allowTempban && !cfg.allowBan);
    let r = await slash('/mod warn member: @Sam reason: tes', ID.alex);
    ok('Sebelum role staff diatur: member non-admin ditolak', r.recs.some((x) => x.ephemeralFor === ID.alex && /Role staff belum diatur/.test(text(x))) && warnsOf(ID.sam).length === 0);

    // ---------- panel Test settings
    const def = S.settingsDef;
    ok('bot.js mendaftarkan panel Test settings', def && def.fields.length >= 10);
    setCfg({ staffRoleIds: ['203', '202'], modLogChannelId: '302', warnChannelId: '303', manualUnbanChannelId: '302' });
    cfg = cfgFile();
    ok('Panel menyimpan ke settings.json (role staff ganda, channel)', cfg.staffRoleIds.join() === '203,202' && cfg.modLogChannelId === '302' && cfg.warnChannelId === '303' && cfg.manualUnbanChannelId === '302');
    setCfg({ staffRoleIds: ['203'] });
    let v = def.get();
    ok('Panel membaca pengaturan (durasi → angka + satuan)', v.staffRoleIds.join() === '203' && v.escalation[0].duration === 1 && v.escalation[0].unit === 'hours');
    v.expiryDays = 0;
    ok('Panel menolak masa berlaku 0 hari', /1–365/.test(def.set(v) || ''));
    v = def.get(); v.expiryDays = 400;
    ok('Panel menolak masa berlaku > 365 hari', /1–365/.test(def.set(v) || ''));
    ok('Panel menolak jumlah warn kembar', /dua kali/.test(setStages((e) => [...e, { warns: 3, periodDays: 30, action: 'kick' }]) || ''));
    ok('Panel menolak timeout > 28 hari', /28 hari/.test(setStages((e) => { e[0].unit = 'days'; e[0].duration = 40; return e; }) || ''));
    ok('Panel menolak ban sementara tanpa durasi', /butuh durasi/.test(setStages((e) => [...e, { warns: 2, periodDays: 7, action: 'tempban', duration: '', unit: 'hours' }]) || ''));
    ok('Pengaturan tidak berubah kalau ditolak', cfgFile().expiryDays === 30 && cfgFile().escalation.length === 3);
    document.getElementById('open-settings').click();
    await wait(50);
    const modal = document.getElementById('settings-modal');
    ok('Tombol Test settings membuka panel', !modal.classList.contains('hidden') && /Tahapan eskalasi/.test(modal.textContent) && modal.querySelectorAll('.sm-table tbody tr').length >= 4);
    modal.querySelector('[data-sm="close"]').click();

    // ---------- akses staff
    r = await slash('/mod warn member: @Sam reason: spam', ID.riley);
    ok('Non-staff tidak bisa /mod warn', r.recs.some((x) => x.ephemeralFor === ID.riley && /Hanya staff/.test(text(x))) && warnsOf(ID.sam).length === 0);
    r = await slash('/mod warning-list', ID.riley);
    ok('Non-staff tidak bisa /mod warning-list', r.recs.every((x) => x.ephemeralFor === ID.riley));
    r = await slash('/mod warning-clear member: @Sam', ID.riley);
    ok('Non-staff tidak bisa /mod warning-clear', r.recs.every((x) => x.ephemeralFor === ID.riley));

    // ---------- /mod warn
    r = await slash('/mod warn member: @Riley reason: spam link', ID.alex);
    await wait(200);
    const all = since(0);
    const inLog = all.filter((x) => x.channelId === '302' && x.v2 && /Warn diberikan/.test(text(x)));
    const inWarn = all.filter((x) => x.channelId === '303' && x.v2 && /Warn diberikan/.test(text(x)));
    const card = inWarn.at(-1);
    ok('Kartu V2 terkirim ke #mod-log dan #warnings', inLog.length === 1 && inWarn.length === 1);
    ok('Kartu berisi member, moderator, alasan, jumlah warn, tindakan',
      card && /<@102>/.test(text(card)) && /<@101>/.test(text(card)) && /spam link/.test(text(card)) && /Warn aktif:\*\* 1/.test(text(card)) && /Tindakan:/.test(text(card)));
    ok('DM warn terkirim ke member', all.some((x) => x.channelId === 'dm' && x.dmTo === ID.riley && /spam link/.test(text(x))));
    ok('Staff dapat konfirmasi privat', all.some((x) => x.ephemeralFor === ID.alex && /Warn tercatat/.test(text(x))));

    S.user(ID.sam).dmClosed = true;
    r = await slash('/mod warn member: @Sam reason: toxic', ID.alex);
    await wait(200);
    const samCards = since(0).filter((x) => x.channelId === '303' && /<@103>/.test(text(x)));
    ok('DM gagal → warn & pengumuman tetap jalan', warnsOf(ID.sam).length === 1 && samCards.length === 1 &&
      since(0).some((x) => x.ephemeralFor === ID.alex && /DM gagal/.test(text(x))));
    S.user(ID.sam).dmClosed = false;

    r = await slash('/mod warn member: @Alex reason: tes', ID.alex);
    ok('Tidak bisa warn diri sendiri', r.recs.some((x) => /diri sendiri/.test(text(x))) && warnsOf(ID.alex).length === 0);
    r = await slash('/mod warn member: @TestBot reason: tes', ID.alex);
    ok('Bot tidak bisa diberi warn', r.recs.some((x) => /Bot tidak bisa/.test(text(x))));

    // ---------- eskalasi dengan sakelar mati
    await slash('/mod warn member: @Riley reason: spam 2', ID.alex);
    r = await slash('/mod warn member: @Riley reason: spam 3', ID.alex);
    await wait(200);
    let last = since(0).filter((x) => x.channelId === '303').at(-1);
    ok('Sakelar mati: tahap tercapai tapi tidak dijalankan', /tidak dijalankan/.test(text(last)) && !(S.user(ID.riley).timeoutUntil > S.vNow()));

    // ---------- eskalasi aktif: timeout
    setCfg({ autoActions: true });
    r = await slash('/mod warn member: @Riley reason: spam 4', ID.alex);
    await wait(250);
    last = since(0).filter((x) => x.channelId === '303').at(-1);
    ok('Sakelar aktif: 4 warn → timeout 1 jam dijalankan', S.user(ID.riley).timeoutUntil > S.vNow() && /Timeout 1 jam ✅/.test(text(last)));

    // ---------- eskalasi: atur tahap ban sementara, lalu unban otomatis
    setStages((e) => [...e, { warns: 2, periodDays: 7, action: 'tempban', duration: 2, unit: 'hours' }]);
    ok('Tahap eskalasi tersimpan & terurut', cfgFile().escalation.map((s) => s.warns).join(',') === '2,3,5,7');
    await slash('/mod warn member: @Hadi reason: x', ID.alex);
    await slash('/mod warn member: @Hadi reason: y', ID.alex);
    await wait(250);
    last = since(0).filter((x) => x.channelId === '303').at(-1);
    ok('Ban sementara belum diizinkan → tidak dijalankan', !S.user(ID.hadi).gone && /ban sementara otomatis tidak diizinkan/.test(text(last)));
    await slash('/mod warning-clear member: @Hadi', ID.alex);
    setCfg({ allowTempban: true, allowKick: true });
    ok('Izin per hukuman tersimpan', cfgFile().allowTempban && cfgFile().allowKick && !cfgFile().allowBan);
    await slash('/mod warn member: @Budi reason: flood', ID.alex);
    await slash('/mod warn member: @Budi reason: flood lagi', ID.alex);
    await wait(250);
    ok('2 warn dalam 7 hari → ban sementara', S.user(ID.budi).gone === 'ban' && g().tempBans.some((b) => b.userId === ID.budi));
    S.advance(3 * 3600e3);
    await wait(300);
    ok('Ban sementara selesai → unban otomatis + log', S.user(ID.budi).gone === 'unbanned' && !g().tempBans.length &&
      since(0).some((x) => x.channelId === '302' && /Ban sementara selesai/.test(text(x))));
    S.rejoin(ID.budi, true);

    // ---------- eskalasi: periode per tahap
    setStages((e) => e.filter((x) => x.warns !== 2).concat({ warns: 2, periodDays: 1, action: 'kick' }));
    await slash('/mod warn member: @Citra reason: a', ID.alex);
    S.advance(2 * 86400e3);
    await wait(150);
    await slash('/mod warn member: @Citra reason: b', ID.alex);
    await wait(250);
    ok('Warn di luar periode tahap tidak memicu tahap itu', !S.user(ID.citra).gone && warnsOf(ID.citra).length === 2);
    await slash('/mod warn member: @Citra reason: c', ID.alex);
    await wait(250);
    ok('Beberapa tahap terpenuhi → tahap tertinggi dipakai (timeout, bukan kick)', !S.user(ID.citra).gone && S.user(ID.citra).timeoutUntil > S.vNow());
    await slash('/mod warn member: @Dewi reason: a', ID.alex);
    await slash('/mod warn member: @Dewi reason: b', ID.alex);
    await wait(250);
    ok('2 warn dalam 1 hari → kick', S.user('112').gone === 'kick');
    S.rejoin('112', true);
    setCfg({ autoActions: false });

    // ---------- warning-list + pagination (butuh >10 member)
    for (const u of S.users.filter((x) => !x.bot && !x.owner && x.id !== ID.alex && !warnsOf(x.id).length)) {
      await slash(`/mod warn member: @${u.username} reason: massal`, ID.kamu);
    }
    const warnedCount = new Set((g().warns).map((w) => w.userId)).size;
    r = await slash('/mod warning-list', ID.alex);
    let panel = r.recs.find((x) => x.v2 && /Member dengan warn aktif/.test(text(x)));
    ok('warning-list publik (bukan ephemeral) berbentuk Components V2', panel && !panel.ephemeralFor && panel.v2);
    const details = () => S.buttonsOf(panel).filter((b) => b.label === 'Lihat detail');
    const btn = (label) => S.buttonsOf(panel).find((b) => b.label === label);
    ok(`Maks 10 member per halaman (total ${warnedCount})`, warnedCount > 10 && details().length === 10);
    ok('Halaman 1: Sebelumnya nonaktif, Berikutnya aktif', btn('Sebelumnya').disabled && !btn('Berikutnya').disabled);

    let out = await click(panel, 'Berikutnya', ID.riley);
    ok('Non-staff tidak bisa pakai tombol navigasi', out.some((x) => x.ephemeralFor === ID.riley && /Hanya staff/.test(text(x))) && /Halaman 1\//.test(text(panel)));
    out = await click(panel, 'Lihat detail', ID.riley);
    ok('Non-staff tidak bisa pakai tombol detail', out.some((x) => x.ephemeralFor === ID.riley && /Hanya staff/.test(text(x))) && !out.some((x) => /Detail warn/.test(text(x))));

    await click(panel, 'Berikutnya', ID.alex);
    ok('Berikutnya → halaman 2', /Halaman 2\/2/.test(text(panel)) && details().length === warnedCount - 10 && btn('Berikutnya').disabled && !btn('Sebelumnya').disabled);
    await click(panel, 'Sebelumnya', ID.alex);
    ok('Sebelumnya → kembali ke halaman 1', /Halaman 1\/2/.test(text(panel)) && details().length === 10);

    const rileyBtn = (b) => b.custom_id?.endsWith(':detail:' + ID.riley);
    out = await click(panel, rileyBtn, ID.alex);
    const det = out.find((x) => /Detail warn/.test(text(x)));
    ok('Detail dikirim privat ke staff', det && det.ephemeralFor === ID.alex);
    ok('Detail memuat waktu, alasan, moderator, jumlah warn aktif',
      det && /<t:\d+:f>/.test(text(det)) && /spam link/.test(text(det)) && /Moderator:\*\* <@101>/.test(text(det)) && /\*\*4\*\* warn aktif/.test(text(det)));

    // ---------- warning-clear
    S.user(ID.riley).timeoutUntil = S.vNow() + 3600e3; // pastikan sedang timeout
    r = await slash('/mod warning-clear member: @Riley', ID.alex);
    await wait(200);
    ok('warning-clear hapus warn aktif & cabut timeout', warnsOf(ID.riley).length === 0 && !(S.user(ID.riley).timeoutUntil > S.vNow()) &&
      r.recs.some((x) => x.ephemeralFor === ID.alex && /Timeout dicabut/.test(text(x))));
    r = await slash('/mod warning-clear member: @Sam', ID.alex);
    await wait(200);
    ok('Member tidak timeout → staff diberi tahu, warn tetap dihapus', warnsOf(ID.sam).length === 0 &&
      r.recs.some((x) => x.ephemeralFor === ID.alex && /tidak sedang timeout/.test(text(x))));
    ok('warning-clear tercatat di mod-log', since(0).some((x) => x.channelId === '302' && /Warn dihapus/.test(text(x))));

    // ---------- masa berlaku
    setCfg({ expiryDays: 1 });
    S.advance(2 * 86400e3);
    await wait(150);
    r = await slash('/mod warning-list', ID.alex);
    const panel2 = r.recs.find((x) => /Member dengan warn aktif/.test(text(x)));
    ok('Warn kedaluwarsa tidak muncul di daftar', /Tidak ada member dengan warn aktif/.test(text(panel2)));
    out = await click(panel, rileyBtn, ID.alex); // panel lama sudah > 15 menit → kedaluwarsa
    ok('Panel lama kedaluwarsa (data sementara ber-TTL)', /Panel kedaluwarsa/.test(text(panel)));
    const budiOld = warnsOf(ID.budi).length;
    r = await slash('/mod warning-clear member: @Budi', ID.alex);
    ok('Warn kedaluwarsa tidak ikut dihitung saat penghapusan', budiOld > 0 && r.recs.some((x) => /Warn aktif dihapus:\*\* 0/.test(text(x))) && warnsOf(ID.budi).length === budiOld);
    setCfg({ autoActions: true });
    r = await slash('/mod warn member: @Budi reason: baru', ID.alex);
    await wait(250);
    last = since(0).filter((x) => x.channelId === '303').at(-1);
    ok('Warn kedaluwarsa tidak dihitung untuk eskalasi', /Warn aktif:\*\* 1 /.test(text(last)) && !S.user(ID.budi).gone && !(S.user(ID.budi).timeoutUntil > S.vNow()));
    // panel baru, detail member kedaluwarsa
    setCfg({ expiryDays: 1 });
    r = await slash('/mod warning-list', ID.alex);
    const p3 = r.recs.find((x) => /Member dengan warn aktif/.test(text(x)));
    out = await click(p3, (b) => b.label === 'Lihat detail', ID.alex);
    ok('Detail hanya menampilkan warn aktif', out.some((x) => /\*\*1\*\* warn aktif/.test(text(x)) && /baru/.test(text(x)) && !/flood/.test(text(x))));

    // ---------- tidak ada error di konsol
    const errs = S.logs.filter((l) => l.level === 'error' && !/FAIL/.test(l.text));
    ok('Tidak ada error dari bot', errs.length === 0, errs.map((e) => e.text).join('\n'));

    const pass = results.filter((x) => x.pass).length;
    const summary = `🧪 Hasil tes: ${pass}/${results.length} lulus`;
    S.log(pass === results.length ? 'sys' : 'error', summary);
    S.hooks.toast(summary, pass === results.length ? 'Semua tes lulus 🎉' : 'Ada yang gagal — cek Konsol');
    window.TEST_RESULTS = results;
    document.getElementById('console').classList.remove('hidden');
  }

  run().catch((e) => { S.log('error', '❌ Tes berhenti karena error:', e); window.TEST_RESULTS = results.concat({ name: 'crash', pass: false, info: String(e && e.stack || e) }); });
})();
