// Cria o login do dono, as configurações padrão e um cardápio de exemplo.
// Pode rodar mais de uma vez: não duplica nada.
import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/lib/password.js'

const prisma = new PrismaClient()

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? '').toLowerCase()
  const password = process.env.ADMIN_PASSWORD
  if (!email || !password) throw new Error('Defina ADMIN_EMAIL e ADMIN_PASSWORD no arquivo .env')

  await prisma.adminUser.upsert({
    where: { email },
    create: { email, passwordHash: await hashPassword(password) },
    update: {},
  })

  // Valores padrão sugeridos no documento: loja aberta, checkout e retirada ligados,
  // entrega desligada e acompanhamento ligado.
  await prisma.storeSettings.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} })

  if ((await prisma.category.count()) > 0) {
    console.log('Cardápio já existe, exemplo não foi recriado.')
    return
  }

  const stock = async (name: string, unit: 'G' | 'ML' | 'UN', quantity: number, unitCost: number, minimum: number, kind: 'INGREDIENT' | 'PACKAGING' = 'INGREDIENT') =>
    prisma.stockItem.create({ data: { name, unit, quantity, unitCost, minimum, kind } })

  const leiteCondensado = await stock('Leite condensado', 'G', 3950, 0.02, 790)
  const chocolate = await stock('Chocolate em pó 50%', 'G', 1000, 0.04, 200)
  const manteiga = await stock('Manteiga', 'G', 1000, 0.05, 200)
  const granulado = await stock('Granulado', 'G', 500, 0.03, 100)
  const forminha = await stock('Forminha nº 4', 'UN', 500, 0.05, 100, 'PACKAGING')

  const doces = await prisma.category.create({ data: { name: 'Doces', sortOrder: 0 } })
  await prisma.category.create({ data: { name: 'Bolos', sortOrder: 1 } })

  const brigadeiro = await prisma.product.create({
    data: {
      categoryId: doces.id,
      name: 'Brigadeiro tradicional',
      description: 'Chocolate 50% cacau com granulado.',
      price: 3.5,
    },
  })

  await prisma.recipe.create({
    data: {
      productId: brigadeiro.id,
      yieldQuantity: 30,
      targetMargin: 0.6,
      energyCost: 2,
      laborCost: 10,
      items: {
        create: [
          { stockItemId: leiteCondensado.id, quantity: 395 },
          { stockItemId: chocolate.id, quantity: 50 },
          { stockItemId: manteiga.id, quantity: 20 },
          { stockItemId: granulado.id, quantity: 100 },
          { stockItemId: forminha.id, quantity: 30 },
        ],
      },
    },
  })

  console.log('Seed concluído.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
