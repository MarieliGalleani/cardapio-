-- CreateEnum
CREATE TYPE "FeeMode" AS ENUM ('BY_NEIGHBORHOOD', 'BY_KM');

-- CreateEnum
CREATE TYPE "PixKeyType" AS ENUM ('CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM');

-- CreateEnum
CREATE TYPE "StockUnit" AS ENUM ('G', 'ML', 'UN');

-- CreateEnum
CREATE TYPE "StockItemKind" AS ENUM ('INGREDIENT', 'PACKAGING');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('PURCHASE', 'ORDER', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('RECEIVED', 'PREPARING', 'OUT_FOR_DELIVERY', 'READY_FOR_PICKUP', 'DELIVERED', 'CANCELED');

-- CreateEnum
CREATE TYPE "FulfillmentType" AS ENUM ('PICKUP', 'DELIVERY');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('PIX', 'CREDIT_CARD', 'DEBIT_CARD', 'CASH');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'FIXED');

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Dono',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoreSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL DEFAULT 'Minha Confeitaria',
    "description" TEXT,
    "logoUrl" TEXT,
    "coverUrl" TEXT,
    "primaryColor" TEXT NOT NULL DEFAULT '#E85D75',
    "whatsappPhone" TEXT,
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "pausedUntil" TIMESTAMP(3),
    "openingHours" JSONB NOT NULL DEFAULT '[]',
    "checkoutEnabled" BOOLEAN NOT NULL DEFAULT true,
    "orderTrackingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "whatsappNotifications" BOOLEAN NOT NULL DEFAULT false,
    "whatsappMessages" JSONB NOT NULL DEFAULT '{}',
    "stockControlEnabled" BOOLEAN NOT NULL DEFAULT false,
    "couponsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "reviewsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "pickupEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pickupAddress" TEXT,
    "deliveryEnabled" BOOLEAN NOT NULL DEFAULT false,
    "deliveryFeeMode" "FeeMode" NOT NULL DEFAULT 'BY_NEIGHBORHOOD',
    "deliveryFeePerKm" DECIMAL(10,2),
    "deliveryMaxKm" DECIMAL(6,2),
    "minimumOrderValue" DECIMAL(10,2),
    "preOrdersEnabled" BOOLEAN NOT NULL DEFAULT false,
    "preOrderMinHours" INTEGER NOT NULL DEFAULT 24,
    "preOrderDailyLimit" INTEGER,
    "pixEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pixKey" TEXT,
    "pixKeyType" "PixKeyType",
    "pixReceiverName" TEXT,
    "pixCity" TEXT,
    "creditEnabled" BOOLEAN NOT NULL DEFAULT false,
    "debitEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mpPublicKey" TEXT,
    "cashEnabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryZone" (
    "id" TEXT NOT NULL,
    "neighborhood" TEXT NOT NULL,
    "fee" DECIMAL(10,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DeliveryZone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "promoPrice" DECIMAL(10,2),
    "available" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVariation" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductVariation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AddonGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minSelect" INTEGER NOT NULL DEFAULT 0,
    "maxSelect" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "AddonGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Addon" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "available" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Addon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductAddonGroup" (
    "productId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProductAddonGroup_pkey" PRIMARY KEY ("productId","groupId")
);

-- CreateTable
CREATE TABLE "StockItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "StockItemKind" NOT NULL DEFAULT 'INGREDIENT',
    "unit" "StockUnit" NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "minimum" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "stockItemId" TEXT NOT NULL,
    "type" "MovementType" NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,
    "totalCost" DECIMAL(10,2),
    "note" TEXT,
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "variationId" TEXT,
    "yieldQuantity" DECIMAL(10,2) NOT NULL,
    "targetMargin" DECIMAL(5,4) NOT NULL DEFAULT 0.30,
    "packagingCostPerUnit" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "energyCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "laborCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "appFeePercent" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeItem" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "stockItemId" TEXT NOT NULL,
    "quantity" DECIMAL(12,3) NOT NULL,

    CONSTRAINT "RecipeItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "publicToken" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'RECEIVED',
    "fulfillment" "FulfillmentType" NOT NULL,
    "scheduledFor" TIMESTAMP(3),
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "address" JSONB,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "deliveryFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "couponCode" TEXT,
    "notes" TEXT,
    "paymentMethod" "PaymentMethod" NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "changeFor" DECIMAL(10,2),
    "mpPaymentId" TEXT,
    "stockDeducted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "variationId" TEXT,
    "name" TEXT NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "notes" TEXT,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItemAddon" (
    "id" TEXT NOT NULL,
    "orderItemId" TEXT NOT NULL,
    "addonId" TEXT,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "OrderItemAddon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderStatusHistory" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coupon" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "DiscountType" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "minimumOrder" DECIMAL(10,2),
    "validUntil" TIMESTAMP(3),
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Coupon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryZone_neighborhood_key" ON "DeliveryZone"("neighborhood");

-- CreateIndex
CREATE UNIQUE INDEX "StockItem_name_key" ON "StockItem"("name");

-- CreateIndex
CREATE INDEX "StockMovement_stockItemId_createdAt_idx" ON "StockMovement"("stockItemId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_productId_key" ON "Recipe"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_variationId_key" ON "Recipe"("variationId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeItem_recipeId_stockItemId_key" ON "RecipeItem"("recipeId", "stockItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_number_key" ON "Order"("number");

-- CreateIndex
CREATE UNIQUE INDEX "Order_publicToken_key" ON "Order"("publicToken");

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Coupon_code_key" ON "Coupon"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Review_orderId_key" ON "Review"("orderId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVariation" ADD CONSTRAINT "ProductVariation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Addon" ADD CONSTRAINT "Addon_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "AddonGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAddonGroup" ADD CONSTRAINT "ProductAddonGroup_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductAddonGroup" ADD CONSTRAINT "ProductAddonGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "AddonGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_variationId_fkey" FOREIGN KEY ("variationId") REFERENCES "ProductVariation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeItem" ADD CONSTRAINT "RecipeItem_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeItem" ADD CONSTRAINT "RecipeItem_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_variationId_fkey" FOREIGN KEY ("variationId") REFERENCES "ProductVariation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemAddon" ADD CONSTRAINT "OrderItemAddon_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemAddon" ADD CONSTRAINT "OrderItemAddon_addonId_fkey" FOREIGN KEY ("addonId") REFERENCES "Addon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
