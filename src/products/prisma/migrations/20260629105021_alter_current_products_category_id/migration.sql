-- This is an empty migration.
CREATE OR REPLACE VIEW "CurrentProducts" AS 
SELECT p.id, 
        p.name, 
        p.category_id, 
        p.description,
        p.price,
        p.sku,
        p.created_at,
        p.updated_at,
        c.name AS "category"
FROM "Products" p
JOIN "Categories" c
ON p.category_id = c.id
WHERE p.active = true;