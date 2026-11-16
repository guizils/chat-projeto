const { randomUUID } = require('node:crypto');
const { createServer } = require('node:http');
const { join } = require('node:path');
const express = require('express');
const { Server } = require('socket.io');
const banco = require('./banco');

const app = express();
const servidor = createServer(app);
const io = new Server(servidor);""

app.use(express.json());
app.use(express.static(join(__dirname, '..', 'publico')));

function obterVisitante(requisicao) {
  const cookies = requisicao.headers.cookie || '';
  const chave = cookies.match(/(?:^|;\s*)visitante=([a-f0-9-]{36})(?:;|$)/)?.[1];
  return chave ? banco.prepare('SELECT id FROM visitantes WHERE chave = ?').get(chave) : null;
}

function nomeVisitante(id) {
  return `Visitante ${id}`;
}

app.post('/api/visitante', (req, res) => {
  let visitante = obterVisitante(req);
  if (!visitante) {
    const chave = randomUUID();
    const cadastro = banco.prepare('INSERT INTO visitantes (chave) VALUES (?)').run(chave);
    visitante = { id: cadastro.lastInsertRowid };
    res.cookie('visitante', chave, { httpOnly: true, sameSite: 'strict', maxAge: 365 * 86400000 });
  }
  res.json({ id: visitante.id, nome: nomeVisitante(visitante.id) });
});

app.use('/api', (req, res, next) => {
  req.visitante = obterVisitante(req);
  if (!req.visitante) return res.status(401).json({ erro: 'Recarregue a página para entrar no chat.' });
  next();
});

io.on('connection', (socket) => {
  const visitante = obterVisitante(socket.request);
  if (visitante) socket.join(`visitante:${visitante.id}`);
  else socket.disconnect(true);
});

app.get('/api/visitantes', (req, res) => {
  const visitantes = banco.prepare('SELECT id FROM visitantes WHERE id != ? ORDER BY id').all(req.visitante.id);
  res.json(visitantes.map(({ id }) => ({ id, nome: nomeVisitante(id) })));
});

app.get('/api/conversas', (req, res) => {
  const conversas = banco.prepare(`
    SELECT conversas.id, conversas.nome_grupo, outro.visitante_id AS outro_id,
           mensagem.texto AS ultimaMensagem
    FROM participantes AS meus_chats
    JOIN conversas ON conversas.id = meus_chats.conversa_id
    LEFT JOIN participantes AS outro ON outro.conversa_id = conversas.id
         AND outro.visitante_id != meus_chats.visitante_id AND conversas.nome_grupo IS NULL
    LEFT JOIN mensagens AS mensagem ON mensagem.id = (
      SELECT id FROM mensagens WHERE conversa_id = conversas.id ORDER BY id DESC LIMIT 1
    )
    WHERE meus_chats.visitante_id = ?
    ORDER BY mensagem.id DESC, conversas.id DESC
  `).all(req.visitante.id);
  res.json(conversas.map((conversa) => ({
    id: conversa.id,
    nome: conversa.nome_grupo || nomeVisitante(conversa.outro_id),
    ultimaMensagem: conversa.ultimaMensagem,
  })));
});

function avisarParticipantes(conversaId, evento, dados) {
  const participantes = banco.prepare('SELECT visitante_id FROM participantes WHERE conversa_id = ?').all(conversaId);
  const salas = participantes.map(({ visitante_id }) => `visitante:${visitante_id}`);
  io.to(salas).emit(evento, dados);
}

