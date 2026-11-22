# Discord Bot Simulator

Simulasi server Discord di browser buat ngetes bot **discord.js v14** tanpa token, tanpa server asli.

## Cara buka
Klik dua kali `index.html` (buka di Chrome/Edge). Selesai.
Tes otomatis: buka `index.html?test` → hasil PASS/FAIL muncul di 🖥 Konsol.

## File
| File | Fungsinya |
|---|---|
| `bot.js` | **Bot kamu.** Sekarang berisi modul moderasi warn. |
| `settings.json` | Pengaturan bot (dibuat otomatis; di simulator disimpan di browser). |
| `versions.js` | Catatan update per versi — tampil di tombol **📜 Versi** (entri baru ditaruh paling atas). |
| `tests.js` | Tes otomatis modul warn (jalan hanya dengan `?test`). |
| `discord-mock.js` | Tiruan discord.js + server palsu. Nggak perlu diubah. |
| `ui.js`, `sim.css`, `index.html` | Tampilan ala Discord. Nggak perlu diubah. |

Setelah edit `bot.js`, simpan → klik **↻ Restart bot**. Pesan di-reset, tapi **data bot tetap tersimpan**
(file `data/moderation.json` disimpan di browser). Klik **🗑 Reset data** untuk mulai dari nol.

## Modul warn

### Pengaturan di simulator — tombol **⚙ Test settings**
Di bawah nama server ada tombol **⚙ Test settings**. Isinya semua pengaturan modul warn dalam satu panel:
role staff (bisa lebih dari satu), channel mod-log, channel log warn, masa berlaku, tabel tahap eskalasi
(jumlah warn, periode, hukuman, durasi + satuan), sakelar hukuman otomatis + izin ban permanen/kick/ban sementara,
dan channel untuk ban sementara yang perlu unban manual. Klik **Simpan** → langsung dipakai bot tanpa restart.

Panel ini didaftarkan dari `bot.js` lewat `globalThis.SIM?.registerSettings?.(...)` dan menyimpan ke file
`settings.json`. Di bot asli baris itu otomatis diabaikan (tidak ada `SIM`).

### Pengaturan di server asli — file `settings.json`
Dibuat otomatis saat bot pertama jalan. Isi dengan ID role & channel server kamu (klik kanan → Copy ID,
nyalakan Developer Mode di Discord), lalu restart bot. Contoh:

```json
{
  "staffRoleIds": ["123456789012345678"],
  "modLogChannelId": "234567890123456789",
  "warnChannelId": "345678901234567890",
  "manualUnbanChannelId": null,
  "expiryDays": 30,
  "autoActions": false,
  "allowBan": false,
  "allowKick": false,
  "allowTempban": false,
  "escalation": [
    { "warns": 3, "periodDays": 30, "action": "timeout", "duration": 1, "unit": "hours" },
    { "warns": 5, "periodDays": 30, "action": "timeout", "duration": 1, "unit": "days" },
    { "warns": 7, "periodDays": 60, "action": "tempban", "duration": 7, "unit": "days" }
  ]
}
```
`action`: `none`, `timeout`, `kick`, `tempban`, `ban`. `unit`: `minutes`, `hours`, `days`.
Kalau isinya tidak valid, bot menulis alasannya di log dan memakai pengaturan default (semua sakelar mati).

Eskalasi default: ≥3 warn/30 hari → timeout 1 jam, ≥5/30 hari → timeout 1 hari, ≥7/60 hari → ban sementara 7 hari.
Kalau beberapa tahap terpenuhi, yang dipakai tahap dengan jumlah warn tertinggi. Timeout cukup pakai sakelar utama;
kick, ban sementara, dan ban permanen butuh sakelar utama **dan** izinnya masing-masing. Kalau belum diizinkan,
kartu warn cuma menulis tindakan yang *akan* dijalankan.

### Command staff
- `/mod warn member: reason:` → kartu Components V2 ke #mod-log dan channel warn (member, moderator, alasan,
  jumlah warn aktif, tindakan) + DM ke member. Kalau DM gagal, warn & pengumuman tetap jalan.
