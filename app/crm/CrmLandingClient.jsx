'use client';
import { useState } from 'react';
import CrmInlineForm   from '@/components/CrmInlineForm';
import SuiteCrmPreview from '@/components/SuiteCrmPreview';

// The real-world problem this integration addresses (case-study framing).
const PROBLEMS = [
  {
    icon: '📋',
    title: 'Leads scattered everywhere',
    desc: 'Small businesses collect phone numbers in WhatsApp, emails in an inbox, and notes on paper — with no single place where prospects are tracked.',
  },
  {
    icon: '🔁',
    title: 'No follow-up system',
    desc: 'Without a pipeline there is no reminder, no history, and no accountability — missed follow-ups quietly cost real sales.',
  },
  {
    icon: '📊',
    title: 'Zero pipeline visibility',
    desc: 'No way to tell which stage a deal is in or where revenue is coming from until the data lands in one system.',
  },
];

// What actually happens when the form is submitted (real flow, in order).
const FLOW_STEPS = [
  {
    icon: '📝',
    title: '1 · Form → Next.js API route',
    desc: 'The submission posts to a single API route that orchestrates the whole flow server-side.',
  },
  {
    icon: '⚡',
    title: '2 · Persist to Supabase',
    desc: 'The lead is written to Postgres first — capture is never at risk, whatever happens downstream.',
  },
  {
    icon: '💬',
    title: '3 · WhatsApp notification',
    desc: 'A WhatsApp Cloud API template message notifies the owner instantly. Fire-and-forget — a failure never blocks the lead.',
  },
  {
    icon: '🗂',
    title: '4 · SuiteCRM lead record',
    desc: 'A Lead is created in a self-hosted SuiteCRM over its REST API, and the panel on the right updates live.',
  },
];

const TECH_STACK = [
  { label: 'Next.js',          icon: '▲' },
  { label: 'Supabase',         icon: '⚡' },
  { label: 'SuiteCRM',         icon: '🗂' },
  { label: 'WhatsApp Cloud API', icon: '💬' },
];

export default function CrmLandingClient() {
  const [liveSubmission, setLiveSubmission] = useState(null);

  return (
    <div className="crm-page">

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="crm-hero">
        <div className="crm-hero-eyebrow">
          <span className="eyebrow-dot" />
          Integration Case Study · Next.js · Supabase · SuiteCRM · WhatsApp API
        </div>
        <h1 className="crm-hero-title">
          Lead-Capture Integration —
          <span className="hero-highlight"> Form to CRM in Real Time.</span>
        </h1>
        <p className="crm-hero-subtitle">
          A multi-system integration built end-to-end: one form submission fans out to a
          database, a messaging API, and a CRM — resiliently, in seconds. Submit the demo
          form below and watch the Lead record appear.
        </p>
        <div className="crm-hero-actions">
          <a href="#demo" className="btn-primary btn-lg">
            Try the Live Demo ↓
          </a>
        </div>
      </section>

      {/* ── PROBLEM CONTEXT ──────────────────────────────────────────────── */}
      <section className="crm-section">
        <h2 className="section-title">The problem it solves</h2>
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

      {/* ── ARCHITECTURE / FLOW ──────────────────────────────────────────── */}
      <section className="crm-section">
        <h2 className="section-title">What happens on submit</h2>
        <div className="crm-problems-grid">
          {FLOW_STEPS.map((s) => (
            <div key={s.title} className="crm-problem-card">
              <span className="crm-problem-icon">{s.icon}</span>
              <h3 className="crm-problem-title">{s.title}</h3>
              <p className="crm-problem-desc">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── LIVE DEMO ────────────────────────────────────────────────────── */}
      <section className="crm-section" id="demo">
        <h2 className="section-title">Live demo — submit a real lead</h2>
        <p className="crm-demo-intro">
          Fill in the form on the left. The lead is saved to Supabase, a WhatsApp
          notification is sent, and a Lead record is created in SuiteCRM — all within a
          couple of seconds.
        </p>
        <p className="crm-cta-note">
          Note: the SuiteCRM instance runs on a self-hosted Linux server. If it is
          temporarily offline, the demo still records the lead in Supabase — by design,
          capture never depends on the CRM being up.
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

      {/* ── ATTRIBUTION ──────────────────────────────────────────────────── */}
      <p className="crm-attribution">
        Integration built with{' '}
        <a href="https://suitecrm.com" target="_blank" rel="noopener noreferrer">SuiteCRM</a>
        {' '}open-source ·{' '}
        <a href="https://supabase.com" target="_blank" rel="noopener noreferrer">Supabase</a>
        {' '}· Next.js
      </p>

    </div>
  );
}
