# NetPulse

[English](README.md) | Português

O NetPulse é uma plataforma compacta de monitoramento em tempo real desenvolvida para o projeto da disciplina CIC0124 — Redes de Computadores, na Universidade de Brasília. A aplicação demonstra:

- interface web para o cliente
- autenticação e envio de telemetria via HTTP
- atualizações em tempo real com WebSocket
- relays de transporte em TCP e UDP
- medições de RTT e throughput
- persistência local em JSON
- logs e alertas automáticos

## Objetivos atendidos

- arquitetura cliente-servidor com sockets
- protocolo de aplicação simples
- comunicação HTTP
- comparação entre TCP e UDP
- medição de atraso, throughput e tempo de resposta
- discussão de escalabilidade e desempenho
- análise com Wireshark

## Tecnologias

- Node.js
- Express
- WebSocket (`ws`)
- bcryptjs
- persistência local em JSON
- frontend em HTML/CSS/JavaScript puro

## Execução rápida

1. Instale as dependências.
1. Inicie o servidor.
1. Abra a interface no navegador.
1. Crie um usuário e faça login.
1. Envie telemetria via HTTP, relay de transporte e benchmarks.

## Reprodutibilidade (passo a passo)

Pré-requisitos:

- Node.js (recomendado 16+)
- npm
- TeX Live (para compilar o relatório: `pdflatex` disponível)
- Wireshark (para capturas de pacotes)

1. Clone o repositório e instale dependências:

```bash
git clone https://github.com/naviNBRuas/NetPulse.git
cd NetPulse
npm install
```

1. Inicie o servidor (executa HTTP, WebSocket, relays TCP e UDP):

```bash
npm start
# ou em desenvolvimento
npm run dev
```

1. Abra a interface em <http://localhost:3000>, registre um usuário e faça login.

1. Capture pacotes no Wireshark na interface loopback (`lo`). Filtros úteis:

- `http`
- `tcp.port == 4001`
- `udp.port == 4002`

Inicie a captura primeiro e então interaja com a UI (registro, envio de telemetria, execução de benchmark). Para tráfego automatizado e reprodutível, execute o teste automático abaixo enquanto captura.

1. Geração automatizada de tráfego (recomendada):

```bash
npm test
```

Após o término do teste, pare a captura e verifique o arquivo pcap no Wireshark.

1. Compile o relatório (PDF):

```bash
npm run report:build
# o PDF será gerado em report/main.pdf
```

1. Opcional: gerar apenas o tráfego (alias do smoke-test):

```bash
npm run traffic:generate
```

Variáveis de ambiente úteis:

- `PORT` — porta HTTP (padrão 3000)
- `TCP_PORT` — relay TCP (padrão 4001)
- `UDP_PORT` — relay UDP (padrão 4002)
- `NETPULSE_DATA_FILE` — caminho do arquivo JSON de persistência (padrão `data/state.json`)

Notas sobre captura:

- Para demonstrações limpas, inicie a captura no Wireshark, depois inicie o servidor e execute as ações a serem gravadas (ou rode `npm test`).
- Para isolar um fluxo (por exemplo, handshake TCP), use os filtros de porta e capture apenas durante a operação de interesse.
- Em Linux, capturar a interface loopback pode exigir privilégios (execute o Wireshark com permissões adequadas ou use `dumpcap`).

## Comandos

- `npm install`
- `npm start`
- `npm test`
- `npm run report:build`

## Portas padrão

- HTTP/Interface web: `3000`
- Relay TCP: `4001`
- Relay UDP: `4002`

As portas podem ser alteradas com as variáveis de ambiente:

- `PORT`
- `TCP_PORT`
- `UDP_PORT`
- `HOST`
- `NETPULSE_DATA_FILE`

## Estrutura do repositório

- `server/` — servidor da aplicação, persistência e relays de transporte
- `public/` — cliente web
- `docs/` — documentação do protocolo
- `report/` — relatório em LaTeX e PDF gerado
- `scripts/` — testes automáticos e utilitários

## Relatório

O relatório principal está em `report/main.tex` e foi escrito em português, no formato IEEE. Após a compilação, o PDF é gerado na mesma pasta.

## Wireshark

Para testes locais, capture a interface loopback. Filtros úteis:

- `http`
- `tcp.port == 4001`
- `udp.port == 4002`

O relay de transporte e o benchmark foram criados justamente para gerar tráfego real e fácil de analisar no Wireshark.

## Licença

Este repositório é destinado ao uso acadêmico no projeto de Redes de Computadores.

---
Os arquivos deste projeto são distribuídos nos termos do arquivo `LICENSE` incluído (MIT por padrão). Consulte o `LICENSE` para mais detalhes.
