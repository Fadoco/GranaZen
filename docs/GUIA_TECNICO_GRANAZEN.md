# GranaZen — guia funcional, visual e técnico

> Documento de referência para pessoas e agentes de IA que precisem entender, manter ou ampliar o GranaZen. Descreve o comportamento encontrado no código, não uma especificação de funcionalidades futuras.

## 1. Identificação e estado do projeto

- **Nome:** GranaZen.
- **Objetivo:** controle pessoal, local e manual de receitas, gastos, contas, dívidas, orçamento e metas.
- **Idioma e região:** interface em português do Brasil; valores em BRL; datas apresentadas em formato brasileiro.
- **Plataformas:** aplicação web/PWA estática e aplicativo Android empacotado com Capacitor.
- **Repositório:** `Fadoco/GranaZen`.
- **Site:** <https://fadoco.github.io/GranaZen/>.
- **Download Android:** <https://fadoco.github.io/GranaZen/updates/GranaZen.apk>.
- **Manifesto Android:** <https://fadoco.github.io/GranaZen/updates/version.json>.
- **Estado da publicação verificado em 2026-11-07:** versão Android `1.0.1`, `versionCode` 2. A compilação, assinatura, validação do APK e deploy no GitHub Pages terminaram com sucesso. O wrapper foi fixado em Gradle 8.13 para ser compatível com Android Gradle Plugin 8.13.0.
- **Versão publicada versus código:** o APK publicado pode não incluir as alterações mais recentes da branch `main`. Consulte o manifesto Android acima para identificar a versão distribuída; a existência de uma mudança no código não significa que ela já foi compilada e instalada nos aparelhos.

## 2. Princípios de produto

1. Os dados financeiros pertencem ao usuário e ficam no armazenamento local do dispositivo/navegador.
2. O app não autentica em banco, não recebe credenciais bancárias e não sincroniza dados financeiros com servidor.
3. Extratos são arquivos escolhidos pelo usuário; backups são arquivos JSON escolhidos pelo usuário.
4. Os valores e projeções são resultados dos lançamentos que o usuário registrou. Não são saldos bancários oficiais, previsões financeiras, aconselhamento ou integração com instituição financeira.
5. O app prioriza uso móvel, navegação direta e registro rápido. A navegação desktop é uma faixa horizontal, não uma barra lateral.
6. Android e Web compartilham a aplicação React; capacidades nativas específicas são acessadas por plugins Capacitor.

## 3. Mapa funcional e navegação

A aplicação possui sete seções (`Section` em `src/App.tsx`):

| Seção | Conteúdo principal |
|---|---|
| **Início** (`inicio`) | Resumo do mês, saldo de ganhos menos gastos, cartões de totais, vencimentos, gráfico, comparação mensal, projeção, orçamento, metas e atividade recente. Os blocos podem ser personalizados. |
| **Movimentos** (`movimentos`) | Registro, edição, busca e exclusão de gastos, salários recebidos e receitas extras. Separação em abas Gastos/Ganhos. |
| **Contas** (`contas`) | Compromissos cadastrados como dívidas/contas, com vencimento, estado, pagamento, edição e exclusão. Exibe itens pendentes e os pagos no mês atual. |
| **Dívidas** (`dividas`) | Lista de dívidas e empréstimos; filtros Em aberto/Pagas/Todas, prioridade, parcelas, juros, recorrência, pesquisa e ações. |
| **Calendário** (`calendario`) | Calendário mensal e lançamentos do dia selecionado, juntando movimentos e datas de vencimento/pagamento de dívidas. |
| **Histórico** (`historico`) | Linha do tempo de movimentos e dívidas marcadas como pagas, filtros por tipo, pesquisa e exclusão individual. |
| **Mais** (`mais`) | Perfil, aparência, acessibilidade, carteiras, categorias, orçamento, metas, composição do Início, importação de extratos, atualização Android, lembretes e backup. |

O cabeçalho contém a marca GranaZen, atalho de sino para Contas e avatar para Mais/perfil. A seção ativa aparece no título da página e na navegação; não existe menu lateral.

## 4. Funcionalidades em detalhe

### 4.1 Painel Início e cálculos

