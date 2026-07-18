const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function supabaseFetch(path, options = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...(options.headers || {})
    }
  });
}

export default async function handler(req, res) {
  try {
    const paymentId = req.query.id || req.body?.data?.id || req.query['data.id'];
    const topic = req.query.topic || req.body?.type;

    if (topic !== 'payment' || !paymentId) {
      return res.status(200).send('ignored');
    }

    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}` }
    });
    const payment = await mpRes.json();

    if (mpRes.ok && payment.status === 'approved') {
      const checkRes = await supabaseFetch(`clientes?payment_id=eq.${paymentId}`);
      const existing = await checkRes.json();

      if (existing.length === 0) {
        const payerEmail = payment.metadata?.cliente_email || payment.payer?.email || null;
        const isRenovacao = payment.metadata?.tipo === 'renovacao';

        // tenta localizar cliente existente pelo e-mail do pagador (fluxo de renovação)
        let clienteExistente = null;
        if (payerEmail) {
          const buscaRes = await supabaseFetch(`clientes?email=eq.${encodeURIComponent(payerEmail)}&order=created_at.desc&limit=1`);
          const busca = await buscaRes.json();
          if (busca.length > 0) clienteExistente = busca[0];
        }

        const agora = new Date();

        if (isRenovacao && clienteExistente) {
          // RENOVAÇÃO: soma 30 dias se ainda não venceu, ou reinicia 30 dias a partir de agora se já venceu
          const vencimentoAtual = clienteExistente.expires_at ? new Date(clienteExistente.expires_at) : null;
          let novoVencimento;
          if (vencimentoAtual && vencimentoAtual > agora) {
            novoVencimento = new Date(vencimentoAtual.getTime() + 30 * 24 * 60 * 60 * 1000);
          } else {
            novoVencimento = new Date(agora.getTime() + 30 * 24 * 60 * 60 * 1000);
          }

          await supabaseFetch(`clientes?id=eq.${clienteExistente.id}`, {
            method: 'PATCH',
            body: JSON.stringify({
              status: 'pago',
              subscription_status: 'ativa',
              expires_at: novoVencimento.toISOString(),
              last_payment_at: agora.toISOString(),
              payment_id: String(paymentId),
              valor: payment.transaction_amount
            })
          });
        } else {
          // cria um registro "esqueleto" - o formulário completa nome/email/whatsapp depois (comportamento original preservado)
          const expiresAt = new Date(agora.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
          await supabaseFetch('clientes', {
            method: 'POST',
            body: JSON.stringify({
              nome: '', email: payerEmail || '', whatsapp: '',
              valor: payment.transaction_amount,
              status: 'pago',
              payment_id: String(paymentId),
              created_at: agora.toISOString(),
              subscription_status: 'ativa',
              expires_at: expiresAt,
              last_payment_at: agora.toISOString()
            })
          });
        }
      }
    }

    return res.status(200).send('ok');
  } catch (err) {
    console.error(err);
    return res.status(200).send('erro tratado'); // sempre 200 pro MP não ficar reenviando em loop
  }
}
