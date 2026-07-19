-- DROP PUBLICATION IF EXISTS product_publication;
CREATE PUBLICATION product_publication
FOR TABLE "InventoryOutbox";