- O período dos cartões é o mês civil atual, calculado pela data local do dispositivo.
- **Ganhos do mês:** soma dos movimentos cujo tipo é `salary` ou `extra` e cuja data começa com `YYYY-MM`.
- **Gastos do mês:** soma dos movimentos `expense` do mês.
- **Saldo após gastos no mês:** ganhos do mês menos gastos do mês. Não é o saldo agregado das carteiras e não inclui automaticamente todas as dívidas.
- **Dívidas em aberto:** soma de `remainingBalance` (ou `amount` quando não houver saldo restante) para dívidas ainda não pagas.
- O gráfico de barras compara ganhos do mês, gastos do mês e saldo de dívidas em aberto; seu máximo visual é a maior dessas quantias, com piso de 1.
- A comparação mostra ganhos e gastos do mês atual e do mês civil anterior.
- **Saldo estimado após contas:** ganhos menos gastos do mês, menos `amount` de dívidas pendentes com vencimento até o último dia do mês. É uma estimativa simplificada: não representa saldo bancário e não usa o saldo de parcela em aberto nesse cálculo.
- Atividade recente mostra até quatro movimentos do mês, ordenados da data mais recente para a mais antiga.
- Cartões opcionais disponíveis: saldo, ganhos, gastos, dívidas, lembretes, gráfico, comparação/projeção, orçamentos, metas e atividade.
- Mensagem de contexto deixa claro que os números são calculados dos dados guardados no aparelho.

### 4.2 Movimentos: gastos e receitas

Um movimento tem:

```text
id, kind, category, name, amount, date, notes, walletId?, createdAt
```

- `kind`: `expense`, `salary` ou `extra`.
- Valor deve ser finito e maior que zero; o tipo determina se entra ou sai. A interface exibe gastos com sinal negativo e receitas com sinal positivo.
- A data do próprio movimento determina em qual mês ele entra, mesmo que seja editado/importado depois.
- Categorias padrão de despesa: Mercado, Comida, Jogos, Compras online, Transporte, Saúde, Lazer, Casa, Educação e Outros.
- Categorias de entrada: Salário e Renda extra.
- Categorias personalizadas de gasto são etiquetas locais adicionais, até 50 itens e 40 caracteres por item.
- O salário é registrado como um lançamento por mês/recebimento; não há geração automática de salário recorrente.
- Renda extra é destinada a entradas como freelance, venda e outros valores fora do salário.
- Gastos rápidos são o caminho de lançamento para compras cotidianas. Um lançamento pode ter descrição, categoria, valor, data, observação opcional e carteira.
- É possível editar e excluir movimentos. Exclusões podem ser desfeitas por oito segundos.
- Valores ocultos também se aplicam a listas, cartões e resumos que usam `displayCurrency`.

### 4.3 Contas, dívidas, parcelas e recorrência

Modelo `Debt` (`src/financeTypes.ts`):

```text
id, category, name, amount, dueDate, notes, isPaid, paidAt,
isRecurring, recurrenceGroupId, installmentAmount?, installmentsTotal?,
installmentsPaid?, interestRateMonthly?, priority?, remainingBalance?, createdAt
```

- Categoria padrão funciona como etiqueta: Cartão de crédito, Boleto, Aluguel, Empréstimo, Mercado, Água, Energia, Internet, Telefone, Financiamento, Imposto, Assinatura ou Outra.
- `name` é a identificação livre do usuário, por exemplo “Cartão Nubank”; categoria e identificação são campos diferentes.
- Cadastro exige nome, valor positivo e data de vencimento válida. Juros, parcelas, quantidade já paga, prioridade e observação têm validações próprias.
- Prioridade é Alta, Normal ou Baixa; a lista ordena primeiro por prioridade e depois por vencimento.
- `amount` representa o valor inicial/total informado; `remainingBalance` mantém saldo para a lista de dívidas e é inicializado com `amount`.
- A ação de marcar uma dívida simples como paga registra `isPaid` e `paidAt`; desmarcar volta para pendente. Ela não cria, por padrão, um movimento de despesa separado.
- Dívidas pagas aparecem no Histórico como entradas `debt`, com categoria “Dívida paga · [categoria]” e data `paidAt` (ou vencimento como fallback). O total de dívidas pagas soma o `amount` original das dívidas pagas.
- Excluir dívida remove a entrada original. Quando feita no Histórico, o rótulo da ação explicita a remoção do histórico. Há opção de desfazer por oito segundos.
- Uma conta recorrente é um grupo de ocorrências mensais: ao pagar uma conta sem parcelas, mantém-se a ocorrência paga e é criada a próxima ocorrência pendente, com mesmo `recurrenceGroupId`, até a data seguinte. O avanço preserva o dia quando possível e limita para o último dia do mês (31 de janeiro → 28/29 de fevereiro). Dívidas recorrentes vencidas avançam a partir do mês atual.
- Para recorrência simples, o app evita criar uma duplicata do próximo mês se já existir uma ocorrência pendente posterior do mesmo grupo.
- Para dívidas parceladas, cada ação de pagar registra uma parcela como movimento de despesa `Outros`, associa-a à primeira carteira e incrementa `installmentsPaid`. Juros mensais são calculados sobre o saldo anterior: `saldo × taxa/100`; o pagamento normal é o valor de parcela explícito ou `amount / installmentsTotal`. Na última parcela, o pagamento é o saldo após juros. A dívida é concluída quando o saldo chega a zero; senão, o vencimento avança um mês.
- Desmarcar uma dívida parcelada paga reinicia `installmentsPaid` para zero, restaura `remainingBalance` ao `amount` e remove o estado pago. Lançamentos de parcela já criados são movimentos separados; considere esse vínculo ao alterar esse fluxo.
- A seção Contas lista compromissos não pagos e dívidas pagas no mês corrente; mostra estado Pago, Atrasada ou Pendente, data, recorrência, valor e ações.
- A seção Dívidas lista e filtra todos os estados. A mesma dívida pode ser acessada em mais de uma seção; os dados são os mesmos.

