'use client';

import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

interface RinkForEdit {
  id: string; // rinks.id is TEXT, not uuid
  name: string;
  city: string;
  state: string;
  address: string | null;
  rink_type: string | null;
}

interface SuggestEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  rink: RinkForEdit;
}

type EditableField = 'name' | 'city' | 'state' | 'address' | 'rink_type';

const FIELD_LABELS: Record<EditableField, string> = {
  name: 'Rink Name',
  city: 'City',
  state: 'State',
  address: 'Address',
  rink_type: 'Rink Type',
};

export default function SuggestEditModal({
  isOpen,
  onClose,
  rink,
}: SuggestEditModalProps) {
  const { user, session } = useAuth();

  const [values, setValues] = useState<Record<EditableField, string>>({
    name: rink.name || '',
    city: rink.city || '',
    state: rink.state || '',
    address: rink.address || '',
    rink_type: rink.rink_type || '',
  });
  const [reason, setReason] = useState('');
  const [closedFlag, setClosedFlag] = useState(false);
  const [website, setWebsite] = useState(''); // honeypot
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const originalValues: Record<EditableField, string> = {
    name: rink.name || '',
    city: rink.city || '',
    state: rink.state || '',
    address: rink.address || '',
    rink_type: rink.rink_type || '',
  };

  const resetAndClose = () => {
    setValues(originalValues);
    setReason('');
    setClosedFlag(false);
    setError(null);
    setSuccess(false);
    onClose();
  };

  const handleChange = (field: EditableField, val: string) => {
    setValues((prev) => ({ ...prev, [field]: val }));
  };

  const buildDiff = () => {
    const diff: Record<string, { old: string; new: string }> = {};
    (Object.keys(values) as EditableField[]).forEach((field) => {
      if (values[field].trim() !== originalValues[field].trim()) {
        diff[field] = { old: originalValues[field], new: values[field].trim() };
      }
    });
    return diff;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user) {
      setError('Please sign in to suggest an edit.');
      return;
    }

    const diff = buildDiff();

    if (Object.keys(diff).length === 0 && !closedFlag && !reason.trim()) {
      setError('Change at least one field, or leave a note about what\u2019s wrong.');
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
          suggestion_type: 'edit',
          rink_id: rink.id,
          payload: diff,
          reason: reason.trim(),
          reported_closed: closedFlag,
          website, // honeypot
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
    <div className="suggest-edit-overlay" onClick={resetAndClose}>
      <div
        className="clay-card suggest-edit-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="suggest-edit-title"
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
            <h2 id="suggest-edit-title">Thanks for the fix!</h2>
            <p>
              We&apos;ve sent your suggestion for <strong>{rink.name}</strong>{' '}
              to Senan for review.
            </p>
            <button type="button" className="clay-btn" onClick={resetAndClose}>
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <h2 id="suggest-edit-title">Suggest a Fix</h2>
            <p className="subtitle">
              Spot something wrong with <strong>{rink.name}</strong>? Update
              any field below and we&apos;ll review the change.
            </p>

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

            {(Object.keys(FIELD_LABELS) as EditableField[]).map((field) => (
              <div key={field}>
                <label htmlFor={`edit-${field}`}>{FIELD_LABELS[field]}</label>
                <input
                  id={`edit-${field}`}
                  type="text"
                  value={values[field]}
                  onChange={(e) => handleChange(field, e.target.value)}
                />
              </div>
            ))}

            <label className="checkbox-row" htmlFor="edit-closed">
              <input
                id="edit-closed"
                type="checkbox"
                checked={closedFlag}
                onChange={(e) => setClosedFlag(e.target.checked)}
              />
              This rink has closed permanently
            </label>

            <label htmlFor="edit-reason">Notes for our team (optional)</label>
            <textarea
              id="edit-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="e.g. They renamed it after new ownership took over"
            />

            {error && <p className="form-error" role="alert">{error}</p>}

            <button type="submit" className="clay-btn" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit Fix'}
            </button>
          </form>
        )}
      </div>

      <style jsx>{`
        .suggest-edit-overlay {
          position: fixed;
          inset: 0;
          background: rgba(13, 42, 74, 0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          z-index: 1000;
        }
        .suggest-edit-modal {
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
        input[type='text'],
        textarea {
          width: 100%;
          padding: 12px 14px;
          border-radius: 12px;
          border: 2px solid rgba(13, 42, 74, 0.15);
          font-size: 1rem;
          font-family: inherit;
          box-sizing: border-box;
        }
        input[type='text']:focus,
        textarea:focus {
          outline: 3px solid var(--rr-yellow);
          outline-offset: 1px;
          border-color: var(--rr-navy);
        }
        .checkbox-row {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 700;
          margin: 20px 0 0;
          cursor: pointer;
        }
        .checkbox-row input {
          width: 22px;
          height: 22px;
          flex-shrink: 0;
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
