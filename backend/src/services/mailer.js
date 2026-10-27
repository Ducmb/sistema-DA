/**
 * E-mail sender. Plug in the institutional SMTP/transactional provider here.
 * Never log reset links in production.
 */
async function sendResetEmail(to, link) {
  if (process.env.NODE_ENV !== 'production') {
    console.info('[dev] Link de redefinição para', to, '→', link);
    return;
  }
  // TODO: integrar provedor de e-mail (SMTP institucional)
  throw new Error('Mailer not configured');
}

module.exports = { sendResetEmail };
