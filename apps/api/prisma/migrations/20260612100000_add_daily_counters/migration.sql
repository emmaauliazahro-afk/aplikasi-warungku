-- Atomic daily counter for transaction number generation.
-- Used by `generateTransactionNumber` in transaction.controller.ts to avoid
-- the read-then-write race that two concurrent POS terminals could otherwise
-- trigger on `Transaction.transactionNumber` uniqueness.
CREATE TABLE IF NOT EXISTS "daily_counters" (
  "key" TEXT NOT NULL,
  "seq" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "daily_counters_pkey" PRIMARY KEY ("key")
);

-- Indexes for hot report / dashboard queries.
CREATE INDEX IF NOT EXISTS "transactions_payment_method_idx" ON "transactions" ("payment_method");
CREATE INDEX IF NOT EXISTS "stock_movements_created_at_idx" ON "stock_movements" ("created_at");
