import axios from 'axios';
import qs from 'qs';
import { AppDataSource } from '../config/database.ts';
import { WhatsAppMessage } from '../models/WhatsAppMessage.ts';
import { AuditService } from './auditService.js';
import { SystemSettings } from '../models/SystemSettings.ts';
import { normalizeMsisdn } from '../utils/phone.ts';
import { decrypt, isEncrypted } from '../utils/encryption.ts';

const MAX_ATTEMPTS = 5;
const CONCURRENCY = 3;
const BACKOFF_MS = [0, 2000, 5000, 10000, 30000];

let running = false;

type ActiveProvider = 'wasapmatic' | 'marz' | null;

async function getWasapConfig() {
  try {
    const repo = AppDataSource.getRepository(SystemSettings);
    const [apiKeySetting, deviceIdSetting, apiUrlSetting] = await Promise.all([
      repo.findOne({ where: { setting_key: 'wasapmatic_api_key' } }),
      repo.findOne({ where: { setting_key: 'wasapmatic_device_id' } }),
      repo.findOne({ where: { setting_key: 'wasapmatic_api_url' } })
    ]);
    let apiKey = apiKeySetting?.setting_value || process.env.WASAPMATIC_API_KEY || '';
    if (isEncrypted(apiKey)) apiKey = decrypt(apiKey) || apiKey;

    let deviceId = deviceIdSetting?.setting_value || process.env.WASAPMATIC_DEVICE_ID || '';
    if (isEncrypted(deviceId)) deviceId = decrypt(deviceId) || deviceId;

    const apiUrl = apiUrlSetting?.setting_value || process.env.WASAPMATIC_API_URL || 'https://app.wasapmatic.com/api';
    return { apiKey, deviceId, apiUrl };
  } catch {
    return {
      apiKey: process.env.WASAPMATIC_API_KEY || '',
      deviceId: process.env.WASAPMATIC_DEVICE_ID || '',
      apiUrl: process.env.WASAPMATIC_API_URL || 'https://app.wasapmatic.com/api'
    };
  }
}

async function getMarzConfig() {
  try {
    const repo = AppDataSource.getRepository(SystemSettings);
    const [secretSetting, accountSetting, apiUrlSetting] = await Promise.all([
      repo.findOne({ where: { setting_key: 'marz_wasap_api_secret' } }),
      repo.findOne({ where: { setting_key: 'marz_wasap_account_id' } }),
      repo.findOne({ where: { setting_key: 'marz_wasap_api_url' } })
    ]);

    let apiSecret = secretSetting?.setting_value || process.env.MARZ_WASAP_API_SECRET || '';
    if (isEncrypted(apiSecret)) apiSecret = decrypt(apiSecret) || apiSecret;

    let accountId = accountSetting?.setting_value || process.env.MARZ_WASAP_ACCOUNT_ID || '';
    if (isEncrypted(accountId)) accountId = decrypt(accountId) || accountId;

    const apiUrl = apiUrlSetting?.setting_value || process.env.MARZ_WASAP_API_URL || 'http://wasap.marz.biz.my/api';
    return { apiSecret, accountId, apiUrl };
  } catch {
    return {
      apiSecret: process.env.MARZ_WASAP_API_SECRET || '',
      accountId: process.env.MARZ_WASAP_ACCOUNT_ID || '',
      apiUrl: process.env.MARZ_WASAP_API_URL || 'http://wasap.marz.biz.my/api'
    };
  }
}

async function getActiveProvider(): Promise<ActiveProvider> {
  try {
    const repo = AppDataSource.getRepository(SystemSettings);
    const activeSetting = await repo.findOne({ where: { setting_key: 'whatsapp_active_provider' } });
    const active = (activeSetting?.setting_value || process.env.WHATSAPP_ACTIVE_PROVIDER || '').trim().toLowerCase();
    console.log(`[WhatsApp Queue] Active provider from DB: "${active}" (raw: "${activeSetting?.setting_value || 'null'}")`);
    if (active === 'wasapmatic' || active === 'marz') return active;
    return null;
  } catch (e) {
    console.error('[WhatsApp Queue] Error reading active provider:', e);
    const active = (process.env.WHATSAPP_ACTIVE_PROVIDER || '').trim().toLowerCase();
    if (active === 'wasapmatic' || active === 'marz') return active;
    return null;
  }
}

