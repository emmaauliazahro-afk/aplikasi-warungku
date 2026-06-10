-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'CASHIER');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('PURCHASE', 'SALE', 'ADJUSTMENT', 'RETURN');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TRANSFER', 'DEBT');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DebtStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'OWNER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "purchase_price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "selling_price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "min_stock" INTEGER NOT NULL DEFAULT 5,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "category_id" INTEGER,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" SERIAL NOT NULL,
    "product_id" INTEGER NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "stock_before" INTEGER NOT NULL,
    "stock_after" INTEGER NOT NULL,
    "note" TEXT,
    "reference_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" SERIAL NOT NULL,
    "transaction_number" TEXT NOT NULL,
    "customer_id" INTEGER,
    "user_id" INTEGER,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paid_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "change_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "payment_method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "status" "TransactionStatus" NOT NULL DEFAULT 'COMPLETED',
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_items" (
    "id" SERIAL NOT NULL,
    "transaction_id" INTEGER NOT NULL,
    "product_id" INTEGER,
    "product_name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "cost_price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "transaction_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debts" (
    "id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "transaction_id" INTEGER,
    "amount" DECIMAL(12,2) NOT NULL,
    "paid_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "remaining" DECIMAL(12,2) NOT NULL,
    "status" "DebtStatus" NOT NULL DEFAULT 'UNPAID',
    "due_date" TIMESTAMP(3),
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "debts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debt_payments" (
    "id" SERIAL NOT NULL,
    "debt_id" INTEGER NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debt_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE INDEX "products_name_idx" ON "products"("name");

-- CreateIndex
CREATE INDEX "products_category_id_idx" ON "products"("category_id");

-- CreateIndex
CREATE INDEX "stock_movements_product_id_idx" ON "stock_movements"("product_id");

-- CreateIndex
CREATE INDEX "customers_name_idx" ON "customers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_transaction_number_key" ON "transactions"("transaction_number");

-- CreateIndex
CREATE INDEX "transactions_customer_id_idx" ON "transactions"("customer_id");

-- CreateIndex
CREATE INDEX "transactions_created_at_idx" ON "transactions"("created_at");

-- CreateIndex
CREATE INDEX "transaction_items_transaction_id_idx" ON "transaction_items"("transaction_id");

-- CreateIndex
CREATE INDEX "transaction_items_product_id_idx" ON "transaction_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "debts_transaction_id_key" ON "debts"("transaction_id");

-- CreateIndex
CREATE INDEX "debts_customer_id_idx" ON "debts"("customer_id");

-- CreateIndex
CREATE INDEX "debts_status_idx" ON "debts"("status");

-- CreateIndex
CREATE INDEX "debt_payments_debt_id_idx" ON "debt_payments"("debt_id");

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_items" ADD CONSTRAINT "transaction_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debts" ADD CONSTRAINT "debts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debts" ADD CONSTRAINT "debts_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debt_payments" ADD CONSTRAINT "debt_payments_debt_id_fkey" FOREIGN KEY ("debt_id") REFERENCES "debts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
