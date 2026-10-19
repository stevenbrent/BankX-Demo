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

  // Lets the "outcome missing/malformed" path be demoed on demand, without needing Alloy to
  // actually misbehave: skips the real call like ALLOY_MOCK=true does, but feeds a bogus
  // outcome through the real interpretAlloyOutcome below, which throws on anything it doesn't
  // recognize. That throw is handled exactly like a real API failure (see server/index.js).
  if (ALLOY_MOCK === 'fail') {
    console.log('[alloy] ALLOY_MOCK=fail — skipping Alloy API calls, simulating a malformed evaluation response.');
    const evaluation = mockFailureEvaluation();
    return { evaluation, outcome: interpretAlloyOutcome(evaluation, applicant) };
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

// Used in real mode: maps Alloy's actual evaluation.summary.outcome to the applicant-facing
// status. Only the three outcomes Alloy documents are recognized; a missing or unrecognized
// value means something is wrong with the integration, not a real decision, so this throws
// rather than guessing — the caller's catch block turns that into the same generic
// "something went wrong" message already shown for a failed API call, instead of telling the
// applicant they're under review when we don't actually know what Alloy returned.
const ALLOY_OUTCOME_STATUS = {
  approved: 'approved',
  denied: 'denied',
  'manual review': 'review',
};

function interpretAlloyOutcome(evaluation, { name_first = '', name_last = '' } = {}) {
  const applicantName = `${name_first} ${name_last}`.trim();
  const raw = String(evaluation?.summary?.outcome ?? '').trim().toLowerCase();
  const status = ALLOY_OUTCOME_STATUS[raw];
  if (!status) {
    throw new Error(`Alloy returned an unrecognized evaluation outcome: ${JSON.stringify(evaluation?.summary?.outcome ?? null)}`);
  }
  return { status, applicantName, message: OUTCOME_MESSAGES[status] };
}

// Stands in for a real Alloy call when ALLOY_MOCK=true.
function mockEvaluation() {
  return { summary: { outcome: 'Approved' } };
}

// Stands in for a real Alloy call when ALLOY_MOCK=fail — a response Alloy would never
// actually send, so it's guaranteed to miss every case in ALLOY_OUTCOME_STATUS below.
function mockFailureEvaluation() {
  return { summary: { outcome: 'gibberish' } };
}
