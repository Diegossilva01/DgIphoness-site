import { createHash, timingSafeEqual } from 'node:crypto';
import { neon } from '@neondatabase/serverless';

const MAX_FOTO_BYTES = 300 * 1024;
const MAX_BODY_BYTES = 500 * 1024;
class ValidationError extends Error {}

function autorizado(recebida, esperada) {
  if (!esperada || typeof recebida !== 'string') return false;
  const a = createHash('sha256').update(recebida).digest();
  const b = createHash('sha256').update(esperada).digest();
  return timingSafeEqual(a, b);
}

function validarPessoa(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ValidationError('Dados inválidos.');
  const nome = typeof body.nome === 'string' ? body.nome.trim() : '';
  const telefone = typeof body.telefone === 'string' ? body.telefone.trim() : '';
  if (!nome || nome.length > 100) throw new ValidationError('Informe um nome de até 100 caracteres.');
  if (telefone.length > 30) throw new ValidationError('O telefone deve ter até 30 caracteres.');

  let foto = null;
  let fotoTipo = null;
  if (body.foto !== null && body.foto !== undefined && body.foto !== '') {
    if (typeof body.foto !== 'string') throw new ValidationError('Foto inválida.');
    const match = /^data:(image\/jpeg|image\/png|image\/webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(body.foto);
    if (!match) throw new ValidationError('Envie uma foto JPG, PNG ou WebP.');
    const bytes = Buffer.from(match[2], 'base64');
    if (bytes.length === 0 || bytes.length > MAX_FOTO_BYTES) throw new ValidationError('A foto deve ter no máximo 300 KB.');
    const [tipo, base64] = [match[1], match[2]];
    const assinaturaValida = tipo === 'image/jpeg'
      ? bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
      : tipo === 'image/png'
        ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
    if (!assinaturaValida || bytes.toString('base64') !== base64) throw new ValidationError('Arquivo de imagem inválido.');
    foto = base64;
    fotoTipo = tipo;
  }
  return { nome, telefone, foto, fotoTipo };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!['GET', 'POST', 'PUT', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, PUT, DELETE');
    return res.status(405).json({ erro: 'Método não permitido.' });
  }
  if (!process.env.DATABASE_URL || !process.env.ADMIN_PASSWORD) {
    return res.status(503).json({ erro: 'Configure DATABASE_URL e ADMIN_PASSWORD na Vercel.' });
  }
  if (!autorizado(req.headers['x-admin-password'], process.env.ADMIN_PASSWORD)) {
    return res.status(401).json({ erro: 'Senha incorreta.' });
  }
  const tamanho = Number(req.headers['content-length'] || 0);
  if (tamanho > MAX_BODY_BYTES) return res.status(413).json({ erro: 'Envio muito grande. Use uma foto de até 300 KB.' });

  const sql = neon(process.env.DATABASE_URL);
  try {
    if (req.method === 'GET') {
      const pessoas = await sql`
        SELECT id::text, nome, telefone, foto_tipo AS "fotoTipo",
               replace(encode(foto, 'base64'), chr(10), '') AS "fotoBase64"
        FROM pessoas_demo ORDER BY id DESC LIMIT 50
      `;
      return res.status(200).json({ pessoas });
    }

    if (req.method === 'POST') {
      const { nome, telefone, foto, fotoTipo } = validarPessoa(req.body);
      const [pessoa] = await sql`
        INSERT INTO pessoas_demo (nome, telefone, foto, foto_tipo)
        VALUES (${nome}, ${telefone}, decode(${foto}, 'base64'), ${fotoTipo})
        RETURNING id::text, nome, telefone
      `;
      return res.status(201).json({ pessoa });
    }

    const id = typeof req.body?.id === 'string' ? req.body.id : '';
    if (!/^[1-9]\d{0,17}$/.test(id)) return res.status(400).json({ erro: 'ID inválido.' });
    if (req.method === 'PUT') {
      const { nome, telefone, foto, fotoTipo } = validarPessoa(req.body);
      const [pessoa] = await sql`
        UPDATE pessoas_demo SET nome = ${nome}, telefone = ${telefone},
          foto = decode(${foto}, 'base64'), foto_tipo = ${fotoTipo}
        WHERE id = ${id} RETURNING id::text, nome, telefone
      `;
      return pessoa ? res.status(200).json({ pessoa }) : res.status(404).json({ erro: 'Pessoa não encontrada.' });
    }
    const [pessoa] = await sql`DELETE FROM pessoas_demo WHERE id = ${id} RETURNING id::text`;
    return pessoa ? res.status(200).json({ ok: true }) : res.status(404).json({ erro: 'Pessoa não encontrada.' });
  } catch (erro) {
    if (erro instanceof ValidationError) {
      return res.status(400).json({ erro: erro.message });
    }
    console.error('Erro ao consultar o banco:', erro);
    return res.status(500).json({ erro: 'Falha no banco. Confira se a tabela pessoas_demo foi criada no Neon.' });
  }
}