### 4.4 Calendário

- Mês e dia selecionado são estado de interface; o mês pode retroceder/avançar e o botão Hoje retorna à data local atual.
- A semana começa na segunda-feira.
- Para dívida pendente, o marcador usa `dueDate`; para dívida paga, usa `paidAt` com fallback para `dueDate`.
- Movimentos usam a data do lançamento.
- O painel de detalhe do dia distingue conta a pagar, conta paga, gasto e recebimento.
- O calendário apresenta marcadores compactos; no detalhe são listados os itens daquele dia.

### 4.5 Histórico financeiro

- O histórico é uma projeção derivada, não uma tabela/coleção independente persistida.
- Inclui todos os movimentos e todas as dívidas pagas. Dívidas pendentes não aparecem nessa linha do tempo, mas podem ser vistas em Contas/Dívidas.
- Filtros: Tudo, Gastos, Ganhos e Dívidas pagas.
- Busca ignora maiúsculas/minúsculas e acentos; pesquisa o nome e a categoria.
- Exclusão de movimento ou dívida no Histórico altera a coleção correspondente e portanto também os totais/listas que dela derivam. Exclusão é individual e temporariamente reversível.
- Totais apresentados: ganhos históricos, gastos históricos e soma dos valores originais das dívidas pagas.

### 4.6 Perfil e personalização

- Perfil: nome (até 50 caracteres), e-mail opcional válido (até 100), telefone opcional (até 24) e foto.
- Foto aceita arquivo de imagem até 10 MB na entrada; é redimensionada até 512 px no maior lado, convertida para JPEG com qualidade 0,82 e limitada a 1 MB em Data URL. Fica no perfil local.
- Avatar mostra a foto ou iniciais do nome.
- Tema: Sistema, Claro ou Escuro. Sistema acompanha `prefers-color-scheme` do dispositivo/navegador.
- Cores de destaque: Verde (`forest`), Azul (`ocean`) ou Roxo (`plum`).
- Tamanho do texto: Padrão ou Maior.
- “Ocultar valores” troca os valores exibidos por pontos; não criptografa nem remove números do armazenamento.
- Carteiras: conta corrente, poupança, dinheiro, cartão e outra. Padrão é “Carteira principal”, tipo conta corrente, saldo inicial zero. Até 30 carteiras, nomes únicos sem diferenciar caixa e até 40 caracteres.
- Saldo de carteira = saldo inicial + entradas vinculadas − gastos vinculados, usando movimentos de qualquer data. Movimento antigo sem `walletId` é atribuído visualmente à primeira carteira. Excluir carteira com movimentos associados é bloqueado.
- Categorias personalizadas antigas continuam legíveis nos registros mesmo se a categoria for removida.
- Orçamentos: um limite por categoria e mês (`YYYY-MM`). Gasto considera movimentos `expense` daquela categoria no mês; aviso visual a partir de 80%, e limite atingido/ultrapassado a partir de 100%. Ao definir outra vez o mesmo par categoria/mês, substitui o limite existente.
- Metas: nome, valor-alvo, valor guardado e prazo opcional. O usuário atualiza manualmente o valor guardado; barra mostra percentual limitado visualmente a 100%. Até 100 metas no validador de backup.

### 4.7 Importação de extratos CSV/OFX

Implementação em `src/statementImport.ts`; seleção, revisão e inclusão em `src/App.tsx`.

