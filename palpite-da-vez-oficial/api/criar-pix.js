export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const { nome, email, cpf } = req.body || {};
  if (!nome || !email || !cpf) return res.status(400).json({ error: 'Dados incompletos' });

  const cpfLimpo = String(cpf).replace(/\D/g, '');
  const partes = nome.trim().split(' ');
  const firstName = partes[0];
  const lastName = partes.slice(1).join(' ') || partes[0];

  const origin = `https://${req.headers.host}`;

  try {
    const mpRes = await fetch('https://api.mercadopago.com/v1/payments', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': `pdv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
      },
      body: JSON.stringify({
        transaction_amount: 1.00,
        description: 'Grupo VIP - Palpites Esportivos (Mensal)',
        payment_method_id: 'pix',
        payer: {
          email,
          first_name: firstName,
          last_name: lastName,
          identification: { type: 'CPF', number: cpfLimpo }
        },
        notification_url: `${origin}/api/webhook`
      })
    });

    const data = await mpRes.json();
    if (!mpRes.ok) {
      console.error('Erro MP (pix):', data);
      return res.status(500).json({ error: data.message || 'Erro ao gerar Pix' });
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
