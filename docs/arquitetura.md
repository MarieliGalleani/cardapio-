# Arquitetura

## Visão geral

```
cardapio/
├── api/   Node.js + Fastify + Prisma (PostgreSQL)
└── web/   Vue 3 + Vite + TypeScript
           ├── /admin  painel do dono (Vuetify)
           └── /       loja do cliente (mobile first)
```

- **API REST**
  - `/api/auth` faz o login.
  - `/api/admin/*` exige o token do dono.
  - `/api/public/*` é usado pela loja sem login.
- **Configurações em tempo real:** a loja lê `/api/public/store` a cada acesso. Qualquer mudança feita no painel vale na hora, sem deploy.
- **Fotos:** ficam em `api/uploads` e são servidas em `/uploads/...`.

## Modelo de dados

O esquema completo está em [`api/prisma/schema.prisma`](../api/prisma/schema.prisma).

| Área | Tabelas |
|---|---|
| Acesso | `AdminUser` |
| Loja | `StoreSettings` (registro único com todas as chaves liga/desliga, horários, pagamentos, aparência), `DeliveryZone` |
| Cardápio | `Category`, `Product`, `ProductVariation`, `AddonGroup`, `Addon`, `ProductAddonGroup` |
| Estoque | `StockItem`, `StockMovement` |
| Ficha técnica | `Recipe` (de um produto **ou** de uma variação), `RecipeItem` |
| Pedidos | `Order`, `OrderItem`, `OrderItemAddon`, `OrderStatusHistory` |
| Extras | `Coupon`, `Review` |

## Regras de negócio

### Unidades

Cada item de estoque é contado em uma unidade base: **g**, **ml** ou **un**.

- Compras em kg, L ou dúzia são convertidas na entrada.
- O custo é guardado por unidade base e mostrado ao dono por kg, L ou un.

### Custo do ingrediente

Cada compra registrada atualiza o custo do item pelo **preço da última compra**.

### Custo da receita

É calculado **na hora**, a partir do custo atual de cada item. Por isso, quando o preço de um ingrediente muda, todas as receitas já aparecem recalculadas. Depois de uma compra que muda o custo, o painel mostra quais produtos ficaram abaixo da margem desejada.

```
ingredientes   = Σ (quantidade × custo unitário)
custo receita  = ingredientes + gás/energia + mão de obra + embalagem × rendimento
custo unidade  = custo receita ÷ rendimento
preço sugerido = custo unidade ÷ (1 − margem desejada − taxa do app)
margem real    = (preço − custo unidade − preço × taxa do app) ÷ preço
```

Sem taxa do app, a fórmula do preço sugerido é exatamente a do documento de requisitos. A taxa do app entra no divisor porque é uma porcentagem do preço de venda, não um valor fixo.

### Disponibilidade

Com **Controle de estoque no cardápio** ligado, um produto (ou variação) fica indisponível sozinho quando falta ingrediente para produzir 1 unidade.

### Status da loja

O status é calculado pela chave aberta/fechada, pela pausa temporária e pelos horários por dia, no fuso de São Paulo.

- Sem horários cadastrados, vale só a chave aberta/fechada.
- Com a loja fechada, a loja do cliente mostra o próximo horário de abertura.

### Baixa no estoque (próxima etapa)

Quando um pedido é confirmado, o sistema gera movimentos `ORDER` pela ficha técnica, em uma única transação. O campo `Order.stockDeducted` evita baixar o estoque duas vezes.
