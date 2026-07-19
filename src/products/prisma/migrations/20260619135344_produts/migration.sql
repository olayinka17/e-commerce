-- This is an empty migration.
CREATE VIEW "CurrentProducts" AS 
SELECT p.id, 
        p.name, 
        p.category_id, 
        p.description,
        p.price,
        p.sku,
        p.created_at,
        p.updated_at
FROM "Products" p
JOIN "Categories" c
ON p.id = c.id;