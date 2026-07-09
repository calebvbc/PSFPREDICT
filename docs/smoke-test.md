# Checklist de smoke test

Use este checklist antes de divulgar uma nova versão do PSF Predict. Execute todos os passos em **desktop** e em **celular** para validar responsividade, navegação e integrações básicas.

## Ambientes obrigatórios

- Desktop: navegador atualizado (Chrome, Firefox, Edge ou Safari).
- Celular: navegador atualizado em iOS ou Android.
- URL de produção: <https://app.psfes.space>.

## Checklist manual

Para cada item, marque o resultado em desktop e celular.

| # | Teste | Desktop | Celular | Resultado esperado |
|---|---|---|---|---|
| 1 | Abrir <https://app.psfes.space>. | ☐ | ☐ | A aplicação abre sem tela em branco, erro de JavaScript visível ou falha de carregamento. |
| 2 | Abrir `/palpites`. | ☐ | ☐ | A página de palpites carrega e exibe os jogos disponíveis. |
| 3 | Abrir `/ranking`. | ☐ | ☐ | O ranking carrega sem erro e mostra a lista, estado vazio ou mensagem adequada. |
| 4 | Abrir `/feed`. | ☐ | ☐ | O feed carrega sem quebrar, inclusive quando não houver itens. |
| 5 | Chamar `/api/health`. | ☐ | ☐ | A API responde com sucesso e indica que o serviço está saudável. |
| 6 | Chamar `/api/matches`. | ☐ | ☐ | A API responde com sucesso e retorna a lista de partidas ou um array vazio válido. |
| 7 | Salvar um palpite usando um username novo. | ☐ | ☐ | O palpite é salvo com confirmação visual e sem erro no console/rede. |
| 8 | Buscar o mesmo username usado no passo anterior. | ☐ | ☐ | Os dados do usuário são encontrados e o formulário aparece pré-preenchido com o palpite salvo. |
| 9 | Tentar informar um placar inválido. | ☐ | ☐ | A aplicação bloqueia o envio e mostra uma mensagem de erro clara. |
| 10 | Confirmar que partida iniciada bloqueia o campo de palpite. | ☐ | ☐ | Campos de partidas já iniciadas ficam desabilitados ou impedem alteração. |
| 11 | Confirmar que o ranking carrega. | ☐ | ☐ | A página de ranking finaliza o carregamento e não fica presa em loading infinito. |
| 12 | Confirmar que o feed não quebra vazio. | ☐ | ☐ | O feed exibe estado vazio ou mensagem adequada sem erro visual. |

## Critérios de aprovação

A divulgação da versão está aprovada somente se todos os critérios abaixo forem atendidos:

- Todos os itens do checklist estiverem aprovados em desktop e celular.
- Nenhuma página testada apresentar tela em branco, erro fatal, layout inutilizável ou navegação bloqueada.
- `/api/health` e `/api/matches` responderem com sucesso nos dois dispositivos ou em ferramenta equivalente usada a partir desses contextos.
- O fluxo de palpite permitir criar, recuperar e pré-preencher dados de um username novo.
- Validações de placar inválido exibirem erro compreensível e impedirem envio incorreto.
- Partidas iniciadas não permitirem edição de palpite.
- Ranking e feed carregarem corretamente, incluindo estado vazio do feed.
- Qualquer falha encontrada for corrigida e o checklist for executado novamente em desktop e celular antes da divulgação.

## Registro da execução

Preencha antes de divulgar:

- Data/hora:
- Responsável:
- Desktop/navegador:
- Celular/navegador:
- Username de teste usado:
- Observações:
