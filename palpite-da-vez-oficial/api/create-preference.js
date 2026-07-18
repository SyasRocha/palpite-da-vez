export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const origin = `https://${req.headers.host}`;

  // token único de acompanhamento: permite localizar o pagamento depois,
  // mesmo se o Mercado Pago não redirecionar automaticamente (comum no Pix real)
  const token = `pdv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  try {
    const mpRes = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        items: [{
          title: 'Grupo VIP - Palpites Esportivos (Mensal)',
          quantity: 1,
          unit_price: 19.99,
          currency_id: 'BRL'
        }],
        external_reference: token,
        back_urls: {
          success: `${origin}/obrigado.html`,
          failure: `${origin}/`,
          pending: `${origin}/obrigado.html`
        },
        auto_return: 'approved',
        notification_url: `${origin}/api/webhook`
      })
    });

    const data = await mpRes.json();
    if (!mpRes.ok) {
      console.error('Erro MP:', data);
      return res.status(500).json({ error: 'Erro ao criar pagamento' });
    }

    return res.status(200).json({ init_point: data.init_point, token });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro interno' });
  }
}
