const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  const key = req.headers['x-admin-key'];
  if (key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'Chave inválida.' });
  }

  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/clientes?order=created_at.desc`, {
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`
      }
    });
    const clientes = await r.json();
    return res.status(200).json({ clientes });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar clientes' });
  }
}
