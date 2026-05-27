# Instruções do Projeto

## Universidade

Universidade de Brasília  
Departamento de Ciência da Computação  
CIC0124 — Redes de Computadores  
Profa. Priscila Solis

## Projeto 1

- Data de entrega: 27/05/2026
- Grupos de 3 alunos
- Tema geral: Plataforma Inteligente de Comunicação, Monitoramento e Compartilhamento de Dados em Tempo Real

## Objetivo Geral

Desenvolver uma aplicação funcional para Internet que utilize programação em rede para demonstrar, na prática, conceitos fundamentais de aplicações distribuídas e protocolos de comunicação.

A aplicação deve permitir que usuários ou dispositivos enviem dados periodicamente para uma plataforma central ou distribuída.

## Exemplos de Aplicações

- Monitoramento ambiental
- Telemetria IoT
- Mensagens em tempo real
- Dashboard de desempenho
- Monitoramento de laboratórios

## Arquitetura Mínima

- Cliente Web ou Mobile
- Servidor de Aplicação
- Módulo de Comunicação em Tempo Real

## Funcionalidades Exigidas

- Cadastro e autenticação de usuários
- Envio e armazenamento de dados
- Visualização em painel web
- Envio de alertas automáticos
- Comunicação em tempo real
- Medição de RTT e throughput
- Registro de logs

## Funcionalidades Mínimas Obrigatórias

1. Cliente com interface gráfica
2. Servidor funcional
3. Comunicação HTTP
4. Comunicação em tempo real
5. Protocolo documentado
6. Persistência de dados
7. Métricas de rede
8. Medição de RTT
9. Tratamento de erros
10. Demonstração prática

## Análise com Wireshark

O projeto deve incluir uma etapa prática de captura e análise de tráfego utilizando o Wireshark.

O grupo deve demonstrar como as mensagens trafegam na rede, identificando:

- Endereços IP de origem e destino
- Portas de comunicação utilizadas
- Protocolos empregados (HTTP, TCP, UDP, sockets etc.)
- Sequência de troca de mensagens
- Tempo de resposta
- Retransmissões
- Possíveis perdas de pacotes em comunicação UDP

Itens mínimos obrigatórios da análise no Wireshark:

1. Identificação do protocolo de aplicação desenvolvido
2. Identificação dos protocolos das camadas de transporte e rede
3. Análise do handshake TCP, quando TCP for utilizado
4. Análise de pacotes UDP, quando UDP for utilizado
5. Medição aproximada de RTT
6. Identificação do tamanho dos pacotes
7. Análise da sequência de comunicação cliente-servidor
8. Comparação entre diferentes tipos de comunicação implementados

## Entregáveis

O relatório deve seguir o formato especificado na disciplina e deve conter:

1. Link para o código-fonte
2. Descrição clara do protocolo de aplicação
3. Demonstração e análise das capturas de tráfego com Wireshark e das medições solicitadas
4. Link para o vídeo de apresentação/demonstração do grupo (máximo de 10 minutos)