# Versionamento e publicação

O OpenMonetis usa versões estáveis no formato `MAJOR.MINOR.PATCH`. A versão raiz é a referência da
release e deve permanecer igual em todos os `package.json` do workspace, no badge do `README.md` e
na entrada correspondente do `CHANGELOG.md`.

## Preparar uma versão

1. Escolha o incremento conforme o Versionamento Semântico.
2. Atualize todos os `package.json` do workspace.
3. Mova as mudanças de `Unreleased` para `## [X.Y.Z] - YYYY-MM-DD` no changelog e escreva um resumo
   curto antes das seções.
4. Atualize o badge de versão do README.
5. Execute `pnpm release:check`, `pnpm check`, `pnpm test` e `pnpm build`.
   Execute também as [integrações PostgreSQL](../CONTRIBUTING.md#testes-de-integração) afetadas;
   o workflow de publicação repete a CI completa, incluindo todas as treze suítes de integração.
6. Envie a mudança para `main` e aguarde a CI passar.

## Notas de atualização

Toda versão com migration, mudança de contrato, variável de ambiente ou alteração no Compose deve
incluir `### Notas de atualização`. Registre as notas primeiro em `Unreleased` e mantenha-as ao
preparar a versão. Use um item por assunto, com passos executáveis e valores padrão explícitos:

```markdown
### Notas de atualização

- Banco: identifique as migrations e seus efeitos nos dados. Informe o backup necessário e
  acompanhe `docker compose logs migrator` após iniciar a nova versão.
- API: descreva rotas/campos adicionados, alterados ou removidos e a adaptação exigida dos clientes.
- Ambiente: indique variáveis novas/removidas, valores padrão e quais serviços devem ser recriados.
- Compose: identifique serviços, volumes, portas ou dependências alteradas e os comandos necessários.
```

Mencione somente os assuntos afetados e substitua as instruções do modelo por ações específicas da
versão. Não apresente reverter a imagem como forma de desfazer uma migration: documente as condições
de recuperação, incluindo restauração de backup quando necessária. As notas são distribuídas nas
imagens, apresentadas em `GET /releases` como `upgradeNotes` e exibidas separadamente na web.

Antes de publicar, confira os quatro assuntos mesmo que só parte deles exija ações. Versões antigas
sem essa seção continuam sendo aceitas; o leitor retorna uma lista vazia de notas.

A fixação de versão nos instaladores permanece pendente. Até sua implementação, os scripts
continuam usando a branch padrão e `latest`; implantação e atualização com versão fixa exigem
alinhar manualmente a tag do checkout ao `OPENMONETIS_VERSION`.

## Publicar

A publicação só é iniciada por uma tag anotada `vX.Y.Z` que aponte para o commit validado na
`main`. O workflow verifica que a referência é uma tag anotada, confirma que o commit pertence à
história da `main`, repete a CI e confere os metadados novamente. Publica as três imagens no GHCR com tags
`X.Y.Z`, `X.Y`, `X` e `latest` e só então cria a GitHub Release com as notas extraídas do changelog.

```bash
git tag -a v0.1.0 -m "v0.1.0"
git push origin v0.1.0
```

Criar ou enviar uma tag publica artefatos externos. Essa ação exige autorização explícita do
mantenedor e não faz parte da preparação normal de uma versão.

## Comportamento da aplicação

A API lê a versão do próprio pacote e o changelog distribuído com a imagem. O cliente web consulta
`GET /releases`; ele não lê `package.json`, não analisa Markdown e não consulta o GitHub diretamente.
O estado de leitura do aviso da versão atual é salvo por usuário pela API. A consulta à release mais
recente no GitHub possui timeout, cache e fallback, por isso uma instalação sem acesso à internet
continua funcional.
