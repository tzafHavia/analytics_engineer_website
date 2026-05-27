// lib/suitecrmClient.js
// SuiteCRM REST API v4.1 — works with SuiteCRM 7.x Docker installations.
// Uses username + MD5(password) session login. No OAuth2 client setup required.
// Used server-side only — never import this in a client component.

import { createHash } from 'crypto';

function getConfig() {
  const base = process.env.NEXT_SUITCRM_BASE_URL?.replace(/\/$/, '');
  const username = process.env.NEXT_SUITCRM_USERNAME;
  const password = process.env.NEXT_SUITCRM_PASSWORD;
  return { base, username, password, apiUrl: base ? `${base}/service/v4_1/rest.php` : null };
}

export function isSuiteCRMConfigured() {
  const { base, username, password } = getConfig();
  return !!(base && username && password);
}

async function callApi(method, restData) {
  const { apiUrl } = getConfig();
  const body = new URLSearchParams({
    method,
    input_type: 'JSON',
    response_type: 'JSON',
    rest_data: JSON.stringify(restData),
  });

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`SuiteCRM API call "${method}" failed (${res.status}): ${text}`);
  }

  const json = await res.json();
  if (json?.name === 'Invalid Login' || json?.description?.includes('Invalid')) {
    throw new Error(`SuiteCRM login failed: ${json.description ?? 'invalid credentials'}`);
  }
  return json;
}

async function login() {
  const { username, password } = getConfig();
  const passwordHash = createHash('md5').update(password).digest('hex');
  const result = await callApi('login', {
    user_auth: { user_name: username, password: passwordHash },
    application_name: 'NextJSPortfolio',
  });
  if (!result?.id) throw new Error('SuiteCRM login returned no session id');
  return result.id;
}

/**
 * Creates a Lead record in SuiteCRM via REST API v4.1.
 * @param {{ name: string, phone: string, company?: string, interest?: string, message?: string, source?: string }} fields
 * @returns {Promise<string>} The created lead ID
 */
export async function createLead({ name, phone, company = '', interest = '', message = '', source = '' }) {
  if (!isSuiteCRMConfigured()) {
    throw new Error('SuiteCRM env vars are not configured (SUITCRM_BASE_URL, SUITCRM_USERNAME, SUITCRM_PASSWORD)');
  }

  const sessionId = await login();

  const parts = name.trim().split(/\s+/);
  const firstName = parts[0] ?? name;
  const lastName = parts.length > 1 ? parts.slice(1).join(' ') : '(unknown)';

  const sourceLabel = source === 'crm_landing'
    ? 'Enquiry via: CRM Demo page'
    : source === 'analytics_engineering'
    ? 'Enquiry via: Analytics Engineering (portfolio)'
    : source ? `Enquiry via: ${source}` : '';

  const descParts = [];
  if (sourceLabel) descParts.push(sourceLabel);
  if (interest) descParts.push(`Interest: ${interest}`);
  if (message)  descParts.push(`Message: ${message}`);
  const description = descParts.join('\n') || 'No message provided';

  const result = await callApi('set_entry', {
    session: sessionId,
    module_name: 'Leads',
    name_value_list: [
      { name: 'first_name',   value: firstName },
      { name: 'last_name',    value: lastName },
      { name: 'phone_mobile', value: phone },
      { name: 'account_name', value: company },
      { name: 'description',  value: description },
      { name: 'lead_source',  value: 'Web Site' },
      { name: 'status',       value: 'New' },
    ],
  });

  if (!result?.id) throw new Error('SuiteCRM set_entry returned no lead id');
  return result.id;
}
