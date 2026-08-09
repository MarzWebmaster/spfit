# Tetapan Default Paparan Kolum (Task & Masterlist)

Dokumen ini menerangkan susunan kolum dan tetapan paparan default untuk modul Tugasan dan Masterlist, termasuk cara sistem menyimpan pilihan pengguna.

## 1) Tugasan (TaskManagementPage)

### Default susunan kolum (kiri → kanan)
1. Tarikh Buka (`created_at`)
2. Status (`status`)
3. Daerah (`district`)
4. Negeri (`state`)
5. Tajuk Tugasan (`title`)
6. Freelancer (`freelancer`)
7. Harga (RM) (`offer_price`)
8. Lokasi (`location`)

### Default visibility
- Dipaparkan: `created_at`, `status`, `district`, `state`, `title`, `freelancer`, `offer_price`
- Disembunyikan: `location`

### Simpanan setting pengguna (localStorage)
- Visible map: `spfit_task_columns_<userId>`
- Order array: `spfit_task_columns_order_<userId>`

## 2) Masterlist (MasterlistsPage)

### Default susunan kolum (kiri → kanan)
1. Status (`status`)
2. Dikemaskini (`updated_at`)
3. Nama (`name`)
4. Projek (`project`)
5. Bil. Aset (`asset_count`)
6. Keterangan (`description`)
7. Dibuat (`created_at`)
8. Kod (`code`)

### Default visibility
- Dipaparkan: `status`, `updated_at`, `name`, `project`, `asset_count`
- Disembunyikan: `description`, `created_at`, `code`

### Simpanan setting pengguna (localStorage)
- Visible map: `spfit_masterlists_columns_<userId>`
- Order array: `spfit_masterlists_columns_order_<userId>`

## 3) Nota Tingkah Laku

- Default ini digunakan apabila pengguna membuka view buat kali pertama (tiada setting tersimpan).
- Jika pengguna sudah pernah ubah/menyimpan setting, sistem akan kekalkan setting tersebut.
- Untuk reset ke default, padam key localStorage berkaitan atau gunakan browser storage clear untuk domain aplikasi.

