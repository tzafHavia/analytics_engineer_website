'use client';
import { useState, useEffect, useCallback } from 'react';

export default function ContactModal({ isOpen, onClose }) {
  const [form, setForm] = useState({ name: '', phone: '', message: '' });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [serverError, setServerError] = useState('');

  // Auto-close after success
  useEffect(() => {
    if (status !== 'success') return;
    const t = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(t);
  }, [status, onClose]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setForm({ name: '', phone: '', message: '' });
      setErrors({});
      setStatus('idle');
      setServerError('');
    }
  }, [isOpen]);

  // Close on Escape key
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
    if (form.message.length > 500) errs.message = 'Max 500 characters.';
    return errs;
  };

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // Clear field error on change
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
          message: form.message.trim(),
          source: 'analytics_engineering',
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
      aria-labelledby="contact-modal-title"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="contact-modal">
        {/* Header */}
        <div className="contact-modal-header">
          <h2 id="contact-modal-title" className="contact-modal-title">
            <span>💬</span> Let&apos;s Connect
          </h2>
          <button onClick={onClose} className="contact-modal-close" aria-label="Close">✕</button>
        </div>

        <p className="contact-modal-subtitle">
          Leave your details and I&apos;ll get back to you shortly.
        </p>

        {/* Success State */}
        {status === 'success' ? (
          <div className="contact-modal-success">
            <span className="contact-success-icon">✅</span>
            <p className="contact-success-title">Details received!</p>
            <p className="contact-success-sub">I&apos;ll be in touch soon. Closing in a moment…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate className="contact-form">
            {/* Name */}
            <div className="contact-field">
              <label className="contact-label" htmlFor="contact-name">Name *</label>
              <input
                id="contact-name"
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
              <label className="contact-label" htmlFor="contact-phone">Phone *</label>
              <input
                id="contact-phone"
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

            {/* Message */}
            <div className="contact-field">
              <label className="contact-label" htmlFor="contact-message">
                Message <span className="contact-optional">(optional)</span>
              </label>
              <textarea
                id="contact-message"
                name="message"
                className={`contact-input contact-textarea ${errors.message ? 'contact-input-error' : ''}`}
                placeholder="What would you like to discuss?"
                value={form.message}
                onChange={handleChange}
                disabled={status === 'loading'}
                rows={3}
              />
              <span className="contact-char-count">{form.message.length}/500</span>
              {errors.message && <span className="contact-field-error">{errors.message}</span>}
            </div>

            {/* Server error */}
            {status === 'error' && serverError && (
              <div className="contact-server-error">{serverError}</div>
            )}

            {/* Submit */}
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
