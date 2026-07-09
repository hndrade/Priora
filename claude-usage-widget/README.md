# Claude Usage Widget — widget flutuante para Windows

Porte para desktop do [Claude Usage Stick (ESP32-S3 + LVGL)](https://github.com/benevid/claude-usage-stick-SVGL):
um cartão flutuante, sempre visível, mostrando o **uso de rate-limit do Claude Code** em tempo
real — janelas de **5 horas** e **7 dias**, contadores de reset, tendência e incidentes da
Anthropic.

Feito com **Electron**, sem framework no renderer (HTML/CSS/JS puro) e sem dependências de
runtime além do próprio Electron.

## O que ele mostra

- **Chip de status geral** (`ok` / `atenção` / `bloqueado`), com as cores do gadget original.
- **5 HORAS** e **7 DIAS**: porcentagem grande colorida por faixa (verde < 70 % · âmbar < 90 % ·
  vermelho ≥ 90 %), barra de progresso e *"reseta em 1h23m (18:20)"* ao vivo.
- **"Limita primeiro"** — qual janela vai te bloquear antes (header `representative-claim`).
- **Sparkline de tendência** (5 h em coral, 7 d em verde), com histórico persistido.
- **Banner de incidentes** lido de `status.claude.com`.
- **Barra coral fina** contando até o próximo refresh — clique nela para atualizar já.

## Comportamento de widget

- Janela **sem borda e transparente**, cantos arredondados, **sempre no topo** (nível
  `screen-saver`, fica acima até de jogos borderless).
- **Arraste por qualquer ponto do cartão**; a posição é salva e restaurada.
- **Fora do Alt-Tab/barra de tarefas** (`skipTaskbar`), com **ícone na bandeja** (tooltip com os
  percentuais, menu com Atualizar/Sair).
- **Instância única** — abrir de novo só traz o widget para frente.
- Ajustes: intervalo de atualização (30 s / 1 min / 2 min / 5 min), **iniciar com o Windows**,
  opacidade e troca de token.

## Como funciona (igual ao gadget)

O widget faz um `POST` mínimo (`max_tokens: 1`) em `https://api.anthropic.com/v1/messages` com os
mesmos headers que o Claude Code envia (`anthropic-beta: oauth-2025-04-20` + `User-Agent`
`claude-code/...`), **descarta o corpo** e lê o uso direto dos headers
`anthropic-ratelimit-unified-*`. Consumo de quota desprezível.

### Token

Com o Claude Code instalado e logado na sua assinatura (Pro/Max):

```bash
claude setup-token
```

Cole o token (`sk-ant-oat01-…`) na primeira tela do widget. Ele é armazenado **cifrado via
DPAPI do Windows** (`safeStorage` do Electron) em `%APPDATA%/claude-usage-widget/config.json`.
Alternativamente, defina a variável de ambiente `CLAUDE_CODE_OAUTH_TOKEN` e o widget a usa
automaticamente.

## Rodar em desenvolvimento

Requisitos: Node.js 20+.

```bash
cd claude-usage-widget
npm install
npm start
```

## Gerar o .exe portátil

```bash
npm run dist
```

Sai em `dist/ClaudeUsageWidget-1.0.0.exe` — um executável portátil único, sem instalador. Para
abrir junto com o Windows, ative **"Iniciar com o Windows"** nos ajustes (⚙) do próprio widget.

## Estrutura

```
claude-usage-widget/
├── main.js         # processo principal: janela, tray, polling da API, token (DPAPI)
├── preload.js      # ponte IPC (contextBridge)
├── renderer/       # UI do cartão (HTML/CSS/JS puro)
└── assets/         # ícones gerados (coral, medidor)
```
