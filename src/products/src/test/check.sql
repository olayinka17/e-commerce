SELECT *
FROM pg_publication_tables;
-- SELECT slot_name, active, plugin, restart_lsn
-- FROM pg_replication_slots;
-- SHOW wal_level;
-- SHOW max_replication_slots;
-- SHOW max_wal_senders;

-- SELECT
--     slot_name,
--     confirmed_flush_lsn,
--     restart_lsn
-- FROM pg_replication_slots
-- WHERE slot_name = 'product_slot';

-- SELECT *
-- FROM "InventoryOutbox";
-- SELECT pg_current_wal_lsn();
-- SELECT relreplident
-- FROM pg_class
-- WHERE relname = 'InventoryOutbox';
-- SELECT current_database(), inet_server_addr(), inet_server_port(), pg_backend_pid();