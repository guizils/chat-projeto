const nomeVisitante = document.querySelector('#nome-visitante');
const listaConversas = document.querySelector('#lista-conversas');
const tituloConversa = document.querySelector('#titulo-conversa');
const painelMensagens = document.querySelector('#mensagens');
const formularioMensagem = document.querySelector('#formulario-mensagem');
const textoMensagem = document.querySelector('#texto-mensagem');
const botaoEnviar = document.querySelector('#enviar');
const botaoNovaConversa = document.querySelector('#nova-conversa');
const botaoNovoGrupo = document.querySelector('#novo-grupo');
const janelaConversa = document.querySelector('#janela-conversa');
const formularioConversa = document.querySelector('#formulario-conversa');
const listaVisitantes = document.querySelector('#lista-visitantes');
const nomeGrupo = document.querySelector('#nome-grupo');
const botaoCriar = document.querySelector('#criar');

let visitante;
let conversaAberta;
let tipoConversa;
let conversas = [];
let ultimaConsultaConversas = 0;
let mensagensExibidas = new Set();

async function consultarApi(caminho, dados) {
  const opcoes = dados === undefined ? {} : {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  };
  const resposta = await fetch('/api' + caminho, opcoes);
  const resultado = await resposta.json();
  if (!resposta.ok) throw new Error(resultado.erro || 'Ocorreu um erro ao acessar o chat.');
  return resultado;
}

function mostrarAviso(texto = '', seletor = '#aviso') {
  const aviso = document.querySelector(seletor);
  aviso.textContent = texto;
  aviso.hidden = !texto;
}

async function atualizarConversas() {
  const consulta = ++ultimaConsultaConversas;
  const resultado = await consultarApi('/conversas');
  if (consulta !== ultimaConsultaConversas) return;
  conversas = resultado;
  listaConversas.replaceChildren();

  for (const conversa of conversas) {
    const item = document.createElement('li');
    const botao = document.createElement('button');
    const previa = document.createElement('small');
    botao.type = 'button';
    botao.dataset.conversaId = conversa.id;
    botao.textContent = conversa.nome;
    botao.setAttribute('aria-current', String(conversa.id === conversaAberta?.id));
    previa.textContent = conversa.ultimaMensagem || 'Nenhuma mensagem';
    botao.append(previa);
    item.append(botao);
    listaConversas.append(item);
  }
}

function exibirMensagem(mensagem) {
  if (mensagem.conversaId !== conversaAberta?.id || mensagensExibidas.has(mensagem.id)) return;
  mensagensExibidas.add(mensagem.id);

  const caixa = document.createElement('article');
  const propria = mensagem.autorId === visitante.id;
  caixa.className = propria ? 'mensagem propria' : 'mensagem';

  if (!propria) {
    const autor = document.createElement('strong');
    autor.textContent = `Visitante ${mensagem.autorId}`;
    caixa.append(autor);
  }

  const horario = document.createElement('time');
  horario.dateTime = mensagem.enviadaEm;
  horario.textContent = new Date(mensagem.enviadaEm).toLocaleTimeString('pt-BR', {
    hour: '2-digit', minute: '2-digit',
  });
  caixa.append(mensagem.texto, horario);

  caixa.dataset.mensagemId = mensagem.id;
  // Uma mensagem em tempo real pode chegar antes da resposta com o histórico.
  const posterior = [...painelMensagens.children].find((item) => Number(item.dataset.mensagemId) > mensagem.id);
  painelMensagens.insertBefore(caixa, posterior || null);
  painelMensagens.scrollTop = painelMensagens.scrollHeight;
}

async function atualizarMensagens(conversa) {
  const mensagens = await consultarApi(`/conversas/${conversa.id}/mensagens`);
  if (conversa === conversaAberta) mensagens.forEach(exibirMensagem);
}

async function abrirConversa(conversa) {
  conversaAberta = conversa;
  tituloConversa.textContent = conversa.nome;
  painelMensagens.replaceChildren();
  mensagensExibidas = new Set();
  textoMensagem.value = '';
  textoMensagem.disabled = false;
  botaoEnviar.disabled = false;
  mostrarAviso();
  for (const botao of listaConversas.querySelectorAll('button')) {
    botao.setAttribute('aria-current', String(Number(botao.dataset.conversaId) === conversa.id));
  }
  await atualizarMensagens(conversa);
}

