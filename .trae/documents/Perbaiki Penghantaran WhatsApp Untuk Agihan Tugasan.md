## Punca & Objektif
- Punca utama kegagalan: gateway Wasapmatic memulangkan 400 "Invalid phone number" untuk penerima 601267276502 (tanpa tanda +). 
- Objektif: Pastikan semua penghantaran WhatsApp dalam aliran Agihan Tugasan menggunakan format MSISDN antarabangsa yang diterima gateway (contoh +60123456789), dengan validasi awal dan maklum balas yang jelas kepada pengguna.

## Perubahan Backend
1. Normalisasi nombor di server sebelum enqueue & sending:
- Tambah util `normalizeMsisdn(to)` yang:
  - Buang aksara bukan digit
  - Jika bermula "0", tukar kepada "60" dan prapend tanda "+" → `+60...`
  - Jika bermula "60", prapend tanda "+" → `+60...`
  - Jika sudah `+60...`, kekalkan
  - Validasi panjang selepas kod negara (9–11 digit, ikut pola mudah Malaysia)
- Guna util ini di:
  - Endpoint `/api/wasapmatic/send` (validasi awal; jika tak sah, balas 400 tanpa enqueue)
  - Worker `messageQueueService` sebelum hantar ke gateway (hardening tambahan)

2. Validasi & Error Handling
- Jika nombor tidak sah: log `SYSTEM` audit entry dengan sebab ("Invalid MSISDN format") dan balas ke klien dengan mesej mudah faham.
- Jangan tukar status tugasan kepada "Tawaran Dihantar" jika tiada mesej berjaya diserahkan untuk semua penerima.

3. Audit Trail
- Tambah `correlation_id` dan nombor penerima normalisasi pada `new_values` untuk setiap langkah.
- Kekalkan modal "Butiran Audit" (sudah ada) untuk melihat JSON penuh.

## Perubahan Frontend
1. Agihan Tugasan (AssignTechModal & App flow)
- Sebelum panggil `/wasapmatic/send`, paparkan amaran jika nombor freelancer berformat luar (contoh tiada kod negara) dan tunjuk nombor yang akan digunakan selepas normalisasi.
- Jika gateway balas invalid: paparkan toast error dengan tindakan "Edit Freelancer" (buka profil untuk kemaskini nombor).
- Hanya set status tugasan "Tawaran Dihantar" jika sekurang-kurangnya satu mesej berjaya enqueue dan tiada validation gagal.

2. Jejak Audit
- Kekalkan butang "Audit" pada setiap tugasan untuk buka Jejak Audit dengan carian `TX-<taskId>-` (sudah ditambah).

## Ujian & Pengesahan
- Kes berjaya: `012xxxxxxx` → normalisasi `+6012xxxxxxx`, gateway balas OK.
- Kes gagal: nombor terlalu pendek/panjang → balas 400 dari `/send`, Audit Trail rekod sebab.
- Uji multi-penerima: campuran sah/tidak sah, pastikan hanya sah dihantar dan status tugasan dikemas kini dengan betul.
- Semak Audit Trail dan modal butiran untuk melihat response provider.

## Nota Operasi
- Jika device Wasapmatic offline atau quota tamat, audit akan tunjuk error provider; pembaikan format nombor tidak mengatasi isu device/quota.

Sahkan pelan ini; selepas disahkan saya akan buat perubahan kod, jalankan semula server, dan uji aliran Agihan untuk memastikan mesej sampai dengan format `+60…`. 