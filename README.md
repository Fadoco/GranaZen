# GranaZen

<p align="center">
  <strong>Suas finanças mais claras, organizadas e no seu controle.</strong>
</p>

<p align="center">
  <a href="https://fadoco.github.io/GranaZen/updates/GranaZen.apk">
    <img alt="Baixar GranaZen para Android" src="https://img.shields.io/badge/BAIXAR_APK-Android-237B58?style=for-the-badge&logo=android&logoColor=white">
  </a>
  &nbsp;
  <a href="https://fadoco.github.io/GranaZen/">
    <img alt="Abrir versão web" src="https://img.shields.io/badge/ABRIR-vers%C3%A3o%20web-34483D?style=for-the-badge&logo=googlechrome&logoColor=white">
  </a>
</p>

> O APK fica disponível após a primeira publicação pelo GitHub Actions. Se o botão de download ainda não abrir um arquivo, consulte a seção [Instalar no Android](#instalar-no-android).

## Para que serve

O GranaZen é um aplicativo de finanças pessoais para registrar dinheiro que entra e sai, acompanhar contas e dívidas, planejar gastos e consultar o histórico financeiro. Foi pensado para um uso simples no celular e pode ser instalado como APK Android ou usado pelo navegador.

O aplicativo guarda os dados no próprio aparelho. Não exige conexão com banco, não pede senha bancária e não envia os lançamentos para uma conta na nuvem. O backup é feito por arquivo e pode ser transferido manualmente para outro dispositivo.

## O que você pode fazer

### Registrar e acompanhar

- Anotar gastos, salário e outras entradas com data, categoria e observações.
- Cadastrar contas, empréstimos e dívidas, definir vencimento, recorrência mensal, prioridade e progresso de parcelas.
- Informar valor da parcela e juros mensais; o controle de parcelas atualiza o saldo em aberto ao registrar cada pagamento.
- Consultar as telas **Contas**, **Dívidas**, **Movimentos**, **Calendário** e **Histórico**, com busca por nome e categoria.
- Desfazer uma exclusão logo após realizá-la.

### Planejar

- Definir orçamento mensal para categorias e acompanhar limites próximos de serem atingidos ou ultrapassados.
- Criar metas de economia com valor-alvo, prazo e valor já guardado.
- Consultar no painel a comparação com o mês anterior, os próximos vencimentos e uma estimativa de saldo.
- Escolher quais cartões de resumo aparecem no início.
- Separar lançamentos em carteiras, como conta corrente, poupança, dinheiro ou cartão.

As estimativas e saldos são calculados a partir dos dados informados no GranaZen. Não são previsões nem saldos obtidos diretamente do banco.

### Importar e proteger os dados

- Importar extratos **CSV** ou **OFX**: o app mostra uma prévia para revisão e tenta desmarcar duplicados antes de importar.
- Exportar e restaurar um backup JSON com perfil, preferências, carteiras, categorias, metas, orçamentos, contas e movimentações.
- Usar o aplicativo offline depois que a versão web tiver sido carregada e armazenada no dispositivo.
- Ocultar valores, escolher tema e cor, aumentar o tamanho de leitura e usar a navegação por teclado.

Extratos e backups são processados localmente. O arquivo de backup não é criptografado; mantenha-o em um local privado. Formatos CSV de bancos variam: a importação espera colunas de data, descrição e valor (também aceita nomes em inglês equivalentes). Revise os lançamentos antes de confirmar.

### Lembretes

O painel destaca contas vencidas e as que vencem nos próximos sete dias. Na versão Android, com permissão concedida, o app agenda notificações locais um dia antes do vencimento — ou em seguida, quando a conta vence no mesmo dia — para até 60 contas mais próximas, nos próximos 31 dias. O Android pode ajustar o horário de entrega conforme as configurações de bateria e alarmes. Na versão de navegador, os avisos aparecem somente quando o app está aberto.

## Baixar e instalar no Android

1. Toque em **Baixar APK** no início desta página ou abra [`GranaZen.apk`](https://fadoco.github.io/GranaZen/updates/GranaZen.apk).
2. No Android, abra o arquivo baixado e permita a instalação desta fonte, se o sistema solicitar.
3. Confirme a instalação. Para atualizações futuras, instale os APKs publicados pelo mesmo projeto.

O Android pode mostrar um aviso por se tratar de uma instalação fora da Play Store. Baixe o arquivo apenas deste repositório oficial. No app Android, a seção **Mais** mostra a versão instalada e permite verificar atualizações; quando uma nova versão é detectada, aparece um aviso na tela com a opção de baixar e instalar.

## Privacidade e armazenamento

- Dados financeiros, perfil e preferências ficam no armazenamento local do app.
- Não há sincronização entre aparelhos. Para trocar de dispositivo, exporte o backup, transfira o arquivo e importe-o no novo aparelho.
- O GranaZen não se conecta a instituições financeiras; a importação é feita somente a partir de arquivos escolhidos pelo usuário.
- Apagar os dados do app ou desinstalá-lo pode remover os dados locais. Exporte um backup antes de trocar ou restaurar o aparelho.

## Documentação detalhada

Para entender as funcionalidades, o visual, a arquitetura e a manutenção do projeto, consulte o [guia técnico do GranaZen](./docs/GUIA_TECNICO_GRANAZEN.md).
