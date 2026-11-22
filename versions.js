/* =====================================================================
   Catatan versi — tampil di tombol "📜 Versi" di simulator.
   Tambahkan entri baru PALING ATAS setiap ada update.
   type: 'baru' | 'ubah' | 'fix'
   ===================================================================== */
window.SIM_VERSIONS = [
  {
    version: '1.5.1',
    date: '2026-11-22',
    title: 'Perbaikan Test settings',
    changes: [
      { type: 'fix', text: 'Tahap eskalasi yang diganti dari Kick/Ban ke Timeout tidak lagi error "Timeout butuh durasi" — satuan durasi ikut pilihan yang tampil.' },
      { type: 'fix', text: 'settings.json: satuan durasi yang salah sekarang diberi pesan jelas (minutes, hours, atau days).' },
    ],
  },
  {
    version: '1.5',
    date: '2026-11-22',
    title: 'Lihat & hapus warn tertentu',
    changes: [
      { type: 'baru', text: '/mod warning-detail member: warn aktif member (tampilan detail warn), privat ke staff, 10 per halaman.' },
      { type: 'baru', text: 'Tombol 🗑 Hapus di tiap warn, dengan konfirmasi "Ya, hapus / Batal" — cuma warn itu yang dihapus.' },
      { type: 'baru', text: 'Penghapusan dicatat di mod-log dan tetap muncul di /mod warning-history (🧹 Dihapus oleh …).' },
    ],
  },
  {
    version: '1.4',
    date: '2026-11-22',
    title: 'Riwayat warn all time',
    changes: [
      { type: 'baru', text: '/mod warning-history: riwayat semua warn member (aktif, kedaluwarsa, dihapus), privat ke staff, 10 per halaman.' },
      { type: 'ubah', text: '/mod warning-clear tidak lagi menghapus data warn — warn ditandai "dihapus oleh siapa, kapan" supaya tetap ada di riwayat.' },
      { type: 'ubah', text: 'Warn lama tidak dibuang lagi setelah 365 hari.' },
      { type: 'fix', text: 'Pesan di chat tidak lagi saling tumpuk saat chat penuh.' },
      { type: 'baru', text: 'Simulator: tombol 📜 Versi untuk melihat catatan update ini.' },
    ],
  },
  {
    version: '1.3',
    date: '2026-11-22',
    title: 'Slash command ala Discord & DM per user',
    changes: [
      { type: 'baru', text: 'Composer slash ala Discord: label /command, kotak per opsi, popup pilih member/role/channel.' },
      { type: 'ubah', text: 'Kotak "DM dari bot" dipisah per user — cuma DM untuk user yang sedang dipakai yang muncul.' },
      { type: 'fix', text: 'Seluruh halaman tidak ikut scroll; cuma area chat yang scroll.' },
    ],
  },
  {
    version: '1.2',
    date: '2026-11-22',
    title: 'Pengaturan pindah ke Test settings & settings.json',
    changes: [
      { type: 'baru', text: 'Tombol ⚙ Test settings: semua pengaturan modul warn dalam satu panel.' },
      { type: 'baru', text: 'Role staff bisa lebih dari satu; izin terpisah untuk kick, ban sementara, ban permanen otomatis.' },
      { type: 'baru', text: 'Channel staff untuk ban sementara yang perlu unban manual.' },
      { type: 'ubah', text: '/mod-settings dihapus — pengaturan disimpan di settings.json (pengaturan lama dipindah otomatis).' },
    ],
  },
  {
    version: '1.1',
    date: '2026-11-22',
    title: 'Modul moderasi warn',
    changes: [
      { type: 'baru', text: '/mod warn: kartu Components V2 ke mod-log & channel warn + DM ke member (DM gagal tidak menghentikan warn).' },
      { type: 'baru', text: '/mod warning-list: panel publik 10 member per halaman, tombol Lihat detail, hanya staff.' },
      { type: 'baru', text: '/mod warning-clear: hapus warn aktif + cabut timeout.' },
      { type: 'baru', text: 'Masa berlaku warn & eskalasi (timeout, kick, ban sementara, ban permanen) dengan sakelar pengaman, mati secara default.' },
      { type: 'baru', text: 'Simulator: Components V2, ban/unban, DM tertutup, fs tiruan, tes otomatis (?test).' },
    ],
  },
  {
    version: '1.0',
    date: '2026-11-22',
    title: 'Simulator Discord',
    changes: [
      { type: 'baru', text: 'Tampilan ala Discord: channel, member, ganti user & role, chat.' },
      { type: 'baru', text: 'Tiruan discord.js v14: prefix & slash command, embed, tombol, reaksi, ephemeral, defer.' },
      { type: 'baru', text: 'Waktu virtual (+1 menit / +1 jam) dan konsol bot.' },
    ],
  },
];
