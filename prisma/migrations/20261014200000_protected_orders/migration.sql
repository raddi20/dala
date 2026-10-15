-- Protected orders. New tables, plus a nullable subaccount code on existing shops.

ALTER TABLE "Storefront" ADD COLUMN "paystackSubaccountCode" TEXT;

CREATE TABLE "ShopDeliveryOption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storefrontId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "feeKes" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShopDeliveryOption_storefrontId_fkey" FOREIGN KEY ("storefrontId") REFERENCES "Storefront" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ShopDeliveryOption_storefrontId_idx" ON "ShopDeliveryOption"("storefrontId");

CREATE TABLE "Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "storefrontId" TEXT NOT NULL,
    "buyerName" TEXT NOT NULL,
    "buyerEmail" TEXT NOT NULL,
    "buyerPhone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending_payment',
    "itemsSubunit" INTEGER NOT NULL,
    "deliverySubunit" INTEGER NOT NULL DEFAULT 0,
    "deliveryKind" TEXT NOT NULL DEFAULT 'pickup',
    "deliveryLabel" TEXT NOT NULL DEFAULT '',
    "commissionPercent" INTEGER NOT NULL DEFAULT 4,
    "paystackReference" TEXT NOT NULL,
    "subaccountCode" TEXT NOT NULL DEFAULT '',
    "collectCode" TEXT NOT NULL DEFAULT '',
    "paidAt" DATETIME,
    "deliveredAt" DATETIME,
    "flaggedAt" DATETIME,
    "refundedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_storefrontId_fkey" FOREIGN KEY ("storefrontId") REFERENCES "Storefront" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Order_paystackReference_key" ON "Order"("paystackReference");
CREATE INDEX "Order_storefrontId_createdAt_idx" ON "Order"("storefrontId", "createdAt");
CREATE INDEX "Order_status_paidAt_idx" ON "Order"("status", "paidAt");

CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitSubunit" INTEGER NOT NULL,
    CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

CREATE TABLE "OrderEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "OrderEvent_orderId_createdAt_idx" ON "OrderEvent"("orderId", "createdAt");

CREATE TABLE "PaystackEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reference" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
