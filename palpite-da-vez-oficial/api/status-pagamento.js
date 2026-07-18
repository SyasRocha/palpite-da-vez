export default async function handler(req, res) {
  const paymentId = req.query.payment_id;
  if (!paymentId) return res.status(400).json({ error: 'payment_id obrigatório' });

  try {
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { 'Authorization': `Bearer ${process.env.MP_ACCESS_TOKEN}` }
    });
    const data = await mpRes.json();
    if (!mpRes.ok) return res.status(500).json({ error: 'Erro ao consultar pagamento' });

    const txData = data.point_of_interaction?.transaction_data;
    return res.status(200).json({
      status: data.status,
      payment_id: data.id,
      qr_code: txData?.qr_code || null,
      qr_code_base64: txData?.qr_code_base64 || null
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao consultar pagamento' });
  }
}
