const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Não autenticado' });
  const token = auth.replace('Bearer ', '');

  try {
    // descobre o e-mail do usuário logado via Supabase Auth (nunca confia em e-mail vindo do frontend)
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` }
    });
    const user = await userRes.json();
    if (!userRes.ok || !user.email) {
      return res.status(401).json({ error: 'Sessão inválida' });
    }

    const origin = `https://${req.headers.host}`;

    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        items: [{
          title: 'Grupo VIP - Palpites Esportivos (Renovação)',
          quantity: 1,
          unit_price: 19.99,
          currency_id: 'BRL'
        }],
        payer: { email: user.email },
        metadata: { tipo: 'renovacao', cliente_email: user.email },
        back_urls: {
          success: `${origin}/area-assinante.html?renovado=1`,
          failure: `${origin}/area-assinante.html`,
          pending: `${origin}/area-assinante.html`
        },
        auto_return: 'approved',
        notification_url: `${origin}/api/webhook`
      })
    });

    const data = await mpRes.json();
    if (!mpRes.ok) {
      console.error('Erro MP (renovação):', data);
      return res.status(500).json({ error: 'Erro ao criar pagamento de renovação' });
    }

    return res.status(200).json({ init_point: data.init_point });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno' });
  }
}
