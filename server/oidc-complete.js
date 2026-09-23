import PocketBase from 'pocketbase';

const DEFAULT_USER_TYPE_ID = '000000000000001';
const ROLE_MAP = {
  student: '000000000000001',
  students: '000000000000001',
  teacher: '000000000000002',
  teachers: '000000000000002',
  guest: '000000000000003',
  guests: '000000000000003',
  staff: '000000000000004'
};

function pocketBaseUrl(env) {
  const configured = env.POCKETBASE_URL || env.VITE_POCKETBASE_URL;
  if (configured && configured !== '/') return configured;
  return env.VITE_POCKETBASE_TARGET || 'http://127.0.0.1:8090';
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024 * 1024) throw Object.assign(new Error('payload too large'), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('invalid JSON payload'), { status: 400 });
  }
}

function respond(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export async function completeOidc(req, res, env = process.env) {
  if (req.method !== 'POST') return respond(res, 405, { ok: false, error: 'method not allowed' });

  try {
    const payload = await readJson(req);
    if (!payload?.token || !payload?.record?.id || !payload?.meta?.accessToken) {
      return respond(res, 400, { ok: false, error: 'invalid OAuth payload' });
    }

    const userInfoUrl = env.OIDC_USERINFO_URL || 'https://openidconnect.googleapis.com/v1/userinfo';
    const userInfoResponse = await fetch(userInfoUrl, {
      headers: { Authorization: `Bearer ${payload.meta.accessToken}` }
    });
    if (!userInfoResponse.ok) {
      return respond(res, 401, { ok: false, error: 'OIDC identity could not be verified' });
    }
    const identity = await userInfoResponse.json();
    const identityEmail = String(identity.email || '').trim().toLowerCase();
    if (!identityEmail || identity.email_verified === false) {
      return respond(res, 401, { ok: false, error: 'OIDC identity did not provide a verified email' });
    }

    const pb = new PocketBase(pocketBaseUrl(env));
    pb.autoCancellation(false);
    pb.authStore.save(payload.token, payload.record);
    let authData;
    try {
      authData = await pb.collection('users').authRefresh();
    } catch {
      return respond(res, 401, { ok: false, error: 'PocketBase session could not be verified' });
    }
    const record = authData.record;
    if (record.id !== payload.record.id || String(record.email || '').trim().toLowerCase() !== identityEmail) {
      return respond(res, 403, { ok: false, error: 'OIDC identity does not match the PocketBase account' });
    }

    if (!record.user_type) {
      if (!env.PB_ADMIN_EMAIL || !env.PB_ADMIN_PASSWORD) {
        return respond(res, 503, { ok: false, error: 'OIDC role assignment is not configured on the server' });
      }

      const claimedRole = identity.profile?.role ?? identity.role;
      const normalizedRole = typeof claimedRole === 'string' ? claimedRole.trim().toLowerCase() : '';
      const userTypeId = ROLE_MAP[normalizedRole] || DEFAULT_USER_TYPE_ID;
      const admin = new PocketBase(pocketBaseUrl(env));
      admin.autoCancellation(false);
      await admin.collection('_superusers').authWithPassword(env.PB_ADMIN_EMAIL, env.PB_ADMIN_PASSWORD);
      const updated = await admin.collection('users').update(record.id, { user_type: userTypeId });
      return respond(res, 200, { ok: true, record: updated });
    }

    return respond(res, 200, { ok: true, record });
  } catch (error) {
    const status = Number(error?.status) || 500;
    if (status >= 500) console.error('[auth/oidc] completion failed:', error);
    return respond(res, status, { ok: false, error: status >= 500 ? 'OIDC sign-in could not be completed' : error.message });
  }
}
