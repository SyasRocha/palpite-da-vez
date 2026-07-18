const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Não autenticado' });
  const token = auth.replace('Bearer ', '');

  try {
    // valida o token do Supabase Auth e descobre o e-mail do usuário logado
    const userRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` }
    });
    const user = await userRes.json();
    if (!userRes.ok || !user.email) {
      return res.status(401).json({ error: 'Sessão inválida' });
    }

    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/clientes?email=eq.${encodeURIComponent(user.email)}&order=created_at.desc&limit=1`,
      { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
    );
    const rows = await r.json();
    if (!rows.length) return res.status(404).json({ error: 'Assinatura não encontrada' });

    const c = rows[0];
    let dias_restantes = null;
    if (c.expires_at) {
      const diffMs = new Date(c.expires_at).getTime() - Date.now();
      dias_restantes = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    }

    return res.status(200).json({ ...c, dias_restantes });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Erro ao buscar assinatura' });
  }
}
