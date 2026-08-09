# Asset Category Details & Duplication

## 1) Database Changes (Assets)

### Removed
- Pairing/bundle tables and APIs were removed.
- `assets.paired_asset_id` was dropped.
- `assets.asset_type` (Jenis Aset) was dropped.
- The `category_details` tables (`asset_desktops`, `asset_laptops`, `asset_printers`, `asset_monitors`) and "Perkakasan Tambahan" UI were removed (migration 045).

### Added (masterlist asset listing references)
- `masterlist_assets` links existing `assets` into additional masterlists without creating new assets.

Migration: `api/migrations/042_create_masterlist_asset_listings.sql`

## 2) API Changes (Assets)

### Create / Update Asset
- `POST /api/assets`
- `PUT /api/assets/:id`

Payload no longer supports `category_details` fields.

## 3) Duplicate Task

### Endpoint
- `POST /api/tasks/:id/duplicate`

Behavior:
- Creates a new task with:
  - `title` prefixed with `Copy of ...` (auto-suffix `(2)`, `(3)` if needed)
  - new unique `log_number`
- Copies:
  - `status_id` (keeps the original status)
  - `assigned_to` (keeps the original assignee)
- Copies:
  - editable task fields (description, dates/times, pricing, location, asset identifiers, etc.)
  - `task_links`
  - `task_parts`

## 4) Duplicate Masterlist

### Endpoint
- `POST /api/masterlists/:id/duplicate`

Body (all optional):
```json
{
  "project_id": 123,
  "code": "ML-NEW",
  "name": "New Masterlist Name",
  "include_assets": true
}
```

Behavior:
- Creates a new masterlist with:
  - `name` prefixed with `Copy of ...` (auto-suffix `(2)`, `(3)` if needed)
  - `code` auto-suffixed using `-COPY`, `-COPY2`, ...
- Copies/keeps status from the original masterlist (fallback: `Aktif`)
- Copies masterlist-owned config:
  - `custom_fields_definition`
  - `work_links`
  - `work_documents` (metadata is cloned as-is)
- If `include_assets=true`, links the existing assets into the new masterlist by inserting rows into `masterlist_assets` (no new `assets` are created).

## 5) UI

- Tasks list: Duplicate action is available in `TaskManagementPage`.
- Masterlists list: Duplicate action is available in `MasterlistsPage`.

## 6) Asset Accessories (Pairing)

- Assets can be paired with one or more “accessory assets” (monitor/keyboard/mouse/other) via `asset_accessories`.
- See `docs/ASSET_ACCESSORIES.md`.
