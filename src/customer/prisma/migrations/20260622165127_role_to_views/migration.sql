-- This is an empty migration.
CREATE OR REPLACE VIEW "current_users" AS
SELECT "id", "first_name", "last_name", "email", "photo", "password", "password_change_at", "is_verified", "role"
FROM "User"
WHERE "active" = true;