- Arquivos suportados: `.csv`, `.txt` (conteúdo CSV) e `.ofx`; conteúdo limitado a 10 MB e 1.000 lançamentos por importação.
- CSV: autodetecta entre `;`, `,` e tab pelo cabeçalho; parser lida com campos entre aspas, delimitador dentro de aspas e aspas escapadas por duplicação.
- Cabeçalhos normalizados ignoram acentos e caixa. Data aceita `data`, `date` ou `dtposted`; descrição aceita `descricao`, `description`, `historico`, `memo`, `name`, `nome`; valor aceita `valor`, `amount`, `value`, `trnamt`; tipo opcional aceita `tipo` ou `type`.
- Datas do CSV precisam estar no formato ISO `YYYY-MM-DD` e ser datas reais; não se presume conversão automática de `DD/MM/YYYY`.
- Valores brasileiros como `2.500,00`, símbolo R$ e espaços são aceitos; valor zero/inválido é rejeitado. Sem cabeçalho Tipo, valor positivo vira receita e negativo vira gasto. Com Tipo, palavras como crédito/receita/income/deposito indicam entrada.
- OFX: lê os blocos `<STMTTRN>`, data em `DTPOSTED`, valor em `TRNAMT`, nome em `NAME` ou fallback `MEMO`. Valor positivo é entrada e negativo é gasto.
- Descrição é limitada a 100 caracteres. Categorias de importação são “Outros” e “Renda extra”; observação é “Importado de extrato”.
- Prévia exibe os itens e permite escolher quais importar. Duplicados com mesma data, valor absoluto e descrição normalizada são inicialmente desmarcados; duplicação de nome ignora acentos e caixa. Isso é uma heurística, não conciliação bancária.
- Itens importados são associados à primeira carteira disponível. Nenhuma credencial bancária é solicitada nem arquivo enviado para serviço remoto.

### 4.8 Backup, exportação e restauração

Implementação de serialização/validação no `src/App.tsx`; abstração de arquivo em `src/backupFiles.ts`; seleção/salvamento Android em `BackupFilesPlugin.java`.

- Exporta JSON `granazen-backup-YYYY-MM-DD.json` contendo `app`, `schemaVersion`, `exportedAt`, `preferences`, `profile`, `extras`, `debts`, `movements`.
- Versão atual do esquema: 3. Importador aceita versões 1, 2 e 3. Para schema 1 usa perfil padrão; para versões anteriores a 3 usa `defaultExtras`.
- Tamanho máximo de importação: 20 MB.
- Antes da restauração, valida forma, campos, datas, limites e totais; apresenta confirmação com data do backup, quantidade de dívidas/movimentos e totais de ganhos/gastos. A restauração substitui, não mescla, os dados atuais.
- Escritas no localStorage são agrupadas com tentativa de rollback aos valores anteriores se uma gravação falhar. Se rollback também falhar, um erro específico avisa para fechar/reabrir e conferir os dados.
- No Android, o plugin utiliza o seletor de documento do sistema para criar ou escolher arquivos JSON. Na Web, exportação cria um Blob e inicia download; importação usa seletor de arquivo HTML.
- Cancelar a escolha/salvamento não deve ser interpretado como erro de conteúdo.
- O arquivo não é criptografado. O usuário deve armazená-lo em local privado; o backup inclui foto de perfil, perfil e dados financeiros.

### 4.9 Lembretes de vencimento

- A interface calcula contas pendentes vencidas e as que vencem até sete dias, destaca o número no sino/nav e exibe até três no painel.
- **Android:** `@capacitor/local-notifications`. Consulta/solicita permissão; ao conceder, remove lembretes antigos do intervalo reservado e reagenda até 60 contas pendentes nos próximos 31 dias. Agenda para 9h do dia anterior; se o horário já passou, agenda para aproximadamente um minuto depois. IDs derivam do ID da dívida. Notificação é local, sem serviço push.
- Alterações nas dívidas e carga inicial disparam reagendamento. Erros são registrados e apresentados.
- **Web:** se `Notification` existir e a permissão já estiver concedida, mostra um aviso quando o app calcula contas vencidas/próximas. Não agenda notificações futuras com o app fechado. O navegador pode não suportar notificações.
- A instalação pode depender das permissões/configurações de notificações e bateria do Android.

### 4.10 Atualização do aplicativo Android

