// Roda no PC específico. Busca registros novos no servidor e acrescenta na planilha Excel local.
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
const BASE = cfg.url.replace(/\/+$/, '');
const AUTH = 'Basic ' + Buffer.from('central:' + cfg.senha).toString('base64');
const ARQUIVO = cfg.arquivo;
const INTERVALO = Math.max(5, Number(cfg.intervaloSegundos) || 15) * 1000;
const log = (...a) => console.log(new Date().toLocaleString('pt-BR'), '-', ...a);

async function http(p, opt = {}) {
  const r = await fetch(BASE + p, Object.assign({ headers: { Authorization: AUTH, 'Content-Type': 'application/json' } }, opt));
  if (r.status === 401) throw new Error('Senha incorreta (config.json).');
  if (!r.ok) throw new Error('Servidor respondeu ' + r.status);
  return r.json();
}

const borda = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
const centro = { horizontal: 'center', vertical: 'middle' };
const preencher = argb => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });

async function abrirPlanilha() {
  const wb = new ExcelJS.Workbook();
  if (fs.existsSync(ARQUIVO)) { await wb.xlsx.readFile(ARQUIVO); }
  let ws = wb.getWorksheet('Conferência');
  if (!ws) {
    ws = wb.addWorksheet('Conferência');
    ws.columns = [
      { header: 'DATA CONF.', width: 14 }, { header: 'LOJA', width: 10 }, { header: 'CÓDIGO', width: 12 },
      { header: 'Qtd de Faltas em KG', width: 22 }, { header: 'Qtd de Sobras em KG', width: 22 },
      { header: 'ID', width: 10, hidden: true }
    ];
    const cores = ['FFFFC000', 'FFFFC000', 'FFFFC000', 'FFFFE0E6', 'FFD9F2D0'];
    cores.forEach((c, i) => {
      const cell = ws.getRow(1).getCell(i + 1);
      cell.fill = preencher(c); cell.font = { bold: true, color: { argb: 'FF000000' } };
      cell.alignment = centro; cell.border = borda;
    });
    ws.views = [{ state: 'frozen', ySplit: 1 }];
  }
  return { wb, ws };
}

function idsExistentes(ws) {
  const set = new Set();
  ws.eachRow((row, n) => { if (n > 1) { const v = row.getCell(6).value; if (v) set.add(String(v)); } });
  return set;
}

function dataLocal(iso) { const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); }

async function ciclo() {
  const pend = await http('/api/agente/pendentes');
  if (!pend.length) return;

  const { wb, ws } = await abrirPlanilha();
  const ja = idsExistentes(ws);
  let novos = 0;
  for (const r of pend) {
    if (ja.has(r.id)) continue; // já está na planilha (evita duplicar)
    const row = ws.addRow([dataLocal(r.data), r.loja, r.codigo, r.falta, r.sobra, r.id]);
    row.eachCell({ includeEmpty: false }, (cell, c) => { if (c <= 5) { cell.alignment = centro; cell.border = borda; } });
    row.getCell(1).numFmt = 'dd/mm/yyyy';
    row.getCell(3).numFmt = '@';
    row.getCell(4).numFmt = '#,##0.0##';
    row.getCell(5).numFmt = '#,##0.0##';
    novos++;
  }

  // grava num arquivo temporário e troca, para nunca corromper a planilha
  fs.mkdirSync(path.dirname(ARQUIVO), { recursive: true });
  const tmp = ARQUIVO + '.tmp';
  await wb.xlsx.writeFile(tmp);
  fs.renameSync(tmp, ARQUIVO); // falha se o Excel estiver com o arquivo aberto -> tenta de novo no próximo ciclo

  await http('/api/agente/confirmar', { method: 'POST', body: JSON.stringify({ ids: pend.map(r => r.id) }) });
  log(novos + ' registro(s) adicionado(s) em ' + ARQUIVO);
}

let rodando = false;
async function loop() {
  if (rodando) return;
  rodando = true;
  try { await ciclo(); }
  catch (e) {
    if (['EBUSY', 'EPERM', 'EACCES'].includes(e.code)) log('Planilha aberta no Excel. Feche-a para receber os novos registros (tentando de novo em breve).');
    else log('Aviso:', e.message);
    try { fs.unlinkSync(ARQUIVO + '.tmp'); } catch (_) {}
  }
  rodando = false;
}
log('Agente iniciado. Planilha:', ARQUIVO);
loop();
setInterval(loop, INTERVALO);