- `/mod warning-list` → panel publik, 10 member per halaman, tombol **Sebelumnya/Berikutnya** + **Lihat detail**
  per member. Semua tombol cuma bisa dipakai staff; detail dikirim privat. Panel kedaluwarsa 15 menit setelah terakhir dipakai.
- `/mod warning-clear member:` → hapus warn aktif + coba cabut timeout (kalau tidak sedang timeout, staff dikasih tahu).
  Warn-nya tidak benar-benar dihapus dari data, cuma ditandai "dihapus" supaya tetap ada di riwayat.
- `/mod warning-detail member:` → warn aktif satu member (privat ke staff), 10 per halaman. Tiap warn punya tombol
  **🗑 Hapus** → konfirmasi **Ya, hapus / Batal** → cuma warn itu yang dibatalkan, dicatat di mod-log & riwayat.
- `/mod warning-history member:` → riwayat **all time** semua warn member (privat ke staff), terbaru dulu,
  10 per halaman. Tiap warn diberi status 🟢 aktif / ⚪ kedaluwarsa / 🧹 dihapus (oleh siapa, kapan).

Warn kedaluwarsa tidak dihitung di mana pun (eskalasi, daftar, detail, penghapusan), tapi tetap disimpan
selamanya untuk riwayat. Ban sementara di-unban otomatis (dicek tiap menit, juga saat bot baru nyala).

### Cara ngetes manual di simulator
1. Klik **⚙ Test settings** → tambah role @Staff, pilih #mod-log dan #warnings → Simpan.
2. Ganti ke **Alex** (staff): `/mod warn member: @Riley reason: spam`.
3. Centang **"DM … tertutup"** di kiri bawah buat ngetes DM gagal.
4. Pakai **⏩ +1 jam** buat ngetes ban sementara / masa berlaku. Ganti ke **Riley** (bukan staff) buat ngetes akses.

## Fitur simulator
- Chat, slash command (ketik `/`, ↑↓ + Tab; opsi format `nama: nilai`, user pakai `@Nama`), embed, tombol, **Components V2**.
- 14 user palsu + bot, role bisa diklik buat pasang/lepas, channel #general/#mod-log/#warnings, kotak "DM dari bot".
- Waktu virtual: `⏩ +1 menit/+1 jam` memajukan `setTimeout`, `setInterval`, `Date.now()`.
- `fs` & `path` tiruan (disimpan di localStorage) supaya kode penyimpanan sama persis dengan bot asli.
- Kick/ban/timeout/unban; user yang di-ban tidak bisa join sampai di-unban.
- Konsol 🖥 untuk `console.log` & error. Interaksi yang tidak dibalas 3 detik → "Aplikasi tidak merespons".
- Validasi ala Discord: maks 40 komponen V2, teks 4000 karakter, content+V2 tidak boleh barengan, dll.

Belum ada: select menu, modal, thread, voice, lampiran file.

## Pindah ke bot asli
1. Bikin bot di https://discord.com/developers/applications → tab **Bot** → Reset Token, nyalakan **Server Members Intent**.
2. Undang bot (OAuth2 → URL Generator → scope `bot` + `applications.commands`, izin: Moderate Members, Kick Members,
   Ban Members, Send Messages, View Channels).
3. Di folder bot:
   ```
   npm init -y
   npm install discord.js@^14.19 dotenv
   ```
   (Components V2 butuh discord.js 14.19 atau lebih baru.)
4. Bikin file `.env`:
   ```
   TOKEN=token_bot_kamu
   CLIENT_ID=application_id_bot
   GUILD_ID=id_server_kamu
   ```
5. Copy `bot.js` ke folder itu, lalu jalankan `node bot.js`. Bot membuat `settings.json` (isi ID role & channel, lalu
   restart bot) dan menyimpan data warn di `data/moderation.json`.

Role bot harus **di atas** role member yang mau di-timeout/kick/ban, dan pemilik server tidak bisa dikenai tindakan.
