const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Não autenticado' });
  const token = auth.replace('Bearer ', '');

  const { cpf } = req.body || {};
  if (!cpf) return res.status(400).json({ error: 'CPF obrigatório' });

  try {
    // descobre e-mail e nome do usuário logado via Supabase Auth (nunca confia no frontend)
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` }
    });
    const user = await userRes.json();
    if (!userRes.ok || !user.email) {
      return res.status(401).json({ error: 'Sessão inválida' });
    }

    const nomeCompleto = user.user_metadata?.nome || user.email.split('@')[0];
    const partes = nomeCompleto.trim().split(' ');
    const firstName = partes[0];
    const lastName = partes.slice(1).join(' ') || partes[0];
    const cpfLimpo = String(cpf).replace(/\D/g, '');

    const origin = `https://${req.headers.host}`;

    const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `pdv_renov_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
      },
      body: JSON.stringify({
        transaction_amount: 19.99,
        description: 'Grupo VIP - Palpites Esportivos (Renovação)',
        payment_method_id: 'pix',
        payer: {
          email: user.email,
          first_name: firstName,
          last_name: lastName,
          identification: { type: 'CPF', number: cpfLimpo }
        },
        metadata: { tipo: 'renovacao', cliente_email: user.email },
        notification_url: `${origin}/api/webhook`
      })
    });

    const data = await mpRes.json();
    if (!mpRes.ok) {
      console.error('Erro MP (renovação pix):', data);
      return res.status(500).json({ error: data.message || 'Erro ao gerar Pix de renovação' });
    }

    const txData = data.point_of_interaction?.transaction_data;
    return res.status(200).json({
      payment_id: data.id,
      qr_code: txData?.qr_code,
      qr_code_base64: txData?.qr_code_base64,
      status: data.status
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno' });
  }
}