app.post('/api/conversas', (req, res) => {
  const { tipo, nome, participantes } = req.body || {};
  const visitanteId = req.visitante.id;
  const nomeGrupo = typeof nome === 'string' ? nome.trim() : '';
  const outrosIds = Array.isArray(participantes) ? [...new Set(participantes)] : [];
  const existeVisitante = banco.prepare('SELECT id FROM visitantes WHERE id = ?');

  if (!outrosIds.length || outrosIds.some((id) =>
    !Number.isSafeInteger(id) || id === visitanteId || !existeVisitante.get(id)
  )) {
    return res.status(400).json({ erro: 'Selecione participantes válidos.' });
  }

  if (tipo === 'individual' && outrosIds.length === 1) {
    const conversaExistente = banco.prepare(`
      SELECT conversas.id FROM conversas
      JOIN participantes AS primeiro ON primeiro.conversa_id = conversas.id
      JOIN participantes AS segundo ON segundo.conversa_id = conversas.id
      WHERE conversas.nome_grupo IS NULL AND primeiro.visitante_id = ? AND segundo.visitante_id = ?
    `).get(visitanteId, outrosIds[0]);
    if (conversaExistente) return res.json(conversaExistente);
  } else if (tipo !== 'grupo' || !nomeGrupo || nomeGrupo.length > 80) {
    return res.status(400).json({ erro: 'Informe um tipo válido e, para grupos, um nome de até 80 caracteres.' });
  }

  banco.exec('BEGIN');
  let conversaId;
  try {
    conversaId = banco.prepare('INSERT INTO conversas (nome_grupo) VALUES (?)')
      .run(tipo === 'grupo' ? nomeGrupo : null).lastInsertRowid;
    const inserirParticipante = banco.prepare('INSERT INTO participantes VALUES (?, ?)');
    for (const id of [visitanteId, ...outrosIds]) {
      inserirParticipante.run(conversaId, id);
    }
    banco.exec('COMMIT');
  } catch (erro) {
    banco.exec('ROLLBACK');
    throw erro;
  }
  avisarParticipantes(conversaId, 'conversa-criada', { id: conversaId });
  res.status(201).json({ id: conversaId });
});

app.use('/api/conversas/:conversaId/mensagens', (req, res, next) => {
  const conversaId = Number(req.params.conversaId);
  const participante = Number.isSafeInteger(conversaId) && banco.prepare(
    'SELECT 1 FROM participantes WHERE conversa_id = ? AND visitante_id = ?'
  ).get(conversaId, req.visitante.id);
  if (!participante) return res.status(403).json({ erro: 'Você não participa dessa conversa.' });
  req.conversaId = conversaId;
  next();
});

app.get('/api/conversas/:conversaId/mensagens', (req, res) => {
  const mensagens = banco.prepare(`
    SELECT id, conversa_id AS conversaId, autor_id AS autorId, texto, enviada_em AS enviadaEm
    FROM mensagens WHERE conversa_id = ? ORDER BY id
  `).all(req.conversaId);
  res.json(mensagens);
});

app.post('/api/conversas/:conversaId/mensagens', (req, res) => {
  const texto = typeof req.body?.texto === 'string' ? req.body.texto.trim() : '';
  if (!texto || texto.length > 2000) {
    return res.status(400).json({ erro: 'Escreva uma mensagem de até 2000 caracteres.' });
  }
  const conversaId = req.conversaId;
  const autorId = req.visitante.id;
  const enviadaEm = new Date().toISOString();
  const registro = banco.prepare(`
    INSERT INTO mensagens (conversa_id, autor_id, texto, enviada_em) VALUES (?, ?, ?, ?)
  `).run(conversaId, autorId, texto, enviadaEm);
  const mensagem = { id: registro.lastInsertRowid, conversaId, autorId, texto, enviadaEm };
  avisarParticipantes(conversaId, 'mensagem-recebida', mensagem);
  res.status(201).json(mensagem);
});

app.use((erro, req, res, next) => {
  if (res.headersSent) return next(erro);
  if (erro.status === 400) return res.status(400).json({ erro: 'Requisição inválida.' });
  console.error(erro);
  res.status(500).json({ erro: 'O servidor encontrou um erro. Tente novamente.' });
});

const porta = Number(process.env.PORT || 3000);
servidor.listen(porta, () => console.log(`Chat disponível em http://localhost:${servidor.address().port}`));
