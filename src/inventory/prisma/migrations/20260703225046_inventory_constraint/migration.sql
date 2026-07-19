-- This is an empty migration.
ALTER TABLE "Inventory"  ADD CONSTRAINT "chk_available_quantity_positive" CHECK (available_quantity >= 0);
ALTER TABLE "Inventory"  ADD CONSTRAINT "chk_stock_positive" CHECK (physical_stock >= 0);
ALTER TABLE "Inventory"  ADD CONSTRAINT "chk_reserved_quantity_positive" CHECK (reserved_quantity >= 0);