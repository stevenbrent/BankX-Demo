// Alloy integration. Credentials are read from environment variables only and
// never leave the server.

const {
  ALLOY_BASE_URL = 'https://sandbox.alloy.co/v1',
  ALLOY_WORKFLOW_TOKEN,
  ALLOY_WORKFLOW_SECRET,
  ALLOY_MOCK,
} = process.env;

export async function submitEvaluation(applicant) {
  if (ALLOY_MOCK === 'true') return mockEvaluation(applicant);

  if (!ALLOY_WORKFLOW_TOKEN || !ALLOY_WORKFLOW_SECRET) {
    throw new Error('Alloy credentials are not configured');
  }

  // Our field names already match Alloy's /v1/parameters/ keys 1:1, so no remapping is needed.
  const auth = Buffer.from(`${ALLOY_WORKFLOW_TOKEN}:${ALLOY_WORKFLOW_SECRET}`).toString('base64');
  const res = await fetch(`${ALLOY_BASE_URL}/evaluations`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(applicant),
  });

  if (!res.ok) {
    throw new Error(`Alloy request failed with status ${res.status}`);
  }
  return res.json();
}

// The sandbox workflow doesn't branch its own outcome on the applicant's name, so the
// three demo outcomes (Approved / Manual Review / Denied) are enforced here, server-side,
// based on name_last rather than on whatever Alloy's response actually says.
export function interpretOutcome({ name_first = '', name_last = '' } = {}) {
  const applicantName = `${name_first} ${name_last}`.trim();
  switch (name_last.trim().toLowerCase()) {
    case 'deny':
      return { status: 'denied', applicantName, message: 'Unfortunately, we are unable to approve your application at this time.' };
    case 'review':
      return { status: 'review', applicantName, message: 'Thanks! Your application is under review. We will be in touch soon.' };
    default:
      return { status: 'approved', applicantName, message: 'Congratulations! Your application has been approved.' };
  }
}

// Stands in for a real Alloy call when ALLOY_MOCK=true; the response shape only needs to
// be plausible since interpretOutcome no longer reads the outcome from it.
function mockEvaluation() {
  return { summary: { outcome: 'Approved' } };
}
