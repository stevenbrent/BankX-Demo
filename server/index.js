import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { submitEvaluation } from './alloy.js';
import { normalize, validate } from '../shared/validation.js';

const app = express();
app.use(express.json());

app.post('/api/apply', async (req, res) => {
  // Re-validate on the server: frontend checks can be bypassed.
  const errors = validate(req.body);
  if (Object.keys(errors).length) {
    return res.status(400).json({ status: 'error', message: 'Please correct the highlighted fields.', errors });
  }

  try {
    const applicant = normalize(req.body);
    // In mock mode the outcome is driven by name_last; in real mode it comes from Alloy's
    // own evaluation.summary.outcome (see alloy.js).
    const { outcome } = await submitEvaluation(applicant);
    res.json(outcome);
  } catch (err) {
    // Log details server-side; never forward Alloy errors or raw responses to the browser.
    console.error(err);
    res.status(502).json({ status: 'error', message: 'Something went wrong. Please try again later.' });
  }
});

// In production, serve the built React app from the same server (one deployable unit).
const clientDist = path.join(path.dirname(fileURLToPath(import.meta.url)), '../client/dist');
app.use(express.static(clientDist));
app.get('/{*splat}', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`Server listening on http://localhost:${port}`));