export async function enqueueWhatsAppMessage(payload: {
  to: string;
  message?: string;
  template_name?: string;
  template_params?: Record<string, string>;
  correlation_id?: string;
  freelancer_id?: number;
  freelancer_name?: string;
  task_id?: number;
  task_title?: string;
}) {
  const repo = AppDataSource.getRepository(WhatsAppMessage);
  // Store metadata in a way we can retrieve later? 
  // WhatsAppMessage model might not have these fields. 
  // For now we just create the record as before.
  // Ideally we should add metadata column to WhatsAppMessage table.
  
  const msg = repo.create({
    to: payload.to,
    message: payload.message || null,
    template_name: payload.template_name || null,
    template_params: payload.template_params || null,
    status: 'queued',
    attempts: 0,
    correlation_id: payload.correlation_id || null,
  });
  
  // Hack: temporarily attach metadata to the object instance so we can read it in the immediate audit log (in wasapmatic.ts)
  // But processOne runs in a separate loop, so it won't have this data unless we save it to DB.
  // Since user wants it in Audit Trail, and wasapmatic.ts logs the initial queue event, that part is covered.
  // But processOne logs the "Sent" event. We need the data there too.
  // We can try to parse correlation_id: TX-{taskId}-{fid}-{timestamp}
  
  await repo.save(msg);

  // Log initial queue event to audit trail so it appears immediately
  await AuditService.log({
    actionType: 'CREATE',
    tableName: 'whatsapp_messages',
    recordId: msg.id,
    newValues: { 
      status: 'queued', 
      to: payload.to, 
      correlation_id: payload.correlation_id,
      task_id: payload.task_id,
      freelancer_id: payload.freelancer_id,
      freelancer_name: payload.freelancer_name
    },
    description: `Queue: mesej dijadualkan untuk ${payload.freelancer_name || payload.to}`
  });

  return msg;
}

function parseCorrelationId(cid?: string) {
    if (!cid) return {};
    const parts = cid.split('-');
    // TX-taskId-fid-timestamp-name
    if (parts.length >= 4 && parts[0] === 'TX') {
        const meta: any = { task_id: parts[1], freelancer_id: parts[2] };
        if (parts[4]) {
            meta.freelancer_name = decodeURIComponent(parts[4]);
        }
        return meta;
    }
    return {};
}

