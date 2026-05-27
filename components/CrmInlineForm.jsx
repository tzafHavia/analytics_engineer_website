'use client';
import { useState, useCallback } from 'react';

const INTEREST_OPTIONS = [
  { value: '',        label: "What are you interested in? (optional)" },
  { value: 'pricing', label: 'Pricing & Costs' },
  { value: 'demo',    label: 'Schedule a Demo' },
  { value: 'features',label: 'Feature Questions' },
  { value: 'custom',  label: 'Custom Development' },
  { value: 'other',   label: 'Other' },
];

/**
 * Inline (non-modal) contact form for the CRM demo section.
 * Submits to /api/contact with source: 'crm_landing'.
 * Calls onSuccess({ name, phone }) so parent can update the SuiteCRM preview.
 */
export default function CrmInlineForm({ onSuccess }) {
  const [form, setForm]         = useState({ name: '', phone: '', company: '', interest: '', message: '' });
  const [errors, setErrors]     = useState({});
  const [status, setStatus]     = useState('idle'); // idle | loading | success | error
  const [serverError, setServerError] = useState('');

  const validate = () => {
    const errs = {};
    if (!form.name.trim())  errs.name = 'Name is required.';
    if (!form.phone.trim()) errs.phone = 'Phone is required.';
    else if (!/^\d[\d\s\-()]{5,14}$/.test(form.phone.trim())) errs.phone = 'Enter a valid phone number.';
    return errs;
  };

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setStatus('loading');
    setServerError('');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:     form.name.trim(),
          phone:    form.phone.trim(),
          company:  form.company.trim(),
          interest: form.interest,
          message:  form.message.trim(),
          source:   'crm_landing',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setServerError(data.error || 'Something went wrong. Please try again.');
        setStatus('error');
      } else {
        setStatus('success');
        onSuccess?.({ name: form.name.trim(), phone: form.phone.trim() });
      }
    } catch {
      setServerError('Network error. Please check your connection.');
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div className="crm-inline-form crm-inline-success">
        <div className="crm-inline-success-icon">✅</div>
        <h3 className="crm-inline-success-title">Lead Created!</h3>
        <p className="crm-inline-success-sub">
          Saved to Supabase and synced to SuiteCRM in real time.
          Check the panel on the right →
        </p>
      </div>
    );
  }

  return (
    <form className="crm-inline-form" onSubmit={handleSubmit} noValidate>
      <h3 className="crm-inline-form-title">Try it live — submit a real lead</h3>
      <p className="crm-inline-form-sub">
        Fill in the form and watch the SuiteCRM panel update in real time.
      </p>

      {/* Name */}
      <div className="contact-field">
        <input
          type="text"
          name="name"
          className={`contact-input${errors.name ? ' contact-input-error' : ''}`}
          placeholder="Your name *"
          value={form.name}
          onChange={handleChange}
          disabled={status === 'loading'}
          autoComplete="name"
        />
        {errors.name && <span className="contact-field-error">{errors.name}</span>}
      </div>

      {/* Phone */}
      <div className="contact-field">
        <input
          type="tel"
          name="phone"
          className={`contact-input${errors.phone ? ' contact-input-error' : ''}`}
          placeholder="Phone number *"
          value={form.phone}
          onChange={handleChange}
          disabled={status === 'loading'}
          autoComplete="tel"
        />
        {errors.phone && <span className="contact-field-error">{errors.phone}</span>}
      </div>

      {/* Company */}
      <div className="contact-field">
        <input
          type="text"
          name="company"
          className="contact-input"
          placeholder="Company (optional)"
          value={form.company}
          onChange={handleChange}
          disabled={status === 'loading'}
          autoComplete="organization"
        />
      </div>

      {/* Interest */}
      <div className="contact-field">
        <select
          name="interest"
          className="contact-input"
          value={form.interest}
          onChange={handleChange}
          disabled={status === 'loading'}
        >
          {INTEREST_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Message */}
      <div className="contact-field">
        <textarea
          name="message"
          className="contact-input"
          placeholder="Message (optional)"
          rows={3}
          value={form.message}
          onChange={handleChange}
          disabled={status === 'loading'}
        />
      </div>

      {serverError && (
        <p className="contact-field-error" style={{ marginTop: '-0.25rem' }}>{serverError}</p>
      )}

      <button
        type="submit"
        className="btn-primary"
        style={{ width: '100%' }}
        disabled={status === 'loading'}
      >
        {status === 'loading' ? 'Sending…' : 'Submit Lead →'}
      </button>
    </form>
  );
}