- O código Web verifica apenas quando `Capacitor.getPlatform()` é `android`; não mostra o painel Android no navegador.
- A versão local é obtida pelo plugin nativo `AppUpdate.getAppVersion()`.
- Busca o manifesto HTTPS `https://fadoco.github.io/GranaZen/updates/version.json` com cache-busting e `cache: no-store`; após a primeira consulta na abertura, verificações automáticas respeitam janela de seis horas e ocorrem também quando o app volta a ficar visível.
- Valida `version`, `versionCode`, SHA-256 de 64 hexadecimais e URL fixa do APK do projeto com `?v=<versionCode>`. Se a versão remota não for mais nova, não oferece atualização.
- APK é baixado para cache interno do app; Java valida host de destino após redirects, tamanho máximo 100 MB, calcula SHA-256 e recusa arquivo cujo hash não corresponde ao manifesto.
- Instalação usa `FileProvider` e o instalador do Android. Android 8+ pode exigir que o usuário permita instalação de fontes desconhecidas para o GranaZen.
- O prompt automático usa `role="alertdialog"` e oferece atualização ou “Decidir depois”; a seção Mais do código local pode mostrar versão instalada, estado, erros e verificação manual.
- Integridade SHA-256 detecta corrupção/mismatch; a compatibilidade/autenticidade de atualização também depende da assinatura Android permanente. Não trocar o keystore de release.

## 5. Modelo de estado e armazenamento

O componente principal é `src/App.tsx`. Domínio, validações, estados de interface, cálculos e composição de telas ficam concentrados nele; os módulos auxiliares isolam datas, arquivos, importação, notificações e atualização Android.

| Chave localStorage | Conteúdo |
|---|---|
| `granazen-preferences` | Tema, tamanho de texto, ocultar valores, cor de destaque. |
| `granazen-profile` | Nome, e-mail, telefone, foto JPEG em Data URL. |
| `granazen-debts` | Lista de contas/dívidas e estado de pagamento. |
| `granazen-movements` | Gastos, salários, receitas extras e associação com carteira. |
| `granazen-extras` | Categorias personalizadas, carteiras, metas, orçamentos e cartões do painel. |

- Os quatro grupos financeiros/preferências são lidos no início, parseados e validados, e gravados em efeitos separados quando carregados.
- Em falha de JSON, validação ou quota, registra-se `console.error` e apresenta-se erro; as coleções financeiras não devem ser sobrescritas silenciosamente com dados vazios quando o carregamento falha.
- O armazenamento WebView da instalação Android é separado do navegador e de outros aparelhos. Limpar dados/desinstalar pode apagar os dados locais.
- Não existe conta de usuário, API financeira, banco remoto ou mecanismo de sincronização.
- O arquivo JSON é a forma explícita de transferência entre aparelhos.

## 6. Identidade visual e UX

### 6.1 Direção de arte

- Aparência de app financeiro móvel, limpa e profissional, inspirada em painel de produto: cartões de resumo, superfícies claras, texto compacto, títulos Manrope e texto DM Sans.
- Paleta-base clara: fundo cinza-esverdeado muito claro (`#f5f7f2`), superfície branca, texto verde/carvão (`#202a25`), linhas discretas (`#edf0ea`) e verde de marca/destaque (`#287c58`).
- Cartão de saldo com gradiente verde escuro; ganhos usam verde; gastos usam âmbar; dívidas/metas usam roxo; vencimentos atrasados recebem alerta avermelhado.
- Temas aplicados por classes `.theme-light`/`.theme-dark`; cor de destaque por `.accent-forest`, `.accent-ocean`, `.accent-plum`.
- Modo escuro usa fundo próximo a `#101512`/`#111915`, superfícies `#191f1b`/`#1b2620`, textos claros e bordas verde-cinza. Existem overrides por componente para legibilidade.
- Ícones Lucide via `lucide-react`; barras/progresso e marcadores usam CSS e elementos nativos, sem biblioteca externa de gráficos.
- Sombras pequenas, cantos arredondados, linhas finas, hierarquia por cor/espacamento, `eyebrow` em caixa alta para contexto e títulos de seção em Manrope.
- CSS importa DM Sans e Manrope do Google Fonts; sem rede/cache o fallback sans-serif continua disponível, mas as fontes externas podem não carregar.

### 6.2 Navegação e breakpoints

- Topbar com marca, sino e avatar.
- Desktop/tablet largo: menu em faixa horizontal de abas, com overflow rolável se necessário; item ativo recebe cor e sublinhado.
- Largura até 700 px: faixa desktop some; navegação fixa inferior com sete destinos, ícone + rótulo, fundo translúcido e preenchimento de safe area do aparelho.
- Página central limitada a aproximadamente 1280 px em telas largas; espaçamentos e cartões mudam em 700 px e em telas muito largas (1500 px).
- No celular: página usa padding reduzido, painéis em coluna, calendário vira coluna única, formulários em duas colunas onde cabem e navegação inclui `env(safe-area-inset-bottom)`.
- Formulários de dívida e movimento são diálogos modais com backdrop; clique no fundo fecha o formulário. O prompt de atualização é alerta modal próprio.
- Listagens têm estados vazios com instrução e CTA contextual.

