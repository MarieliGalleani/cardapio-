# Cardápio — Sistema para Confeitaria

Sistema web para gerir e vender os produtos de uma confeitaria:

- **Área do dono (painel `/admin`):** Dashboard, Pedidos, Cardápio, Estoque, Ficha técnica e precificação, Configurações.
- **Área do cliente (loja `/`):** vitrine mobile first no estilo iFood, sacola, checkout, pedido pelo WhatsApp e acompanhamento.

A arquitetura e o modelo de dados estão em [`docs/arquitetura.md`](docs/arquitetura.md).

## Status

| Módulo | Situação |
|---|---|
| Modelo de dados e login do dono | ✅ pronto |
| Cardápio (categorias, produtos, variações, adicionais, fotos, arrastar e soltar) | ✅ pronto |
| Estoque (compras, ajustes, histórico, alerta de reposição) | ✅ pronto |
| Ficha técnica e precificação | ✅ pronto |
| Pedidos em tempo real (quadro, alerta sonoro, mudança de status, baixa no estoque) | ✅ pronto |
| Dashboard (vendas do dia, semana e mês, ticket médio, mais vendidos, margem) | ✅ pronto |
| Configurações (horários, pausa, checkout, entrega por bairro, encomendas, pagamentos, aparência, mensagens) | ✅ pronto |
| Loja do cliente (vitrine, sacola, checkout, Pix, cartão, WhatsApp, acompanhamento) | ✅ pronto |
| Cupons e avaliações | ⏳ próxima etapa |
| Taxa de entrega por km (precisa de serviço de mapas) | ⏳ próxima etapa |
| Envio automático de WhatsApp (precisa de API paga) | ⏳ hoje o dono envia com um clique |

## Como rodar no computador

Precisa de **Node.js 22** e **Docker** (para o banco de dados).

```bash
# 1. Banco de dados PostgreSQL
docker compose up -d

# 2. Variáveis de ambiente: copie o exemplo e troque a senha e o segredo
cp .env.example .env

# 3. Dependências
npm install

# 4. Cria as tabelas e o login do dono (com um cardápio de exemplo)
npm run db:migrate
npm run db:seed

# 5. Em dois terminais:
npm run dev:api   # API em http://localhost:3333
npm run dev:web   # Site em http://localhost:5173
```

Painel: http://localhost:5173/admin. Entre com o `ADMIN_EMAIL` e o `ADMIN_PASSWORD` do `.env`.

### Outros comandos

```bash
npm test           # testes das regras de preço e horário da loja
npm run typecheck  # checagem de tipos da API e do site
npm run build      # build de produção
```

## Pagamentos

- **Pix:** o cliente recebe o QR Code "copia e cola" já com o valor do pedido.
  - O dinheiro cai direto na chave da loja, sem intermediário e sem taxa.
  - O dono confere no app do banco e clica em **Marcar como pago** no pedido.
  - Configure a chave em **Configurações → Pagamentos**.
- **Crédito e débito:** pelo **Mercado Pago (Checkout Pro)**.
  - O cliente paga numa página do próprio Mercado Pago; o site nunca vê dados de cartão.
  - A *public key* vai em **Configurações → Pagamentos**.
  - O *access token* vai **só** no `.env` do servidor (`MP_ACCESS_TOKEN`), nunca no painel nem no git.
  - O cartão só aparece para o cliente quando as duas estão configuradas.
  - A confirmação do pagamento chega sozinha pelo aviso do Mercado Pago. Para isso, o `PUBLIC_API_URL` precisa ser um endereço público; em `localhost` o Mercado Pago não consegue avisar.
  - Quando o cliente volta do Mercado Pago, a página do pedido também confere o pagamento.
- **Dinheiro na entrega:** opcional, com campo de troco.
