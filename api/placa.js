const PLACA = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/;
const BASE = 'https://beta.falcon-server.com.br/data-hub';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido.' });

  const placa = String(req.query?.placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!PLACA.test(placa)) return res.status(400).json({ error: 'Placa inválida. Use ABC1234 ou ABC1D23.' });

  const token = process.env.FALCON_API_KEY?.trim();
  if (!token) return res.status(503).json({ error: 'Chave não configurada. Cadastre FALCON_API_KEY nas variáveis de ambiente da Vercel e faça um novo deploy.' });

  try {
    const response = await fetch(`${BASE}/private/v1/vehicles/${placa}/search`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(12000)
    });
    const raw = await response.text();
    let payload;
    try { payload = JSON.parse(raw); } catch { payload = null; }

    if (!response.ok) {
      const errors = {
        400: 'A API rejeitou a placa informada.',
        401: 'Chave da API inválida ou expirada. Confira FALCON_API_KEY na Vercel.',
        403: 'Sua chave não tem acesso a esta consulta. Confira as permissões no painel da Falcon.',
        404: 'Placa não encontrada na base da Falcon.',
        429: 'Limite de consultas da API atingido. Aguarde a liberação da cota por hora.'
      };
      return res.status(response.status >= 500 ? 502 : response.status).json({ error: errors[response.status] || 'A consulta foi recusada pela Falcon.', statusFalcon: response.status });
    }
    if (!payload || typeof payload !== 'object') return res.status(502).json({ error: 'A Falcon retornou uma resposta que não é JSON.' });
    return res.status(200).json(payload);
  } catch (error) {
    return res.status(504).json({ error: error.name === 'TimeoutError' ? 'A Falcon demorou para responder. Tente novamente.' : 'Não foi possível conectar à Falcon. Tente novamente.' });
  }
}
