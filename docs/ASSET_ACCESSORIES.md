# Aset Tambahan (Accessories / Pairing)

Dokumen ini menerangkan feature “Pilihan Aset Tambahan” pada borang Aset (PC/Desktop & Laptop) untuk membolehkan satu aset dipairkan dengan satu atau lebih aset lain seperti monitor/keyboard/mouse/lain-lain.

## 1) Database

### Table: `asset_accessories`
- `asset_id` → aset utama
- `accessory_asset_id` → aset tambahan yang dipair
- `accessory_type` → `monitor | keyboard | mouse | other`
- `notes` → opsyenal

Migration:
- `api/migrations/044_create_asset_accessories.sql`

Peraturan:
- Satu `accessory_asset_id` hanya boleh dipilih sekali untuk satu `asset_id` (unik pada pasangan `asset_id + accessory_asset_id`).

## 2) API (Assets)

### Create / Update Asset
- `POST /api/assets`
- `PUT /api/assets/:id`

Payload tambahan:
```json
{
  "accessories": [
    { "type": "monitor", "asset_id": 123, "notes": null },
    { "type": "mouse", "asset_id": 456 }
  ]
}
```

Validation:
- `type` wajib salah satu: `monitor`, `keyboard`, `mouse`, `other`
- `asset_id` wajib nombor positif
- `asset_id` tidak boleh sama dengan aset semasa
- aset tambahan mestilah dalam masterlist yang sama

Response:
- `asset.accessories` dipulangkan sebagai array metadata pairing (termasuk `asset_tag`, `name`, `category` jika ada).

## 3) UI

Lokasi:
- Borang edit/create aset: `src/components/AssetFormPage.tsx`

Behavior:
- Bila kategori `pc/desktop` atau `laptop`, seksyen “Pilihan Aset Tambahan” dipaparkan di bawah field “Serial Number” & “Kumpulan”.
- Klik `+` untuk tambah pairing row (jenis + pilih aset).
- Tetapan disimpan semasa submit bersama payload aset.

