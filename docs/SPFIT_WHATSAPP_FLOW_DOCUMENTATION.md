# Dokumentasi Aliran Penghantaran WhatsApp (SPFIT)

## Ringkasan
- Penghantaran mesej WhatsApp kini diurus melalui queue berasaskan pangkalan data `whatsapp_messages`.
- Semua langkah (enqueue, sending, sent/failed, webhook update) direkod dalam Audit Trail.
- Terdapat tab pemantauan di Settings: "Pemantauan Penghantaran WhatsApp".

## Komponen
- Table: `whatsapp_messages` – status, attempts, error, provider_message_id.
- Service: `messageQueueService` – proses mesej, retry, backoff, audit.
- Route: `POST /api/wasapmatic/send` – validation + enqueue.
- Route: `POST /api/wasapmatic/webhook` – kemaskini status provider.
- Route: `GET /api/delivery` – paparan log delivery (admin).
- Retention: Audit log dihapus > 90 hari (daily job).

## Flow
1. Client panggil `POST /api/wasapmatic/send` dengan `to`, `message`.
2. Sistem enqueue ke `whatsapp_messages` (status: queued) dan log audit.
3. Worker memproses mesej, panggil Wasapmatic API.
4. Jika berjaya: status `sent`, simpan `provider_message_id`, log audit.
5. Provider hantar webhook → sistem kemaskini `delivered/failed`, log audit.
6. Admin pantau melalui Settings > Pemantauan WhatsApp.

## Error Handling & Retry
- Backoff bertingkat: 0ms, 2s, 5s, 10s, 30s.
- MAX_ATTEMPTS: 5; jika gagal melebihi had → status `failed`.
- Semua ralat direkod dalam `last_error` dan audit.

## Testing
- Skrip: `api/scripts/test-whatsapp-flow.ts` – end-to-end enqueue dan semakan log.

## Deployment & Rollback
- Deployment: jalankan migrasi (auto oleh server on start).
- Rollback: hentikan worker (server), revert migration jika perlu.

## Monitoring Checklist
- Audit Trail menunjukkan jejak untuk setiap transaksi.
- Tab Pemantauan WhatsApp memaparkan status semasa.
- Semak kredits Wasapmatic dan configs API/Device ID.
