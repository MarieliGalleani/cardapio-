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
- **Pedidos em tempo real:** usam *Server-Sent Events* (SSE).
  - `/api/admin-stream/orders` avisa o painel de pedidos novos e mudanças.
  - `/api/public/orders/:token/stream` avisa a tela de acompanhamento do cliente.
  - Hoje funciona com um servidor da API. Com mais de um, os avisos precisam passar por Redis.
- **Loja do cliente:** usa Vuetify, como o painel, com um tema próprio cuja cor vem das Configurações.
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

### Pedido

- **Preço:** o servidor recalcula tudo pelo cardápio (produto, variação, adicionais, preço promocional). O valor enviado pelo navegador é ignorado.
- **Validações na hora de pedir:**
  - checkout ligado;
  - loja aberta, ou encomenda dentro da antecedência mínima e do limite por dia;
  - retirada ou entrega ligadas;
  - bairro atendido;
  - mínimo e máximo de adicionais;
  - pedido mínimo;
  - forma de pagamento ativa;
  - com o controle de estoque ligado, ingrediente suficiente para a quantidade pedida.
- **Status:**

  ```
  Recebido → Em preparo → Saiu para entrega / Pronto para retirar → Entregue
  (qualquer um antes de Entregue) → Cancelado
  ```

- **Baixa no estoque:** acontece quando o dono aceita o pedido (Recebido → Em preparo). O sistema gera movimentos `ORDER` pela ficha técnica, numa transação com a linha do pedido travada. Assim, dois cliques não baixam duas vezes.
- **Cancelamento:** se o estoque já tinha baixado, o cancelamento devolve **exatamente** o que foi baixado, mesmo que a receita tenha mudado depois.

### Pix

O código "copia e cola" segue o padrão EMV do Banco Central (BR Code estático):
- traz a chave da loja, o valor do pedido e o identificador `PEDIDO<número>`;
- termina com o CRC16 exigido pelo padrão.

O teste usa o exemplo oficial do manual do Banco Central.
