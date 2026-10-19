import { useState } from 'react';
import logo from './assets/bank-x-logo.svg';
import mark from './assets/bank-x-mark.svg';
import { FIELDS, formatSsn, normalize, validate, validateField } from '../../shared/validation.js';

const Logo = () => <img className="logo" src={logo} alt="Bank X" width="168" height="44" />;

// Pre-filled so the form is ready to submit after just entering a last name. Only
// name_last (left blank, for choosing Approved/Denied/Manual Review) and the optional
// address_line_2 are left empty; everything else is a value that already passes validation.
const SAMPLE_VALUES = {
  name_first: 'Jane',
  address_line_1: '1 Main St',
  address_city: 'New York',
  address_state: 'NY',
  address_postal_code: '10001',
  address_country_code: 'US',
  document_ssn: '123456789',
  email_address: 'jane.doe@example.com',
  phone_number: '2125551234',
  birth_date: '1990-04-15',
};
const DEFAULT_FORM = { ...Object.fromEntries(FIELDS.map((f) => [f.name, ''])), ...SAMPLE_VALUES };
const FIELD_BY_NAME = Object.fromEntries(FIELDS.map((f) => [f.name, f]));

// Applied on top of however long the request actually took, so the submit never feels
// instant (and any unusually fast response doesn't flash by) while still never waiting
// less than this on a slow network.
const MIN_SUBMIT_DELAY_MS = 3000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default function App() {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  function update(e) {
    const { name } = e.target;
    let value = e.target.value;
    if (name === 'document_ssn') value = formatSsn(value);
    else if (FIELD_BY_NAME[name]?.uppercase) value = value.toUpperCase();
    setForm({ ...form, [name]: value });
    // Once a field has shown an error, re-check it as the user types so the error clears promptly.
    if (errors[name]) setErrors({ ...errors, [name]: validateField(name, normalize({ [name]: value })[name]) });
  }

  function check(e) {
    const { name, value } = e.target;
    setErrors({ ...errors, [name]: validateField(name, normalize({ [name]: value })[name]) });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length) {
      document.querySelector(`[name="${Object.keys(found)[0]}"]`)?.focus();
      return;
    }

    setSubmitting(true);
    setResult(null);
    const start = Date.now();
    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(normalize(form)),
      });
      const data = await res.json();
      const remaining = MIN_SUBMIT_DELAY_MS - (Date.now() - start);
      if (remaining > 0) await sleep(remaining);
      if (data.errors) setErrors(data.errors);
      setResult(data);
    } catch {
      setResult({ status: 'error', message: 'Could not reach the server. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  }

  if (result && result.status !== 'error') {
    return (
      <main>
        <Logo />
        <div className={`status-card ${result.status}`}>
          <h2>Application Status</h2>
          <p><span className="status-label">Applicant Name:</span> {result.applicantName}</p>
          <p><span className="status-label">Decision Outcome:</span> <strong>{result.status.toUpperCase()}</strong></p>
          <p className="status-message">{result.message}</p>
        </div>
        <button onClick={() => { setForm(DEFAULT_FORM); setErrors({}); setResult(null); }}>
          Start a new application
        </button>
      </main>
    );
  }

  return (
    <main>
      <Logo />
      <h1>Apply now</h1>
      <p className="instructions">
        Fields marked with <span className="required" aria-hidden="true">*</span> are required.
      </p>
      <form onSubmit={handleSubmit} noValidate>
        {FIELDS.map(({ name, label, optional, hint, uppercase, ...rest }) => (
          <label key={name}>
            <span>
              {label}
              {!optional && <span className="required" aria-hidden="true"> *</span>}
            </span>
            {hint && <span id={`${name}-hint`} className="hint">{hint}</span>}
            <input
              name={name}
              value={form[name]}
              onChange={update}
              onBlur={check}
              required={!optional}
              aria-invalid={!!errors[name]}
              aria-describedby={[hint && `${name}-hint`, errors[name] && `${name}-error`].filter(Boolean).join(' ') || undefined}
              {...rest}
            />
            {errors[name] && <span id={`${name}-error`} className="field-error">{errors[name]}</span>}
          </label>
        ))}
        {result?.status === 'error' && <p className="result error">{result.message}</p>}
        <button type="submit" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit application'}
        </button>
        {submitting && (
          <div className="spinner-overlay" role="status" aria-live="polite">
            <img className="spinner" src={mark} alt="" aria-hidden="true" />
            <span>Verifying your application…</span>
          </div>
        )}
      </form>
    </main>
  );
}
