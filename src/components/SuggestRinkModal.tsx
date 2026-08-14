'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

interface SuggestRinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Pre-fills the name field, e.g. from the search box that came up empty */
  initialQuery?: string;
}

interface RinkTypeOption {
  value: string;
  label: string;
}

const RINK_TYPES: RinkTypeOption[] = [
  { value: 'public', label: 'Public Rink' },
  { value: 'private_club', label: 'Private Club' },
  { value: 'municipal', label: 'Municipal / Town' },
  { value: 'school', label: 'School Facility' },
  { value: 'outdoor', label: 'Outdoor Rink' },
];

export default function SuggestRinkModal({
  isOpen,
  onClose,
  initialQuery = '',
}: SuggestRinkModalProps) {
  const { user, session } = useAuth();

  const [name, setName] = useState(initialQuery);
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [address, setAddress] = useState('');
  const [rinkType, setRinkType] = useState('');
  const [notes, setNotes] = useState('');
  const [website, setWebsite] = useState(''); // honeypot, kept empty by real users
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const resetAndClose = () => {
    setName('');
    setCity('');
    setState('');
    setAddress('');
    setRinkType('');
    setNotes('');
    setError(null);
    setSuccess(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user) {
      setError('Please sign in to suggest a rink.');
      return;
    }

    if (!name.trim() || !city.trim() || !state.trim()) {
      setError('Rink name, city, and state are required.');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/rink-suggestions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token}`,
  },
  body: JSON.stringify({
    
          suggestion_type: 'new_rink',
          payload: {
            name: name.trim(),
            city: city.trim(),
            state: state.trim(),
            address: address.trim(),
            rink_type: rinkType,
            notes: notes.trim(),
          },
          website, // honeypot field, API rejects if filled
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Something went wrong. Please try again.');
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="suggest-rink-overlay" onClick={resetAndClose}>
      <div
        className="clay-card suggest-rink-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="suggest-rink-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="close-btn"
          onClick={resetAndClose}
          aria-label="Close"
        >
          &times;
        </button>

        {success ? (
          <div className="success-state">
            <h2 id="suggest-rink-title">Thanks for helping the community!</h2>
            <p>
              We&apos;ve got your suggestion for <strong>{name}</strong>. Senan
              reviews every submission personally — you&apos;ll get an email
              once it&apos;s live.
            </p>
            <button type="button" className="clay-btn" onClick={resetAndClose}>
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <h2 id="suggest-rink-title">Suggest a Rink</h2>
            <p className="subtitle">
              Can&apos;t find a rink you know about? Add the details below and
              we&apos;ll get it added for other hockey families.
            </p>

            {/* Honeypot — hidden from real users, bots tend to fill every field */}
            <input
              type="text"
              name="website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="honeypot-field"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
            />

            <label htmlFor="rink-name">
              Rink Name<span aria-hidden="true"> *</span>
            </label>
            <input
              id="rink-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Ice Palace Arena"
              required
            />

            <div className="field-row">
              <div>
                <label htmlFor="rink-city">
                  City<span aria-hidden="true"> *</span>
                </label>
                <input
                  id="rink-city"
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="e.g. Fall River"
                  required
                />
              </div>
              <div>
                <label htmlFor="rink-state">
                  State<span aria-hidden="true"> *</span>
                </label>
                <input
                  id="rink-state"
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  placeholder="e.g. MA"
                  required
                />
              </div>
            </div>

            <label htmlFor="rink-address">Full Address (optional, but helpful)</label>
            <input
              id="rink-address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street address"
            />

            <label htmlFor="rink-type">Rink Type</label>
            <select
              id="rink-type"
              value={rinkType}
              onChange={(e) => setRinkType(e.target.value)}
            >
              <option value="">Not sure / skip</option>
              {RINK_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>

            <label htmlFor="rink-notes">Anything else we should know?</label>
            <textarea
              id="rink-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Optional — number of rinks on site, pro shop, etc."
            />

            {error && <p className="form-error" role="alert">{error}</p>}

            <button type="submit" className="clay-btn" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit Suggestion'}
            </button>
          </form>
        )}
      </div>

      <style jsx>{`
        .suggest-rink-overlay {
          position: fixed;
          inset: 0;
          background: rgba(13, 42, 74, 0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          z-index: 1000;
        }
        .suggest-rink-modal {
          position: relative;
          width: 100%;
          max-width: 480px;
          max-height: 90vh;
          overflow-y: auto;
          padding: 32px;
        }
        .close-btn {
          position: absolute;
          top: 16px;
          right: 16px;
          width: 44px;
          height: 44px;
          border: none;
          background: transparent;
          font-size: 24px;
          line-height: 1;
          color: var(--rr-navy);
          cursor: pointer;
        }
        h2 {
          font-family: 'Nunito', sans-serif;
          color: var(--rr-navy);
          margin: 0 0 8px;
        }
        .subtitle {
          color: rgba(13, 42, 74, 0.75);
          margin: 0 0 24px;
          font-size: 0.95rem;
        }
        label {
          display: block;
          font-weight: 700;
          color: var(--rr-navy);
          margin: 16px 0 6px;
          font-size: 0.9rem;
        }
        input,
        select,
        textarea {
          width: 100%;
          padding: 12px 14px;
          border-radius: 12px;
          border: 2px solid rgba(13, 42, 74, 0.15);
          font-size: 1rem;
          font-family: inherit;
          box-sizing: border-box;
        }
        input:focus,
        select:focus,
        textarea:focus {
          outline: 3px solid var(--rr-yellow);
          outline-offset: 1px;
          border-color: var(--rr-navy);
        }
        .field-row {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 12px;
        }
        .honeypot-field {
          position: absolute;
          left: -9999px;
          width: 1px;
          height: 1px;
          overflow: hidden;
        }
        .form-error {
          color: var(--rr-red);
          font-weight: 700;
          margin: 16px 0 0;
        }
        .clay-btn {
          margin-top: 24px;
          width: 100%;
          min-height: 44px;
        }
        .success-state {
          text-align: center;
          padding: 12px 0;
        }
        .success-state h2 {
          margin-bottom: 12px;
        }
        .success-state p {
          color: rgba(13, 42, 74, 0.8);
          margin-bottom: 24px;
        }
      `}</style>
    </div>
  );
}
