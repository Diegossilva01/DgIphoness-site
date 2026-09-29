# Cadastro de pessoas: Vercel + Neon

Projeto de aprendizado para cadastrar, consultar, alterar e excluir pessoas com foto. Os registros ficam na tabela `pessoas_demo` do PostgreSQL no Neon. A aplicação aceita até 50 registros na listagem e fotos de até 300 KB (JPG, PNG ou WebP). Para um sistema real, use autenticação individual e armazenamento de arquivos separado do banco.

## 1. Criar a tabela no Neon

No projeto Neon que você já criou, abra **Editor SQL**, copie o conteúdo de `criar-tabela.sql`, cole e clique em **Executar**. A tabela `clientes` do seu primeiro teste não será alterada.

## 2. Colocar o código no GitHub

Crie um repositório novo, por exemplo `cadastro-neon-teste`. Extraia este ZIP e envie os arquivos e a pasta `api` para a **raiz** do repositório. O arquivo `api/pessoas.js` precisa manter esse caminho.

## 3. Publicar na Vercel

Na Vercel, escolha **Add New → Project**, importe esse repositório e deixe o projeto como **Other** se a plataforma pedir um framework.

Antes de clicar em **Deploy**, adicione estas duas variáveis em **Environment Variables**:

| Nome | Valor |
| --- | --- |
| `DATABASE_URL` | String de conexão copiada no botão **Connect** do projeto Neon, incluindo a senha e `sslmode=require` |
| `ADMIN_PASSWORD` | Uma senha longa e exclusiva que você escolher para abrir o cadastro |

Selecione pelo menos o ambiente **Production** para as duas variáveis. Se adicioná-las depois do primeiro deploy, faça um **Redeploy**. Não coloque a string de conexão nem a senha no GitHub, nas fotos ou em mensagens públicas.

## 4. Experimentar

Abra o endereço da Vercel, digite sua `ADMIN_PASSWORD`, clique em **Entrar e carregar** e cadastre uma pessoa fictícia com foto pequena. Teste **Editar** e **Excluir**. No Neon, abra **Tables → pessoas_demo** para ver os mesmos registros. Você também pode mudar o nome por lá e clicar em **Atualizar** no site.

O navegador envia os dados à função `/api/pessoas` na Vercel. A função confere a senha e executa comandos no Neon. A string de conexão fica apenas na Vercel. Neste exemplo didático, fotos pequenas são guardadas diretamente na coluna `BYTEA` do PostgreSQL. Não use fotos ou dados reais de clientes nesse teste.
