# Consulta de placa — DG Locações

Site de teste com um campo de placa e uma função da Vercel que consulta a Falcon Data Hub. A chave fica apenas no servidor.

## Publicar no GitHub e Vercel

1. Extraia este ZIP e envie **os arquivos de dentro da pasta** para a raiz de um repositório no GitHub (`index.html` e a pasta `api`).
2. Na Vercel, escolha **Add New > Project**, importe o repositório, selecione **Framework Preset: Other** e deixe **Root Directory** na raiz do projeto. Não configure Build Command nem Output Directory.
3. No painel da Falcon Data Hub, crie uma conta, abra **Chaves de API**, crie uma chave e copie o token `fdx_...`. Guarde a chave; não coloque no GitHub nem envie no chat.
4. Na Vercel, abra o projeto em **Settings > Environment Variables**. Crie `FALCON_API_KEY` com o token completo (sem `Bearer `), marque o ambiente Production e salve. Se quiser testar no endereço de prévia, marque Preview também.
5. Em **Deployments**, faça **Redeploy** depois de salvar a variável. Abra a URL da Vercel e digite uma placa.

Se receber **403**, confira se a chave tem permissão para consulta de veículos/placas. O plano Free anuncia 10 requisições por hora. Cada clique em Consultar faz uma chamada à API; este projeto não consulta FIPE separadamente.

## Estrutura

- `index.html`: interface, responsiva para celular e PC.
- `api/placa.js`: função serverless da Vercel que protege a chave, valida a placa e encaminha a consulta.

A integração usa o endpoint documentado atualmente pela Falcon: `https://beta.falcon-server.com.br/data-hub/private/v1/vehicles/{placa}/search`. A página de divulgação da Falcon mostra outro exemplo de URL; se o provedor mudar a rota, atualize a constante `BASE` e o caminho da função. Sem uma chave fornecida não é possível verificar uma consulta real neste pacote.