### 6.3 Acessibilidade e feedback

- Navegação usa `aria-label`, `aria-current="page"`, filtros com `aria-pressed`, formulários com `<label>`, campos agrupados com `<fieldset>/<legend>` e dialogs rotulados.
- Avisos e erros são apresentados em regiões `role="alert"` ou `role="status"`; prompts e diálogos são identificados por título/descrição.
- Foco de teclado visível em botões, links, inputs, selects e textareas; CSS respeita `prefers-reduced-motion`.
- Valores podem ser ocultados; isso é apenas mascaramento visual.
- Botões de ícone recebem `aria-label`/`title`; calendários expõem data e seleção.
- Mensagens de erro devem permanecer visíveis e não ser convertidas em estados de sucesso silenciosos.

## 7. Arquitetura técnica e arquivos

### Aplicação Web/React

| Arquivo | Responsabilidade |
|---|---|
| `src/main.tsx` | Monta React em `#root`, importa CSS, registra o service worker em produção. |
| `src/App.tsx` | Modelo UI e estado principal, validação/restauração, efeitos de persistência, cálculos financeiros, handlers e render das sete seções. |
| `src/styles.css` | Identidade visual, layouts, responsividade, temas, acessibilidade e diálogos. |
| `src/financeTypes.ts` | Tipo `Debt`, compartilhado com lembretes. Outros modelos funcionais estão definidos localmente no App. |
| `src/financeUtils.ts` | Validação de datas ISO, busca sem acentos/caixa, avanço mensal de vencimento. |
| `src/statementImport.ts` | Parser CSV/OFX e validação/conversão para lançamentos. |
| `src/backupFiles.ts` | Adaptador de seleção/salvamento por Capacitor no Android e Blob no browser. |
| `src/localReminders.ts` | Permissão, ID de notificação, cancelamento e agendamento Android. |
| `src/androidUpdate.ts` | Validação do manifesto, comparação de versão e chamada ao plugin nativo de update. |
| `public/sw.js` | Cache do shell/JS/CSS para uso offline, escopado pelo registration scope. |
| `public/manifest.webmanifest` | Metadados PWA, start URL, scope, standalone e ícone. |
| `public/granazen.svg` | Ícone web/PWA. |

### Android/Capacitor

| Arquivo | Responsabilidade |
|---|---|
| `capacitor.config.ts` | App id `com.fadoco.granazen`, nome GranaZen, webDir `dist`, projeto Android em `apk`. |
| `apk/app/build.gradle` | Aplicativo Android, pacote/versão, signing config carregada de arquivo local ignorado pelo Git, dependências. |
| `apk/build.gradle` | Android Gradle Plugin 8.13.0; Google Services 4.4.4. |
| `apk/gradle/wrapper/gradle-wrapper.properties` | Wrapper Gradle 8.13 (não atualizar sem verificar compatibilidade com AGP/Capacitor). |
| `apk/variables.gradle` | minSdk 24, compileSdk 36, targetSdk 36 e versões AndroidX. |
| `apk/app/src/main/java/.../MainActivity.java` | Registra `AppUpdatePlugin` e `BackupFilesPlugin` na BridgeActivity. |
| `.../AppUpdatePlugin.java` | Versão, download do APK, validação de host/tamanho/SHA-256, abertura do instalador. |
| `.../BackupFilesPlugin.java` | SAF do Android para salvar/selecionar JSON, limite 20 MB. |
| `apk/app/src/main/AndroidManifest.xml` | Launcher, FileProvider, INTERNET e REQUEST_INSTALL_PACKAGES. |
| `apk/app/src/main/res/xml/file_paths.xml` | Caminhos internos autorizados ao FileProvider. |

Capacitor Android 8.x, React 19, TypeScript 6, Vite 8, plugin de notificações locais 8.x, ícones Lucide. Projeto define Node.js `>=22.18.0`; workflow usa Node 22 e Java 21.

## 8. Web offline e instalação PWA

