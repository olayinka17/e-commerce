CREATE UNIQUE INDEX unique_success_per_order
ON "Transactions" ("order_id")
WHERE status = 'successful';