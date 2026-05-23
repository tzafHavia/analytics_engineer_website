# Plan: WhatsApp Lead Capture — "Leave Details" Feature

Send visitor lead info directly to your WhatsApp when someone clicks a contact button.
The frontend collects name, phone, and optional message → submits to a Next.js API route
→ which calls the WhatsApp Graph API to deliver the lead to your personal number.

---

## Environment Setup

Add to `.env.local`:
```
NEXT_WHATSAPP_OWNER_PHONE=972XXXXXXXXX   # your personal WhatsApp in E.164, no +
```

Already available in `.env.local`:
- `NEXT_WHATSAPP_TOKEN` — Bearer token for Graph API
- `NEXT_WHATSAPP_PHONE_NUMBER_ID` — Sender (business) phone number ID

---

## Architecture

```
Visitor clicks button
  → ContactModal opens (client component)
  → Form submits POST /api/contact
  → API route saves lead to Supabase public.leads  ← source of truth
  → API route sends WhatsApp notification (if env vars present)
  → You receive WhatsApp message + lead stored in DB
```

---

## Phase 1 — Backend API Route ✅ DONE (updated with DB)

**File:** `app/api/contact/route.js` ✅ Updated

**Flow:**
1. Parse & validate inputs (`name` required, `phone` digits 7–15 chars, `message` optional max 500)
2. **INSERT to `public.leads`** via Supabase — source of truth; returns 500 if this fails
3. Send WhatsApp notification — **non-blocking**: skipped if env vars missing, errors only logged
4. Return `200 { success: true }`

**Supabase table** — run once in Supabase SQL Editor:
```sql
create table public.leads (
  id          bigint generated always as identity primary key,
  name        text        not null,
  phone       text        not null,
  message     text,
  created_at  timestamptz not null default now()
);

-- Prevent direct client-side inserts (only the API route can insert)
alter table public.leads enable row level security;
```

**WhatsApp API call** (if `NEXT_WHATSAPP_OWNER_PHONE` is set):
```
POST https://graph.facebook.com/v20.0/{NEXT_WHATSAPP_PHONE_NUMBER_ID}/messages
Authorization: Bearer {NEXT_WHATSAPP_TOKEN}

{
  "messaging_product": "whatsapp",
  "to": "{NEXT_WHATSAPP_OWNER_PHONE}",
  "type": "text",
  "text": { "body": "📩 New lead..." }
}
```

> ⚠️ Free-form text works when your owner number is registered as a test number in the
> Meta developer sandbox. For production (any recipient), switch to an approved template.

---

## Phase 2 — Frontend Modal Component ✅ DONE

**File:** `components/ContactModal.jsx` ✅ Created

- `'use client'`
- Fields: Name (text), Phone (tel), Message (textarea, optional)
- Client-side validation before submit
- States: `idle → loading → success | error`
- Success: WhatsApp green confirmation, auto-close after 3s
- Error: inline message, allow retry
- Styling: glassmorphism using existing CSS vars (`--bg-card`, `--border-light`, etc.)
- Close: X button, backdrop click, and Escape key → reset form

---

## Phase 3 — Floating Trigger Button ✅ DONE

**File:** `components/FloatingContactButton.jsx` ✅ Created

- `'use client'`
- Fixed position: `bottom: 2rem; right: 2rem`
- WhatsApp green (`#25D366`) with 💬 icon
- Manages `isOpen` state → passes to `ContactModal`
- Pulse animation (runs 3×) to draw attention on first render
- On mobile: label hidden, icon only

---

## Phase 4 — Layout Integration ✅ DONE

**File:** `app/layout.js` ✅ Updated

- Imported `FloatingContactButton`
- Mounted inside `ThemeProvider`, after `<footer>`, before closing `</div>`

---

## Phase 5 — CSS ✅ DONE

**File:** `app/globals.css` ✅ Updated

- `.floating-contact-btn` — fixed pill button, WhatsApp green, pulse animation
- `.contact-modal-overlay` — blurred backdrop, fade-in
- `.contact-modal` — glassmorphism card, slide-up animation
- `.contact-input`, `.contact-field`, `.contact-label` — form field styles
- `.contact-spinner`, `.contact-modal-success` — loading & success states
- Mobile responsive (≤480px): label hidden, reduced padding

---

## Files Summary

| File | Action |
|---|---|
| `.env.local` | Add `NEXT_WHATSAPP_OWNER_PHONE` |
| Supabase SQL Editor | ✅ Run `CREATE TABLE public.leads` |
| `app/api/contact/route.js` | ✅ Updated — POST handler + DB insert |
| `components/ContactModal.jsx` | ✅ Created — modal form |
| `components/FloatingContactButton.jsx` | ✅ Created — floating button |
| `app/layout.js` | ✅ Updated — mounts `FloatingContactButton` |
| `app/globals.css` | ✅ Updated — modal & button styles |

---

## Verification Checklist

- [ ] Add `NEXT_WHATSAPP_OWNER_PHONE` to `.env.local`
- [ ] Add owner number as a test recipient in Meta Developer Portal
- [ ] Run `npm run dev` — floating button visible on all pages
- [ ] Submit form → check terminal logs
- [ ] WhatsApp message received on owner's phone
- [ ] Test error state with an invalid token
- [ ] Modal closes on backdrop click and resets form state

---

## Scope Notes

- **Free-form text** message type (dev sandbox). Switch to template for public production.
- **Floating button** — globally visible without touching hero/navbar
- **Database storage** ✅ — leads saved to `public.leads` in Supabase on every submission
- **No rate limiting** in v1 (can add Upstash Redis later)
