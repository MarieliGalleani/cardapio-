import type { BaseUnit } from './format'

export interface Category {
  id: string
  name: string
  sortOrder: number
  active: boolean
  _count?: { products: number }
}

export interface Variation {
  id?: string
  name: string
  price: number
  available: boolean
}

export interface Addon {
  id?: string
  name: string
  price: number
  available: boolean
}

export interface AddonGroup {
  id: string
  name: string
  minSelect: number
  maxSelect: number
  addons: Addon[]
}

export interface RecipeCost {
  ingredientsCost: number
  indirectCost: number
  totalCost: number
  unitCost: number
  suggestedUnitPrice: number | null
  suggestedBatchPrice: number | null
  salePrice: number | null
  actualMargin: number | null
  belowTarget: boolean
}

export interface Product {
  id: string
  categoryId: string
  category: { id: string; name: string }
  name: string
  description: string | null
  imageUrl: string | null
  price: number
  promoPrice: number | null
  available: boolean
  sortOrder: number
  variations: (Variation & { id: string })[]
  addonGroups: { groupId: string; group: AddonGroup }[]
  recipe: ({ id: string } & RecipeCost) | null
}

export interface StockItem {
  id: string
  name: string
  kind: 'INGREDIENT' | 'PACKAGING'
  unit: BaseUnit
  quantity: number
  unitCost: number
  minimum: number
  low: boolean
  _count?: { recipeItems: number }
}

export interface StockMovement {
  id: string
  type: 'PURCHASE' | 'ORDER' | 'ADJUSTMENT'
  quantity: number
  totalCost: number | null
  note: string | null
  createdAt: string
  order: { number: number } | null
}

export interface BelowTarget extends RecipeCost {
  id: string
  label: string
  targetMargin: number
}

export interface Recipe {
  id: string
  productId: string | null
  variationId: string | null
  yieldQuantity: number
  targetMargin: number
  packagingCostPerUnit: number
  energyCost: number
  laborCost: number
  appFeePercent: number
  notes: string | null
  label: string
  cost: RecipeCost
  items: { id: string; stockItemId: string; quantity: number; stockItem: StockItem }[]
}
