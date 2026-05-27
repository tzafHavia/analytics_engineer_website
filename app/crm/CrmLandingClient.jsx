'use client';
import { useState } from 'react';
import CrmLeadModal    from '@/components/CrmLeadModal';
import CrmInlineForm   from '@/components/CrmInlineForm';
import SuiteCrmPreview from '@/components/SuiteCrmPreview';

const PROBLEMS = [
  {
    icon: '📋',
    title: 'Leads fall through the cracks',
    desc: 'Phone numbers in WhatsApp, emails in your inbox, notes on paper. No single place to track prospects.',
  },
  {
    icon: '🔁',
    title: 'No follow-up system',
    desc: 'Forgetting to call back costs real sales. Without a pipeline there is no reminder, no history, no accountability.',
  },
  {
    icon: '📊',
    title: 'Zero visibility into your pipeline',
    desc: "You can't tell which stage a deal is in, which rep is performing, or where revenue is coming from.",
  },
];

const SERVICES = [
  {
    icon: '⚙️',
    title: 'Installation & Setup',
    desc: 'Docker or cloud deployment, SSL, domain config, admin setup, and initial data migration from your spreadsheets.',
  },
  {
    icon: '🔧',
    title: 'Custom Fields & Workflows',
    desc: 'Tailored modules, automated follow-up sequences, email templates, and pipeline stages designed for your business.',
  },
  {
    icon: '🎓',
    title: 'Training & Handover',
    desc: 'Full team walkthrough, written documentation, and 30-day support so your team is confident from day one.',
  },
];

const TECH_STACK = [
  { label: 'Next.js 15',      icon: '▲' },
  { label: 'Supabase',        icon: '⚡' },
  { label: 'SuiteCRM v8',     icon: '🗂' },
  { label: 'WhatsApp API v20', icon: '💬' },
];

export default function CrmLandingClient() {
  const [isModalOpen,    setIsModalOpen]    = useState(false);
  const [liveSubmission, setLiveSubmission] = useState(null);

  return (
    <div className="crm-page">

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="crm-hero">
        <div className="crm-hero-eyebrow">
          <span className="eyebrow-dot" />
          Next.js · Supabase · SuiteCRM · WhatsApp API
        </div>
        <h1 className="crm-hero-title">
          I Built a Live CRM Integration —
          <span className="hero-highlight"> Form to SuiteCRM in Real Time.</span>
        </h1>
        <p className="crm-hero-subtitle">
          Submit the form below and watch a Lead record appear in SuiteCRM instantly.
          Full stack: Next.js API route → Supabase → WhatsApp notification → SuiteCRM v4.1 REST API.
        </p>
        <div className="crm-hero-actions">
          <a href="#demo" className="btn-primary btn-lg">
            See the Demo ↓
          </a>
          <button className="btn-outline btn-lg" onClick={() => setIsModalOpen(true)}>
            Book a Consultation
          </button>
        </div>
      </section>

      {/* ── PROBLEMS ─────────────────────────────────────────────────────── */}
      <section className="crm-section">
        <h2 className="section-title">Sound familiar?</h2>
        <div className="crm-problems-grid">
          {PROBLEMS.map((p) => (
            <div key={p.title} className="crm-problem-card">
              <span className="crm-problem-icon">{p.icon}</span>
              <h3 className="crm-problem-title">{p.title}</h3>
              <p className="crm-problem-desc">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── LIVE DEMO ────────────────────────────────────────────────────── */}
      <section className="crm-section" id="demo">
        <h2 className="section-title">Live demo — submit a real lead</h2>
        <p className="crm-demo-intro">
          Fill in the form on the left. The lead is saved to Supabase, a WhatsApp notification is sent,
          and a Lead record is created in SuiteCRM — all within a couple of seconds.
        </p>
        <div className="crm-demo-split">
          <CrmInlineForm onSuccess={(data) => setLiveSubmission(data)} />
          <SuiteCrmPreview liveSubmission={liveSubmission} />
        </div>
      </section>

      {/* ── TECH STACK STRIP ─────────────────────────────────────────────── */}
      <div className="crm-tech-strip">
        <span className="crm-tech-label">Built with</span>
        {TECH_STACK.map((t) => (
          <span key={t.label} className="crm-tech-badge">
            <span>{t.icon}</span> {t.label}
          </span>
        ))}
      </div>

      {/* ── WHAT'S INCLUDED ──────────────────────────────────────────────── */}
      <section className="crm-section">
        <h2 className="section-title">What&apos;s included</h2>
        <div className="crm-services-grid">
          {SERVICES.map((s) => (
            <div key={s.title} className="crm-service-card">
              <span className="crm-service-icon">{s.icon}</span>
              <h3 className="crm-service-title">{s.title}</h3>
              <p className="crm-service-desc">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <section className="crm-cta-section">
        <h2 className="crm-cta-title">Want this for your business?</h2>
        <p className="crm-cta-sub">
          Leave your details and we&apos;ll talk through how SuiteCRM fits your workflow.
          Setup, customisation, and training included.
        </p>
        <button className="btn-primary btn-lg" onClick={() => setIsModalOpen(true)}>
          Book a Free Consultation →
        </button>
        <p className="crm-cta-note">No commitment. Response within 24 hours.</p>
      </section>

      {/* ── ATTRIBUTION ──────────────────────────────────────────────────── */}
      <p className="crm-attribution">
        Integration built with{' '}
        <a href="https://suitecrm.com" target="_blank" rel="noopener noreferrer">SuiteCRM</a>
        {' '}open-source ·{' '}
        <a href="https://supabase.com" target="_blank" rel="noopener noreferrer">Supabase</a>
        {' '}· Next.js 15
      </p>

      <CrmLeadModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
