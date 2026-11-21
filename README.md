# NexusMind Gateway para Buzz Desktop (v2.3)

Plugin nativo oficial de integração do **NexusMind Gateway** para o **Buzz Desktop**.

Conecta os agentes do Buzz (Goose, Pi, Codex, etc.) diretamente à infraestrutura unificada do NexusMind, permitindo governança de modelos, healthcheck em tempo real, telemetria de consumo e sincronização em lote com 1 clique.

---

## 🚀 Novos Recursos (v2.3)

- **Cockpit em Tela Cheia (Buzz Design System)**: Interface redesenhada para ocupar 100% da largura útil do Buzz, sem caixas estreitas ou margens laterais vazias.
- **Transição de Estados Estrita (Desconectado vs Conectado)**:
  - **Estado Desconectado**: Tela de conexão limpa e centralizada com suporte a autenticação OAuth / MCP PKCE via navegador ou chave manual.
  - **Estado Conectado**: Cockpit completo com barra superior fixa, identificação de conta (`HeltonFraga01`), saldo atualizado e botão discreto de desconexão.
- **Micro Dashboard de Telemetria**:
  - Saldo Disponível em tempo real (\$5,413.56 USD).
  - Consumo Hoje em tokens e requisições (540.1M tokens • 8,810 reqs).
  - Histórico Acumulado (50.08B tokens • 606.5k reqs).
  - Governança de Modelos Ativos e Inativos.
- **Fim do Layout Desbalanceado ("3 e 1")**:
  - Grid simétrico e perfeito de **4 colunas** para os 4 grupos canônicos (OpenAI, Claude, Antigravity, Grok).
  - Remoção de todo texto estático não-editável, exibindo apenas o logotipo oficial SVG da empresa, badge de status, métricas de consumo e filtro rápido por grupo.
- **Eliminação Absoluta do Erro 401**:
  - O botão **1. Puxar do NexusMind** consulta em paralelo as 4 chaves canônicas da plataforma, agregando **111 modelos únicos** sem qualquer falha de autenticação.
- **Live Healthcheck com Ping de Latência**:
  - Botão **⚡ Testar** individual por modelo com envio de payload ultraleve (`/v1/chat/completions`) utilizando a chave correta de cada grupo e medindo latência em milissegundos.
  - Ações em lote: **Testar Visíveis** e **Desativar Indisponíveis**.
- **Sincronização Rigorosa com Goose e Pi**:
  - O botão **2. Sincronizar no Buzz** grava os provedores locais (`nexusmind_openai`, `nexusmind_anthropic`, `nexusmind_antigravity`, `nexusmind_grok`) com suas respectivas chaves `sk-...` e expurga rigorosamente modelos desativados pelo usuário.
- **Paginação e Busca Fluida**:
  - Seletor de itens por página (15, 30, 50 ou Todos), navegação anterior/próxima e busca textual instantânea.

---

## 📦 Instalação no Buzz Desktop

### Opção 1: Por Pasta Local (Recomendado para Testes Imediatos)
1. No Buzz Desktop, abra o menu lateral e vá em **Manage plugins**.
2. Clique no botão **Add** (canto superior direito).
3. Selecione a pasta deste repositório:
   ```
   /Users/heltonfraga/.buzz/REPOS/nexusmind-buzz-plugin
   ```
4. Clique em **Install** e ative o plugin!

### Opção 2: Pelo Repositório Git / GitHub
1. No campo **Git or GitHub repository** do instalador do Buzz, informe:
   ```
   https://github.com/HeltonFraga01/nexusmind-buzz-plugin
   ```
2. Mantenha o branch `main` e instale o pacote.

---

## 💻 Desenvolvimento e Compilação

Para recompilar o plugin:

```sh
pnpm install
pnpm build
```

O comando gerará o bundle compilado em `plugin.js` pronto para consumo imediato pelo Buzz.
