const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function supabaseFetch(path, options = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...(options.headers || {})
    }
  });
  return res;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const { payment_id, nome, email, whatsapp } = req.body || {};
  if (!payment_id || !nome || !email || !whatsapp) {
    return res.status(400).json({ error: 'Dados incompletos' });
  }

  try {
    // 1. Nunca confiar no frontend: valida o pagamento direto no Mercado Pago (inalterado)
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${payment_id}`, {
      headers: { 'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}` }
    });
    const payment = await mpRes.json();

    if (!mpRes.ok || payment.status !== 'approved') {
      return res.status(400).json({ error: 'Pagamento não aprovado' });
    }

    // campos novos de assinatura: primeira contratação = 30 dias a partir de agora
    const agora = new Date();
    const expiresAt = new Date(agora.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // 2. Verifica se esse payment_id já foi salvo (evita duplicidade) - inalterado
    const checkRes = await supabaseFetch(`clientes?payment_id=eq.${payment_id}`);
    const existing = await checkRes.json();

    if (existing.length > 0) {
      // já existe (webhook pode ter criado antes) -> apenas atualiza os dados do formulário
      // preserva expires_at se o webhook já tiver definido um; senão define agora
      const jaTemExpires = existing[0].expires_at;
      await supabaseFetch(`clientes?payment_id=eq.${payment_id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          nome, email, whatsapp, status: 'pago',
          subscription_status: 'ativa',
          expires_at: jaTemExpires || expiresAt,
          last_payment_at: agora.toISOString()
        })
      });
    } else {
      await supabaseFetch('clientes', {
        method: 'POST',
        body: JSON.stringify({
          nome, email, whatsapp,
          valor: payment.transaction_amount,
          status: 'pago',
          payment_id: String(payment_id),
          created_at: agora.toISOString(),
          subscription_status: 'ativa',
          expires_at: expiresAt,
          last_payment_at: agora.toISOString()
        })
      });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno ao salvar dados' });
  }
}
