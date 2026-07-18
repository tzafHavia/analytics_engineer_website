import CrmLandingClient from './CrmLandingClient';

export const metadata = {
  title: 'Lead-Capture Integration: Next.js → Supabase → WhatsApp → SuiteCRM | Zafrir Havia',
  description:
    'Integration case study: one form submission persists to Supabase, fires a WhatsApp notification, and creates a SuiteCRM lead — with a live demo.',
};

export default function CrmPage() {
  return <CrmLandingClient />;
}