listaConversas.addEventListener('click', (evento) => {
  const botao = evento.target.closest('button[data-conversa-id]');
  if (!botao) return;
  const conversa = conversas.find(({ id }) => id === Number(botao.dataset.conversaId));
  abrirConversa(conversa).catch((erro) => mostrarAviso(erro.message));
});

formularioMensagem.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  const texto = textoMensagem.value.trim();
  if (!texto || !conversaAberta || botaoEnviar.disabled) return;

  const conversa = conversaAberta;
  botaoEnviar.disabled = true;
  try {
    const mensagem = await consultarApi(`/conversas/${conversa.id}/mensagens`, { texto });
    if (conversa === conversaAberta && textoMensagem.value.trim() === texto) textoMensagem.value = '';
    exibirMensagem(mensagem);
    mostrarAviso();
    await atualizarConversas();
  } catch (erro) {
    mostrarAviso(erro.message);
  } finally {
    if (conversa === conversaAberta) botaoEnviar.disabled = false;
  }
});

async function abrirJanelaConversa(tipo) {
  const visitantes = await consultarApi('/visitantes');
  tipoConversa = tipo;
  const grupo = tipo === 'grupo';
  formularioConversa.reset();
  document.querySelector('#titulo-janela').textContent = grupo ? 'Novo grupo' : 'Nova conversa';
  document.querySelector('#campo-grupo').hidden = !grupo;
  nomeGrupo.required = grupo;
  botaoCriar.disabled = !visitantes.length;
  listaVisitantes.replaceChildren();
  mostrarAviso('', '#aviso-janela');

  for (const pessoa of visitantes) {
    const opcao = document.createElement('input');
    opcao.type = grupo ? 'checkbox' : 'radio';
    opcao.name = 'participantes';
    opcao.value = pessoa.id;
    const rotulo = document.createElement('label');
    rotulo.append(opcao, ' ', pessoa.nome);
    listaVisitantes.append(rotulo);
  }

  if (!visitantes.length) {
    listaVisitantes.textContent = 'Abra o chat em outro navegador ou em uma janela anônima para ter outro participante.';
  }
  janelaConversa.showModal();
}

botaoNovaConversa.addEventListener('click', () => {
  abrirJanelaConversa('individual').catch((erro) => mostrarAviso(erro.message));
});
botaoNovoGrupo.addEventListener('click', () => {
  abrirJanelaConversa('grupo').catch((erro) => mostrarAviso(erro.message));
});
document.querySelector('#cancelar').addEventListener('click', () => janelaConversa.close());

formularioConversa.addEventListener('submit', async (evento) => {
  evento.preventDefault();
  if (botaoCriar.disabled) return;
  const participantes = new FormData(formularioConversa).getAll('participantes').map(Number);
  if (!participantes.length) {
    mostrarAviso('Selecione pelo menos um participante.', '#aviso-janela');
    return;
  }

  botaoCriar.disabled = true;
  try {
    const { id } = await consultarApi('/conversas', {
      tipo: tipoConversa,
      nome: nomeGrupo.value,
      participantes,
    });
    // A consulta feita após a criação sempre inclui a nova conversa.
    const resultado = await consultarApi('/conversas');
    janelaConversa.close();
    await abrirConversa(resultado.find((conversa) => conversa.id === id));
    await atualizarConversas();
  } catch (erro) {
    mostrarAviso(erro.message, janelaConversa.open ? '#aviso-janela' : '#aviso');
  } finally {
    botaoCriar.disabled = false;
  }
});

async function iniciarChat() {
  visitante = await consultarApi('/visitante', {});
  nomeVisitante.textContent = visitante.nome;
  botaoNovaConversa.disabled = false;
  botaoNovoGrupo.disabled = false;

  const conexao = io();
  conexao.on('connect', async () => {
    mostrarAviso();
    try {
      await atualizarConversas();
      if (conversaAberta) await atualizarMensagens(conversaAberta);
    } catch (erro) {
      mostrarAviso(erro.message);
    }
  });
  conexao.on('disconnect', () => mostrarAviso('A conexão em tempo real caiu.'));
  conexao.on('connect_error', () => mostrarAviso('Tentando conectar ao chat em tempo real…'));
  conexao.on('conversa-criada', () => {
    atualizarConversas().catch((erro) => mostrarAviso(erro.message));
  });
  conexao.on('mensagem-recebida', (mensagem) => {
    exibirMensagem(mensagem);
    atualizarConversas().catch((erro) => mostrarAviso(erro.message));
  });
}

iniciarChat().catch((erro) => {
  nomeVisitante.textContent = 'Chat indisponível';
  mostrarAviso(erro.message);
});
