const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  const key = req.headers['x-admin-key'];
  if (key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'Chave inválida.' });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id obrigatório' });

  try {
    await fetch(`${SUPABASE_URL}/rest/v1/clientes?id=eq.${id}`, {
      method: 'PATCH',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({ status: 'acesso_liberado' })
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao atualizar' });
  }
}
