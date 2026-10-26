const express = require('express');
const crypto = require('crypto');
const path = require('path');
const { Pool } = require('pg');

const { DATABASE_URL, ADMIN_PASSWORD, PORT = 3000 } = process.env;
if (!DATABASE_URL) { console.error('Falta a variável DATABASE_URL (string de conexão do Neon).'); process.exit(1); }
if (!ADMIN_PASSWORD) { console.error('Falta a variável ADMIN_PASSWORD (senha do PC da central).'); process.exit(1); }

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
  connectionTimeoutMillis: 15000, // Neon pode demorar alguns segundos para "acordar"
  idleTimeoutMillis: 30000
});

const app = express();
app.use(express.json({ limit: '50kb' }));

// ---------- Banco ----------
async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS registros (
      id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      data      date          NOT NULL,
      loja      text          NOT NULL,
      codigo    text          NOT NULL,
      falta     numeric(12,3) NOT NULL DEFAULT 0,
      sobra     numeric(12,3) NOT NULL DEFAULT 0,
      criado_em timestamptz   NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS registros_data_idx ON registros (data, loja);
  `);
}

// ---------- Auth da central (Basic Auth) ----------
function sameStr(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}
function central(req, res, next) {
  const h = req.headers.authorization || '';
  if (h.startsWith('Basic ')) {
    const pass = Buffer.from(h.slice(6), 'base64').toString().split(':').slice(1).join(':');
    if (sameStr(pass, ADMIN_PASSWORD)) return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="Central - Conferencia"').status(401).send('Acesso restrito.');
}

// ---------- Utilidades ----------
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fmtData = d => { const s = typeof d === 'string' ? d : d.toISOString().slice(0, 10); return s.slice(0, 10).split('-').reverse().join('/'); };
const fmtNum = n => String(Number(n)).replace('.', ',');
const wrap = fn => (req, res) => fn(req, res).catch(e => { console.error(e); res.status(500).json({ erro: 'Erro no servidor.' }); });

function filtros(q) {
  const where = [], vals = [];
  if (/^\d{4}-\d{2}-\d{2}$/.test(q.de || '')) { vals.push(q.de); where.push(`data >= $${vals.length}`); }
  if (/^\d{4}-\d{2}-\d{2}$/.test(q.ate || '')) { vals.push(q.ate); where.push(`data <= $${vals.length}`); }
  if (q.loja) { vals.push(String(q.loja).trim().toUpperCase().slice(0, 30)); where.push(`loja = $${vals.length}`); }
  return { sql: where.length ? 'WHERE ' + where.join(' AND ') : '', vals };
}
const SEL = `SELECT id, to_char(data,'YYYY-MM-DD') AS data, loja, codigo, falta::float AS falta, sobra::float AS sobra FROM registros`;

// ---------- API pública (quem confere) ----------
app.post('/api/registros', wrap(async (req, res) => {
  const { data, loja, codigo, tipo, qtd } = req.body || {};
  const q = Number(qtd);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data || '')) return res.status(400).json({ erro: 'Data inválida.' });
  if (!loja || !String(loja).trim() || String(loja).length > 30) return res.status(400).json({ erro: 'Loja inválida.' });
  if (!codigo || !String(codigo).trim() || String(codigo).length > 30) return res.status(400).json({ erro: 'Código inválido.' });
  if (tipo !== 'sobra' && tipo !== 'falta') return res.status(400).json({ erro: 'Tipo inválido.' });
  if (!(q > 0) || q > 1000000) return res.status(400).json({ erro: 'Quantidade inválida.' });
  const r = await pool.query(
    `INSERT INTO registros (data, loja, codigo, falta, sobra) VALUES ($1,$2,$3,$4,$5)
     RETURNING id, to_char(data,'YYYY-MM-DD') AS data, loja, codigo, falta::float AS falta, sobra::float AS sobra`,
    [data, String(loja).trim().toUpperCase(), String(codigo).trim(), tipo === 'falta' ? -q : 0, tipo === 'sobra' ? q : 0]
  );
  res.status(201).json(r.rows[0]);
}));

// Lista apenas os registros cujos ids o aparelho enviou (os que ele mesmo criou)
app.post('/api/meus', wrap(async (req, res) => {
  const ids = (Array.isArray(req.body && req.body.ids) ? req.body.ids : []).filter(i => UUID.test(i)).slice(0, 500);
  if (!ids.length) return res.json([]);
  const r = await pool.query(`${SEL} WHERE id = ANY($1::uuid[]) ORDER BY criado_em`, [ids]);
  res.json(r.rows);
}));

app.delete('/api/registros/:id', wrap(async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(400).json({ erro: 'Id inválido.' });
  await pool.query('DELETE FROM registros WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

// ---------- Central (PC específico, com senha) ----------
app.get('/central', central, (req, res) => res.sendFile(path.join(__dirname, 'private', 'central.html')));

app.get('/api/central/registros', central, wrap(async (req, res) => {
  const f = filtros(req.query);
  const r = await pool.query(`${SEL} ${f.sql} ORDER BY data, loja, criado_em LIMIT 50000`, f.vals);
  res.json(r.rows);
}));

app.get('/api/central/csv', central, wrap(async (req, res) => {
  const f = filtros(req.query);
  const r = await pool.query(`${SEL} ${f.sql} ORDER BY data, loja, criado_em LIMIT 50000`, f.vals);
  const head = ['DATA CONF.', 'LOJA', 'CÓDIGO', 'Qtd de Faltas em KG', 'Qtd de Sobras em KG'];
  const lines = [head].concat(r.rows.map(x => [fmtData(x.data), x.loja, x.codigo, fmtNum(x.falta), fmtNum(x.sobra)]));
  const csv = '\ufeff' + lines.map(l => l.join(';')).join('\r\n');
  const nome = 'conferencia_sobras_faltas_' + new Date().toISOString().slice(0, 10) + '.csv';
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${nome}"` }).send(csv);
}));

app.delete('/api/central/registros/:id', central, wrap(async (req, res) => {
  if (!UUID.test(req.params.id)) return res.status(400).json({ erro: 'Id inválido.' });
  await pool.query('DELETE FROM registros WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}));

// ---------- Estáticos ----------
app.get('/healthz', (req, res) => res.send('ok'));
app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html', extensions: ['html']}));

initDb().then(() => app.listen(PORT, () => console.log('Rodando na porta ' + PORT)))
  .catch(e => { console.error('Falha ao iniciar o banco:', e); process.exit(1); });