- `main.tsx` registra `public/sw.js` somente em `import.meta.env.PROD`, usando `BASE_URL` como escopo.
- O worker baixa a tela inicial, assets JS/CSS referenciados, webmanifest e ícone no `install`.
- Cache nomeado `granazen-shell-v1`; ao ativar remove versões anteriores com prefixo `granazen-shell-` e assume controle dos clientes.
- Navegação tenta rede e atualiza o cache; se falhar, usa o HTML guardado.
- Assets em `/assets/` usam cache-first para resposta imediata e atualização em rede assíncrona.
- Worker só intercepta GET da mesma origem dentro do escopo. Não é sincronização nem backup de dados e não deve cachear/reter arquivo financeiro em servidor.

## 9. Compilar, rodar e testar

Requisitos: Node.js 22.18+, npm; Android Studio/JDK/SDK para builds locais Android. Dependências instaladas com `npm ci` no workflow.

```powershell
npm install
npm run dev
npm run build
npm run test:finance
npm run test:release-version
npm run build:android
```

- `npm run build`: `tsc -b` e build Vite para `dist`.
- `npm run build:pages`: TypeScript + Vite com base `/GranaZen/`, saída `docs`.
- `npm run build:android`: build web, `npx cap sync android`, `apk/gradlew.bat assembleDebug`; saída debug em `apk/app/build/outputs/apk/debug/app-debug.apk`.
- `npm run build:android:release`: comando de release local, requer assinatura configurada.
- `npm run test:finance`: testes de data, pesquisa, recorrência e parser de extrato.
- `npm run test:release-version`: testes das regras de versão e preparação de release.
- Node 18 instalado como padrão em alguns ambientes não atende o `engines`; use a instalação Node 22.18+.
- A compilação local Android requer `JAVA_HOME`; no ambiente usado para a correção, o JDK 25/JRE 8 não era um substituto verificado. O runner de publicação usa Temurin Java 21.

## 10. Versionamento, validação e publicação

### Workflow

`.github/workflows/publish-pages.yml` publica no `push` para `main` em paths selecionados (workflow, APK, Capacitor, fontes, scripts, manifests e README) ou manualmente via `workflow_dispatch`.

Fluxo:

1. Checkout completo, configurar Node 22, `npm ci` e testes das ferramentas de versão.
2. Copiar para área temporária o APK e manifesto já publicados, quando existem.
3. Preparar próximo `versionName` e `versionCode` no `apk/app/build.gradle` da execução; primeira release usa a versão inicial do Gradle.
4. Validar que as versões candidatas sobem tanto semântica (`X.Y.Z`) quanto `versionCode`.
5. Gerar site estático em `docs`; preservar no site o APK anterior como baseline enquanto o novo APK é compilado.
6. Configurar Java 21 e Android SDK (platform-tools, build-tools 36.0.0, Android 36).
7. Se os quatro secrets de assinatura estão disponíveis, decodificar keystore temporário, construir `assembleRelease`, validar identidade/assinatura/versionamento/hash e preparar `docs/updates/GranaZen.apk` e `version.json`.
8. Commit automático do baseline ao `main` como `Publish Android update`; arquivo `.jks` e `.properties` temporários são removidos por trap.
9. Upload do diretório `docs` como artefato Pages e deploy com `actions/deploy-pages`.

### Validação do APK

`scripts/publish-android-update.mjs` exige SDK, `aapt`, `apksigner`; rejeita candidato vazio ou >100 MB, pacote diferente de `com.fadoco.granazen`, versões inválidas, assinatura não verificável, assinatura diferente da versão publicada, versionCode/versionName não crescentes e divergência entre APK anterior e manifesto (incluindo SHA-256). Depois grava o APK e manifesto com URL versionada.

`scripts/check-android-release-version.mjs` valida que a versão do Gradle é superior ao manifesto atual. `scripts/prepare-android-release.mjs` incrementa patch e versionCode com base no manifesto publicado, para evitar depender de commit manual da versão gerada durante a execução.

### Segredos e chave

O workflow espera **Repository Actions secrets**, não secrets de Environment, com nomes exatos:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

O keystore é o segredo de longo prazo da identidade Android. Deve existir backup seguro offline; nunca commitar `.jks`, senha ou propriedades. `.gitignore` exclui `apk/release-signing.jks` e `apk/release-signing.properties`. A mesma assinatura deve ser preservada para que o Android aceite instalar versões futuras por cima da instalação atual.

### Interpretação de falhas de publicação

- Uma execução verde pode publicar o site sem publicar APK, se secrets estiverem ausentes: as etapas Android são puladas e o workflow emite warning. Verificar os steps individuais e os endpoints, não só a cor geral.
- Após deploy, conferir:
  - `https://fadoco.github.io/GranaZen/`
  - `https://fadoco.github.io/GranaZen/updates/version.json`
  - `https://fadoco.github.io/GranaZen/updates/GranaZen.apk`
