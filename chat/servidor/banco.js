const { DatabaseSync } = require('node:sqlite');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const pastaDados = join(__dirname, '..', 'dados');
const banco = new DatabaseSync(join(pastaDados, 'conversas.sqlite'));
banco.exec(readFileSync(join(pastaDados, 'esquema.sql'), 'utf8'));

module.exports = banco;
