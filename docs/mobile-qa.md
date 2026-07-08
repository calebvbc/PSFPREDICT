# Mobile QA Checklist

Este documento define a verificação obrigatória antes de divulgar uma versão mobile. A divulgação só deve acontecer quando não houver overflow horizontal em nenhuma largura crítica e nenhuma ação principal estiver coberta por elementos fixos, modais, cards ou pelo footer.

## Larguras obrigatórias

Execute a bateria completa nas seguintes larguras de viewport:

- 320px
- 360px
- 375px
- 390px
- 430px
- 768px

## Páginas obrigatórias

Teste cada largura obrigatória nas páginas abaixo:

- `/`
- `/palpites`
- `/ranking`
- `/feed`

## Cenários obrigatórios em `/palpites`

Além da navegação padrão, valide os seguintes estados em `/palpites` para cada largura crítica:

- Formulário vazio.
- Username preenchido.
- Card aberto para palpite.
- Card bloqueado.
- Placeholder de times.
- Palpite revelado após kickoff.
- Erro inline.
- Footer fixo.

## Evidências visuais

Para cada largura crítica, registre prints antes e depois dos ajustes. Os prints devem cobrir:

- Estado inicial da página.
- Área de conteúdo principal.
- Elementos de navegação e ações principais.
- Estados obrigatórios de `/palpites` listados neste documento.

Use uma nomenclatura consistente, por exemplo:

```text
docs/mobile-qa/antes-320-home.png
docs/mobile-qa/depois-320-home.png
docs/mobile-qa/antes-320-palpites-card-aberto.png
docs/mobile-qa/depois-320-palpites-card-aberto.png
```

## Critérios de aprovação

Antes de divulgar, confirme que todos os itens abaixo foram atendidos em todas as larguras obrigatórias:

- Não existe overflow horizontal.
- Nenhuma ação principal está coberta.
- O footer fixo não bloqueia botões, campos, cards ou mensagens de erro.
- Formulários podem ser preenchidos sem perda de contexto visual.
- Cards abertos e bloqueados continuam legíveis e acionáveis quando aplicável.
- Placeholders de times não quebram layout nem causam deslocamento horizontal.
- Palpites revelados após kickoff permanecem visíveis sem sobreposição.
- Erros inline aparecem próximos ao campo/ação correspondente e não são escondidos por elementos fixos.

## Registro de execução

Preencha esta tabela a cada rodada de QA mobile.

| Largura | `/` | `/palpites` | `/ranking` | `/feed` | Prints antes/depois | Sem overflow horizontal | Ações principais livres | Aprovado |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 320px |  |  |  |  |  |  |  |  |
| 360px |  |  |  |  |  |  |  |  |
| 375px |  |  |  |  |  |  |  |  |
| 390px |  |  |  |  |  |  |  |  |
| 430px |  |  |  |  |  |  |  |  |
| 768px |  |  |  |  |  |  |  |  |

## Bloqueio de divulgação

Não divulgue a versão se qualquer item abaixo for verdadeiro:

- Qualquer página apresentar overflow horizontal em qualquer largura obrigatória.
- Qualquer ação principal estiver parcial ou totalmente coberta.
- Faltar print antes/depois em uma largura crítica.
- Qualquer cenário obrigatório de `/palpites` não tiver sido validado.