async function processOne(msg: WhatsAppMessage) {
  const repo = AppDataSource.getRepository(WhatsAppMessage);
  try {
    msg.status = 'sending';
    msg.attempts = (msg.attempts || 0) + 1;
    await repo.save(msg);

    const normalized = normalizeMsisdn(msg.to);
    if (!normalized.ok) {
      msg.status = 'failed';
      msg.last_error = `Invalid phone: ${normalized.error}`;
      await repo.save(msg);
      await AuditService.log({
        actionType: 'SYSTEM',
        tableName: 'whatsapp_messages',
        recordId: msg.id,
        newValues: { status: 'failed', error: msg.last_error, input: msg.to, correlation_id: msg.correlation_id },
        description: `Queue: validation gagal untuk ${msg.to} [${msg.correlation_id || 'no-corr'}]`
      });
      return;
    }
    const recipient = normalized.e164 || normalized.digits!;

    const activeProvider = await getActiveProvider();
    if (!activeProvider) {
      throw new Error('Tiada WhatsApp API aktif. Sila aktifkan Wasapmatic atau Marz Wasap.');
    }

    let response;
    if (activeProvider === 'wasapmatic') {
      const { apiKey, deviceId, apiUrl } = await getWasapConfig();
      if (!apiKey || !deviceId) {
        throw new Error('Wasapmatic configuration is missing (apiKey/deviceId)');
      }

      const formData = new FormData();
      formData.append('secret', apiKey);
      formData.append('account', deviceId);
      formData.append('recipient', recipient);
      formData.append('type', 'text');
      formData.append('message', msg.message || '');
      formData.append('priority', '1');

      response = await axios.post(`${apiUrl}/send/whatsapp`, formData, {
        timeout: 15000,
      });
    } else {
      const { apiSecret, accountId, apiUrl } = await getMarzConfig();
      if (!apiSecret || !accountId) {
        throw new Error('Marz Wasap configuration is missing (apiSecret/accountId)');
      }

      console.log(`[Marz] Sending to ${recipient} via ${apiUrl}/send/message`);
      console.log(`[Marz] Account ID: ${accountId}, Secret: ${apiSecret.substring(0, 6)}...`);

      response = await axios.post(`${apiUrl}/send/whatsapp`, qs.stringify({
        secret: apiSecret,
        account: accountId,
        recipient,
        type: 'text',
        priority: 2,
        message: msg.message || '',
      }), {
        timeout: 15000,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      console.log(`[Marz] Response:`, JSON.stringify(response.data).substring(0, 300));
    }

    // Handle soft errors (HTTP 200 but error in body)
    // Assuming Wasapmatic returns { status: 400, message: "..." } or { success: false } in body on failure
    const respData = response.data;
    if (respData && (respData.status >= 400 || respData.success === false || respData.error)) {
        throw new Error(respData.message || respData.error || 'Provider returned error status');
    }

    msg.status = 'sent';
    msg.sent_at = new Date();
    msg.provider_message_id = respData?.message_id || respData?.id || null;
    await repo.save(msg);
    
    // Try to enrich audit log with task info from correlation_id
    const meta = parseCorrelationId(msg.correlation_id);
    
    // Extract provider status if available
    const providerStatus = respData?.status || 'sent';

    let desc = meta.task_id 
      ? `Queue: mesej dihantar ke ${recipient} (TaskID: ${meta.task_id}, FreelancerID: ${meta.freelancer_id}, Status: ${providerStatus}, Provider: ${activeProvider})`
      : `Queue: mesej ke ${recipient} dihantar (Status: ${providerStatus}, Provider: ${activeProvider})`;

    if (meta.freelancer_name) {
      desc = `Queue: mesej dihantar ke ${meta.freelancer_name} (${recipient}) (TaskID: ${meta.task_id}, Status: ${providerStatus}, Provider: ${activeProvider})`;
    }

    await AuditService.log({
      actionType: 'SYSTEM',
      tableName: 'whatsapp_messages',
      recordId: msg.id,
      newValues: { 
        status: 'sent', 
        response: response.data, 
        provider_status: providerStatus,
        provider: activeProvider,
        sent_recipient: recipient,
        correlation_id: msg.correlation_id,
        // Also capture the explicit 200 status from body if available
        provider_status_code: response.data?.status,
        ...meta,
        message_content: msg.message // Log message content in box
      },
      description: desc
    });
    } catch (error: any) {
    msg.last_error = error.response?.data?.message || error.message || 'Unknown error';
    const errorResponse = error.response?.data || null;
    const errorStatus = error.response?.status || null;

    console.error(`[WhatsApp] Send failed for ${msg.to}:`, {
      status: errorStatus,
      message: msg.last_error,
      response: JSON.stringify(errorResponse).substring(0, 300),
    });

    if ((msg.attempts || 0) >= MAX_ATTEMPTS) {
      msg.status = 'failed';
      await repo.save(msg);
    } else {
      msg.status = 'queued';
      await repo.save(msg);
    }

    await AuditService.log({
      actionType: 'SYSTEM',
      tableName: 'whatsapp_messages',
      recordId: msg.id,
      newValues: { 
        status: msg.status, 
        error: msg.last_error, 
        error_response: errorResponse,
        error_status: errorStatus,
        attempts: msg.attempts, 
        correlation_id: msg.correlation_id 
      },
      description: `Queue: gagal hantar ke ${msg.to} (attempt ${msg.attempts}) [${msg.correlation_id || 'no-corr'}]`
    });
  }
}

export function startWhatsAppQueue() {
  if (running) return;
  running = true;

  const repo = AppDataSource.getRepository(WhatsAppMessage);

  const loop = async () => {
    try {
      const queued = await repo.find({
        where: { status: 'queued' },
        order: { queued_at: 'ASC' },
        take: CONCURRENCY,
      });
      if (queued.length > 0) {
        console.log(`[WhatsApp Queue] Processing ${queued.length} messages`);
      }
      await Promise.all(queued.map(async (msg) => {
        const delayIndex = Math.min(msg.attempts, BACKOFF_MS.length - 1);
        const delay = BACKOFF_MS[delayIndex];
        if (delay > 0) await new Promise(r => setTimeout(r, delay));
        await processOne(msg);
      }));
    } catch (e) {
      console.error('[WhatsApp Queue] Loop error:', e);
    } finally {
      setTimeout(loop, 2000);
    }
  };

  console.log('[WhatsApp Queue] Starting processor...');
  loop();
}
