# Cardápio — Sistema para Confeitaria

Sistema web para gerir e vender os produtos de uma confeitaria:

- **Área do dono (painel `/admin`):** Dashboard, Pedidos, Cardápio, Estoque, Ficha técnica e precificação, Configurações.
- **Área do cliente (loja `/`):** vitrine mobile first no estilo iFood, sacola, checkout, pedido pelo WhatsApp e acompanhamento.

A arquitetura e o modelo de dados estão em [`docs/arquitetura.md`](docs/arquitetura.md).

## Status

| Módulo | Situação |
|---|---|
| Modelo de dados (todas as áreas) | ✅ pronto |
| Login do dono | ✅ pronto |
| Cardápio (categorias, produtos, variações, adicionais, fotos, arrastar e soltar) | ✅ pronto |
| Estoque (itens, compras, ajustes, histórico, alerta de reposição) | ✅ pronto |
| Ficha técnica e precificação | ✅ pronto |
| Configurações — pagamentos (Pix e Mercado Pago) e controle de estoque | ✅ pronto |
| Dashboard | 🟡 só alertas de estoque e margem (vendas vêm com Pedidos) |
| Pedidos, baixa no estoque, checkout, pagamento com cartão | ⏳ próxima etapa |
| Loja do cliente completa | ⏳ hoje é só uma prévia do cardápio |

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

- **Pix:** o cliente paga direto na chave Pix da loja. Cadastre a chave em **Configurações → Pix**.
- **Crédito e débito:** pelo **Mercado Pago**.
  - A *public key* vai em **Configurações → Cartão**.
  - O *access token* vai **só** no `.env` do servidor (`MP_ACCESS_TOKEN`), nunca no painel nem no git.
  - O cartão só aparece para o cliente quando as duas estão configuradas.
