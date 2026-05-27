'use client';
import { useState, useEffect, useCallback } from 'react';

const INTEREST_OPTIONS = [
  { value: '', label: 'Select topic (optional)' },
  { value: 'pricing', label: 'Pricing & Costs' },
  { value: 'demo', label: 'Schedule a Demo' },
  { value: 'features', label: 'Feature Questions' },
  { value: 'custom', label: 'Custom Development' },
  { value: 'other', label: 'Other' },
];

export default function CrmLeadModal({ isOpen, onClose }) {
  const [form, setForm] = useState({ name: '', phone: '', officePhone: '', company: '', interest: '', message: '' });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [serverError, setServerError] = useState('');

  useEffect(() => {
    if (status !== 'success') return;
    const t = setTimeout(() => onClose(), 3000);
    return () => clearTimeout(t);
  }, [status, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setForm({ name: '', phone: '', officePhone: '', company: '', interest: '', message: '' });
      setErrors({});
      setStatus('idle');
      setServerError('');
    }
  }, [isOpen]);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const validate = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required.';
    else if (form.name.trim().length > 100) errs.name = 'Max 100 characters.';
    if (!form.phone.trim()) errs.phone = 'Phone number is required.';
    else if (!/^\d[\d\s\-()]{5,14}$/.test(form.phone.trim())) errs.phone = 'Enter a valid phone number.';
    if (form.company.length > 100) errs.company = 'Max 100 characters.';
    if (form.message.length > 500) errs.message = 'Max 500 characters.';
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
          name: form.name.trim(),
          phone: form.phone.trim(),
          officePhone: form.officePhone.trim(),
          company: form.company.trim(),
          interest: form.interest,
          message: form.message.trim(),
          source: 'crm_landing',
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setServerError(data.error || 'Something went wrong. Please try again.');
        setStatus('error');
      } else {
        setStatus('success');
      }
    } catch {
      setServerError('Network error. Please check your connection and try again.');
      setStatus('error');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="contact-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="crm-modal-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="contact-modal">
        <div className="contact-modal-header">
          <h2 id="crm-modal-title" className="contact-modal-title">
            <span>🤝</span> Get in Touch
          </h2>
          <button onClick={onClose} className="contact-modal-close" aria-label="Close">✕</button>
        </div>

        <p className="contact-modal-subtitle">
          Leave your details and we&apos;ll get back to you within 24 hours.
        </p>

        {status === 'success' ? (
          <div className="contact-modal-success">
            <span className="contact-success-icon">✅</span>
            <p className="contact-success-title">Details received!</p>
            <p className="contact-success-sub">We&apos;ll be in touch within 24 hours. Closing…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="contact-form">
            {/* Name */}
            <div className="contact-field">
              <label className="contact-label" htmlFor="crm-name">Name *</label>
              <input
                id="crm-name"
                name="name"
                type="text"
                className={`contact-input ${errors.name ? 'contact-input-error' : ''}`}
                placeholder="Your full name"
                value={form.name}
                onChange={handleChange}
                disabled={status === 'loading'}
                autoComplete="name"
              />
              {errors.name && <span className="contact-field-error">{errors.name}</span>}
            </div>

            {/* Phone */}
            <div className="contact-field">
              <label className="contact-label" htmlFor="crm-phone">Phone *</label>
              <input
                id="crm-phone"
                name="phone"
                type="tel"
                className={`contact-input ${errors.phone ? 'contact-input-error' : ''}`}
                placeholder="050 000 0000"
                value={form.phone}
                onChange={handleChange}
                disabled={status === 'loading'}
                autoComplete="tel"
              />
              {errors.phone && <span className="contact-field-error">{errors.phone}</span>}
            </div>

            {/* Office Phone */}
            <div className="contact-field">
              <label className="contact-label" htmlFor="crm-office-phone">
                Office Phone <span className="contact-optional">(optional)</span>
              </label>
              <input
                id="crm-office-phone"
                name="officePhone"
                type="tel"
                className="contact-input"
                placeholder="03 000 0000"
                value={form.officePhone}
                onChange={handleChange}
                disabled={status === 'loading'}
                autoComplete="tel-local"
              />
            </div>

            {/* Company */}
            <div className="contact-field">
              <label className="contact-label" htmlFor="crm-company">
                Company <span className="contact-optional">(optional)</span>
              </label>
              <input
                id="crm-company"
                name="company"
                type="text"
                className={`contact-input ${errors.company ? 'contact-input-error' : ''}`}
                placeholder="Your company or business"
                value={form.company}
                onChange={handleChange}
                disabled={status === 'loading'}
                autoComplete="organization"
              />
              {errors.company && <span className="contact-field-error">{errors.company}</span>}
            </div>

            {/* Interest */}
            <div className="contact-field">
              <label className="contact-label" htmlFor="crm-interest">
                I&apos;m interested in <span className="contact-optional">(optional)</span>
              </label>
              <select
                id="crm-interest"
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
              <label className="contact-label" htmlFor="crm-message">
                Message <span className="contact-optional">(optional)</span>
              </label>
              <textarea
                id="crm-message"
                name="message"
                className={`contact-input contact-textarea ${errors.message ? 'contact-input-error' : ''}`}
                placeholder="Tell us about your needs..."
                value={form.message}
                onChange={handleChange}
                disabled={status === 'loading'}
                rows={3}
              />
              <span className="contact-char-count">{form.message.length}/500</span>
              {errors.message && <span className="contact-field-error">{errors.message}</span>}
            </div>

            {status === 'error' && serverError && (
              <div className="contact-server-error">{serverError}</div>
            )}

            <button
              type="submit"
              className="btn-primary contact-submit"
              disabled={status === 'loading'}
            >
              {status === 'loading' ? (
                <><span className="contact-spinner" />Sending…</>
              ) : (
                <>Send Details →</>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