- Configuração GitHub Pages deve ser **Settings → Pages → Build and deployment → Source: GitHub Actions**. Se estiver em `main / root`, o site serve o HTML fonte do repositório, e URLs do APK dão 404 mesmo que o APK esteja no artefato Pages.
- O deploy Pages bem-sucedido não prova que o site está servindo o artefato esperado; conferir conteúdo HTTP/manifesto e status 200.
- Paths do gatilho são explícitos; adicionar documentação em nova pasta não necessariamente dispara workflow. Mudança no README dispara atualmente.
- Em falha do Android, olhar primeiro o step que falhou (AGP/Gradle/JDK, secrets, SDK, signing ou validação de APK), corrigir causa e então executar novo workflow.

## 11. Testes disponíveis

- `scripts/finance-utils.test.mjs`: datas válidas/inválidas, leap day, busca sem acentos/caixa e progressão mensal em mês curto/virada de ano.
- `scripts/statement-import.test.mjs`: CSV com delimitador/aspas/decimais, OFX, colunas/datas inválidas, extensão, aspas sem fechamento e limite de tamanho.
- `scripts/check-android-release-version.test.mjs`: parser Gradle, aceitação e rejeição de versão não crescente.
- `scripts/prepare-android-release.test.mjs`: primeira versão, incremento de patch/versionCode e validação de entrada.
- Não há suíte automatizada de componentes UI ou testes end-to-end identificados. Mudanças em fluxos de UI devem ser validadas com build e verificação manual dirigida.

## 12. Convenções e recomendações para a próxima IA

1. Leia este guia junto com o código atual; o código é a fonte de verdade. Se o guia divergir, confirme comportamento e atualize a documentação.
2. Antes de editar, confira `git status` e preserve alterações locais não relacionadas.
3. Evite ampliar `App.tsx` sem investigar padrão existente; o estado atual mantém boa parte das telas e domínio nesse componente. Não introduza backend/sincronização/banco sem pedido explícito.
4. Toda alteração de persistência precisa considerar leitura, validação, `localStorage`, backup e compatibilidade de schema. Se adicionar campo persistido, planeje defaults/migração e teste importação de backups antigos.
5. Para lançamentos, mantenha coerentes tipo, sinal, categoria, data, carteira, totais, histórico, calendário, orçamento, atividade, backup e importação.
6. Ao mudar cálculo financeiro, documente as premissas (datas, parcelas, juros, recorrência) e teste casos de borda de fim de mês/ano, datas passadas, saldo zero e atualização de histórico.
7. Não trate projeções como informação bancária real. Diferencie `amount`, `remainingBalance`, saldo da carteira e saldo mensal.
8. Mantenha manifestos e links do Pages com base `/GranaZen/`, `versionCode` e query versionada alinhados. Teste o APK e manifesto publicados, não apenas o build local.
9. Nunca gere nova chave de assinatura para uma atualização existente nem peça para o usuário enviar keystore/senhas no chat. Reutilize secrets locais do GitHub sem expor valores.
10. Não deixe erros de parse, armazenamento, permissão, hash ou publicação parecerem sucesso. Mostre mensagens úteis e registre falhas sem incluir dados pessoais ou segredos.
11. Preserve acessibilidade (labels, foco, status/alertas, tamanho do alvo móvel) e teste claro/escuro, mobile/desktop e reduced motion.
12. Ao concluir mudanças, rode o menor conjunto aplicável, normalmente build + `test:finance`; mudanças de release incluem `test:release-version` e verificação dos endpoints Pages.

## 13. Glossário de domínio

- **Movimento:** entrada ou saída financeira pontual (gasto, salário ou renda extra).
- **Dívida/conta:** compromisso com categoria de etiqueta, identificação, valor e vencimento; tem pagamento, recorrência ou plano de parcelas.
- **Carteira:** agrupador local de movimentos com saldo inicial e saldo calculado.
- **Orçamento:** limite de gasto de uma categoria para um mês específico.
- **Meta:** alvo de economia com valor salvo atualizado manualmente.
- **Histórico:** combinação calculada de movimentos e dívidas pagas; não é uma coleção independente.
- **`versionName`:** versão visível Android, formato `X.Y.Z`.
- **`versionCode`:** inteiro Android monotonicamente crescente, usado pelo instalador para ordenar releases.
- **Manifesto Android:** `version.json` hospedado junto ao APK; identifica versão, URL, hash e notas.
