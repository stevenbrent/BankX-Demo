// Alloy integration. Credentials are read from environment variables only and
// never leave the server.

const {
  ALLOY_BASE_URL = 'https://sandbox.alloy.co/v1',
  ALLOY_WORKFLOW_TOKEN,
  ALLOY_WORKFLOW_SECRET,
  ALLOY_MOCK,
} = process.env;

function authHeaders() {
  if (!ALLOY_WORKFLOW_TOKEN || !ALLOY_WORKFLOW_SECRET) {
    throw new Error('Alloy credentials are not configured');
  }
  const auth = Buffer.from(`${ALLOY_WORKFLOW_TOKEN}:${ALLOY_WORKFLOW_SECRET}`).toString('base64');
  return { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' };
}

// Masks any SSN-like field (keeping the last four digits) so request and response bodies can
// be logged without writing a full SSN to the terminal or any captured log.
function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, v]) =>
        /ssn/i.test(key) && typeof v === 'string' ? [key, `*****${v.slice(-4)}`] : [key, redact(v)]
      )
    );
  }
  return value;
}

// Resolves the applicant-facing outcome for a submission. In mock mode there's no real
// decision to read, so the demo outcome is driven by name_last (see interpretOutcome). In
// real mode, Alloy's own evaluation.summary.outcome is what's actually shown to the applicant.
export async function submitEvaluation(applicant) {
  if (ALLOY_MOCK === 'true') {
    console.log('[alloy] ALLOY_MOCK=true — skipping Alloy API calls, using a mock evaluation.');
    const evaluation = mockEvaluation(applicant);
    return { evaluation, outcome: interpretOutcome(applicant) };
  }

  // Our field names already match Alloy's /v1/parameters/ keys 1:1, so no remapping is needed.
  console.log('[alloy] POST /evaluations', redact(applicant));
  const res = await fetch(`${ALLOY_BASE_URL}/evaluations`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(applicant),
  });

  if (!res.ok) {
    throw new Error(`Alloy request failed with status ${res.status}`);
  }
  const evaluation = await res.json();
  console.log('[alloy] POST /evaluations ->', redact(evaluation));

  // Fetched to demonstrate the full submit-then-retrieve API flow; the outcome used below
  // is already present on the POST response above, so this result isn't read again.
  await getEvaluationResults(evaluation.evaluation_token);

  const outcome = interpretAlloyOutcome(evaluation, applicant);
  console.log('[alloy] Resolved outcome from evaluation.summary.outcome ->', outcome);
  return { evaluation, outcome };
}

async function getEvaluationResults(evaluationToken) {
  console.log(`[alloy] GET /evaluations/${evaluationToken}`);
  const res = await fetch(`${ALLOY_BASE_URL}/evaluations/${evaluationToken}`, {
    method: 'GET',
    headers: authHeaders(),
  });

  if (!res.ok) {
    throw new Error(`Alloy evaluation lookup failed with status ${res.status}`);
  }
  const results = await res.json();
  console.log(`[alloy] GET /evaluations/${evaluationToken} ->`, redact(results));
  return results;
}

const OUTCOME_MESSAGES = {
  denied: 'Unfortunately, we are unable to approve your application at this time.',
  review: 'Thanks! Your application is under review. We will be in touch soon.',
  approved: 'Congratulations! Your application has been approved.',
};

// Used only in mock mode, where there's no real decision to read: the three demo outcomes
// are driven by name_last instead so Approved / Manual Review / Denied can be demoed on demand.
function interpretOutcome({ name_first = '', name_last = '' } = {}) {
  const applicantName = `${name_first} ${name_last}`.trim();
  const status = { deny: 'denied', review: 'review' }[name_last.trim().toLowerCase()] || 'approved';
  return { status, applicantName, message: OUTCOME_MESSAGES[status] };
}

// Used in real mode: maps Alloy's actual evaluation.summary.outcome ("Approved" / "Denied" /
// "Manual Review") to the applicant-facing status. Anything unrecognized errs toward manual
// review rather than silently auto-approving an outcome we don't recognize.
function interpretAlloyOutcome(evaluation, { name_first = '', name_last = '' } = {}) {
  const applicantName = `${name_first} ${name_last}`.trim();
  const raw = String(evaluation?.summary?.outcome ?? '').trim().toLowerCase();
  const status = raw === 'approved' ? 'approved' : raw === 'denied' ? 'denied' : 'review';
  return { status, applicantName, message: OUTCOME_MESSAGES[status] };
}

// Stands in for a real Alloy call when ALLOY_MOCK=true.
function mockEvaluation() {
  return { summary: { outcome: 'Approved' } };
}
