# Chat em tempo real

O chat abre direto e atribui um nome como **Visitante 1**. Cada navegador recebe uma identidade própria, mantida por um cookie. Abas do mesmo navegador usam o mesmo visitante.

## Como rodar

Use o Node.js 24 ou mais recente. No terminal, abra a pasta `chat` e rode:

```sh
npm ci
npm start
```

Abra [http://localhost:3000](http://localhost:3000). Para simular duas pessoas, abra também em uma janela anônima ou em outro navegador. Assim que ambas as janelas carregarem, use **Nova conversa** ou **Novo grupo** para escolher os participantes.

## Onde está o código

| Arquivo | Responsabilidade |
| --- | --- |
| `publico/index.html` | Estrutura da tela |
| `publico/estilo.css` | Aparência do chat |
| `publico/chat.js` | Interações da tela e atualização das mensagens |
| `servidor/servidor.js` | Rotas HTTP e avisos em tempo real pelo Socket.IO |
| `servidor/banco.js` | Abertura do SQLite e execução do esquema |
| `dados/esquema.sql` | Tabelas de visitantes, conversas e mensagens |

As mensagens ficam em `dados/conversas.sqlite`, criado ao iniciar. Esta versão começa com um banco novo porque as conversas anteriores estavam vinculadas às contas antigas. Preserve o ZIP original para guardar esse histórico.
