# NexusMind Buzz Plugin

Plugin oficial de integração do **NexusMind** para o **Buzz Desktop**.

Conecta os agentes do Buzz (Goose, Pi, Codex, etc.) diretamente ao gateway unificado do NexusMind, permitindo gerenciar chaves de API, testar a conectividade em tempo real e sincronizar modelos com 1 clique.

---

## 🚀 Recursos

- **Configuração Simples**: Insira sua NexusMind API Key diretamente na interface do Buzz.
- **Suporte aos 4 Grupos Canônicos**:
  - **Saldo OpenAI** (Porta 4001): Modelos OpenAI, Codex, NVIDIA NIM e OpenCode.
  - **Saldo Claude** (Porta 4002): Anthropic Claude 3.5 e 3.7.
  - **Antigravity-Saldo** (Porta 4004): Google Gemini e modelos Google Antigravity.
  - **Grok** (Porta 4003): xAI Grok 2 e Grok 3.
- **Sincronização com 1 Clique**: Busca os modelos disponíveis no seu plano NexusMind e atualiza os arquivos de configuração locais dos harnesses (`~/.config/goose/custom_providers/` e `~/.buzz/.pi/models.json`).
- **Detecção de Recursos Avançados**: Identifica modelos que suportam **Thinking / Reasoning Effort** (Low, Medium, High), tags **Free** e contexto estendido.
- **Integração Nativa com a UI do Buzz**: Adiciona uma aba dedicada na barra superior/lateral e um card em **Settings → AI Models & Gateways**.

---

## 📦 Como Instalar no Buzz Desktop

Existem duas formas simples de instalar:

### Opção 1: Por Pasta Local (Recomendado para Testes Imediatos)
1. No Buzz Desktop, abra o menu lateral e vá em **Manage plugins** (ou **Configurações → Plugins**).
2. Clique no botão **Add** (canto superior direito).
3. Na janela **Add a plugin**, clique em **Browse** na área *"Drop a plugin folder here"*.
4. Selecione a pasta deste repositório:
   ```
   /Users/heltonfraga/.buzz/REPOS/nexusmind-buzz-plugin
   ```
5. Clique em **Install** e ative o plugin!

### Opção 2: Pelo Repositório Git / GitHub
1. No Buzz Desktop, clique em **Add** no gerenciador de plugins.
2. No campo **Git or GitHub repository**, cole a URL:
   ```
   https://github.com/HeltonFraga01/nexusmind-buzz-plugin
   ```
3. Deixe o branch como padrão (`main`) e clique em **Find**.
4. Clique em **Install** e habilite o plugin na lista.

---

## 🛠️ Como Utilizar

1. Abra a página **NexusMind Gateway** na barra de navegação do Buzz (ou acesse via Configurações).
2. Insira sua **NexusMind API Key** (e opcionalmente sua Admin Key).
3. Clique em **Salvar Chaves** e depois em **Testar Conexão** para validar a autenticação com a API.
4. Clique em **⚡ Sincronizar Modelos no Buzz**.
5. Seus agentes agora têm acesso instantâneo a todos os modelos ativos do seu plano!

---

## 📂 Estrutura do Repositório

```
nexusmind-buzz-plugin/
├── manifest.json         # Manifesto com metadados e permissões declaradas do Buzz
├── plugin.js             # Módulo pré-compilado de execução no Buzz
├── buzz-listing.yaml     # Metadados opcionais para o catálogo comunitário
├── src/
│   └── index.tsx         # Código-fonte React / TypeScript
├── vendor/               # Tipos @buzz/author
├── package.json          # Dependências de desenvolvimento e scripts
└── vite.config.ts        # Configuração de build Vite
```

---

## 💻 Desenvolvimento e Compilação

Para recompilar o plugin após alterar o código em `src/index.tsx`:

```sh
pnpm install
pnpm build
```

O comando gerará o arquivo `plugin.js` pronto para execução pelo Buzz.
