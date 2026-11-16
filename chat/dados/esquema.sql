CREATE TABLE IF NOT EXISTS visitantes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chave TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS conversas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome_grupo TEXT
);

CREATE TABLE IF NOT EXISTS participantes (
  conversa_id INTEGER NOT NULL REFERENCES conversas(id),
  visitante_id INTEGER NOT NULL REFERENCES visitantes(id),
  PRIMARY KEY (conversa_id, visitante_id)
);

CREATE TABLE IF NOT EXISTS mensagens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversa_id INTEGER NOT NULL REFERENCES conversas(id),
  autor_id INTEGER NOT NULL REFERENCES visitantes(id),
  texto TEXT NOT NULL,
  enviada_em TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS mensagens_por_conversa ON mensagens(conversa_id, id);
