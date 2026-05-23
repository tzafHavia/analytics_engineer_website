// app/api/contact/route.js
// Receives lead details from the contact form, saves to Supabase `public.leads`,
// and sends a WhatsApp notification via WhatsApp Business API (Graph API v20.0).

import { createClient } from '@supabase/supabase-js';

const WHATSAPP_API_URL = `https://graph.facebook.com/v20.0/${process.env.NEXT_WHATSAPP_PHONE_NUMBER_ID}/messages`;

// Server-side only client using service role key — bypasses RLS for trusted inserts.
// SUPABASE_SERVICE_ROLE_KEY must NOT have the NEXT_PUBLIC_ prefix (server-only).
function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase service role env vars (NEXT_SUPABASE_SERVICE_ROLE_KEY)');
  return createClient(url, key);
}

// Sanitise a string: trim and strip any HTML tags
function sanitise(str) {
  return String(str ?? '')
    .trim()
    .replace(/<[^>]*>/g, '');
}

// Basic E.164-style phone validation: digits only, 7–15 chars
function isValidPhone(phone) {
  return /^\d{7,15}$/.test(phone);
}

export async function POST(request) {
  // ── 1. Parse body ──────────────────────────────────────────────────────────
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // ── 2. Validate & sanitise inputs ─────────────────────────────────────────
  const name = sanitise(body.name);
  const phone = sanitise(body.phone).replace(/[\s\-()]/g, ''); // strip separators
  const message = sanitise(body.message).slice(0, 500);

  if (!name || name.length > 100) {
    return Response.json({ error: 'Name is required (max 100 chars).' }, { status: 400 });
  }
  if (!phone || !isValidPhone(phone)) {
    return Response.json(
      { error: 'A valid phone number is required (digits only, 7–15 chars).' },
      { status: 400 }
    );
  }

  // ── 4. Save lead to Supabase ─────────────────────────────────────────────
  let serviceClient;
  try {
    serviceClient = getServiceClient();
  } catch {
    console.error('[contact] Supabase service role env vars not configured');
    return Response.json({ error: 'Server configuration error.' }, { status: 500 });
  }

  const { error: dbError } = await serviceClient
    .from('leads')
    .insert({ name, phone, message: message || null });

  if (dbError) {
    console.error('[contact] Failed to save lead to DB:', dbError.message);
    return Response.json({ error: 'Could not save your details. Please try again.' }, { status: 500 });
  }

  // ── 5. Send WhatsApp notification (optional — skipped if env vars missing) ─
  const token = process.env.NEXT_WHATSAPP_TOKEN;
  const ownerPhone = process.env.NEXT_WHATSAPP_OWNER_PHONE;
  const templateName = process.env.NEXT_WHATSAPP_TEMPLATE_NAME || 'lead_notification';

  if (token && ownerPhone && process.env.NEXT_WHATSAPP_PHONE_NUMBER_ID) {
    // Build payload: prefer template (works any time), fall back to free-form text
    // if template name is explicitly set to 'none'.
    const useTemplate = templateName !== 'none';

    const waPayload = useTemplate
      ? {
          messaging_product: 'whatsapp',
          to: ownerPhone,
          type: 'template',
          template: {
            name: templateName,
            language: { code: 'en_US' },
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: name },
                  { type: 'text', text: phone },
                  { type: 'text', text: message || 'No message provided' },
                ],
              },
            ],
          },
        }
      : {
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: ownerPhone,
          type: 'text',
          text: {
            body: [
              '📩 *New lead from your portfolio!*',
              '',
              `👤 Name: ${name}`,
              `📞 Phone: ${phone}`,
              message ? `💬 Message: ${message}` : null,
            ]
              .filter(Boolean)
              .join('\n'),
          },
        };

    try {
      const waResponse = await fetch(WHATSAPP_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(waPayload),
      });

      if (!waResponse.ok) {
        const errData = await waResponse.json().catch(() => ({}));
        console.error('[contact] WhatsApp API error — status:', waResponse.status, JSON.stringify(errData));
        // Lead is already saved — do not fail the request
      } else {
        const successData = await waResponse.json().catch(() => ({}));
        console.log('[contact] WhatsApp notification sent to:', ownerPhone, '| template:', useTemplate ? templateName : 'free-form', '| response:', JSON.stringify(successData));
      }
    } catch (networkErr) {
      console.error('[contact] Network error calling WhatsApp API:', networkErr);
      // Lead is already saved — do not fail the request
    }
  } else {
    console.warn('[contact] WhatsApp env vars not set — skipping notification');
  }

  return Response.json({ success: true });
}
