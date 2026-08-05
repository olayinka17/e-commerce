#!/bin/bash

set -eu
function create_database() {
    local database = $1

    psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "postgres" <<-EOSQL
        CREATE DATABASE "$database";
EOSQL    
}

function create_replication_user() {
    local replication_user = $1
    local group_name="e-commerce"
    local password_append="_password"

    psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "postgres" \
        -v rel_user="$replication_user" \
        -v group_name="$group_name" \
        -v rel_pass="${replication_user}${password_append}" <<-EOSQL

        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_roles WHERE rolname = :'rel_user'
            ) THEN
                 EXECUTE format('CREATE ROLE %I WITH REPLICATION LOGIN PASSWORD %L', :'rel_user', :'rel_pass');
            END IF;
        END
        $$;
                
        
        -- create a group role if it doesn't exist
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_roles WHERE rolname = :'group_name'
            ) THEN
                EXECUTE format('CREATE ROLE %I WITH REPLICATION NOLOGIN', :'group_name');
                -- CREATE ROLE $group_name WITH REPLICATION NOLOGIN;
            END IF;
        END
        $$;
    
        -- grant the replication user to the group role if not already granted
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_auth_members m
                JOIN pg_roles r ON m.member = r.oid
                JOIN pg_roles g ON m.roleid = g.oid
                WHERE r.rolname = :'rel_user'
                  AND g.rolname = :'group_name'
            ) THEN
                EXECUTE format('GRANT %I TO %I', :'group_name', :'rel_user');
                -- GRANT $group_name TO postgres;
            END IF;
        END
        $$;     
        
        -- switch to the database where you want to set default privileges
        \c $replication_user


        --DO $$
        --BEGIN
        --    IF NOT EXISTS (
        --        SELECT 1 FROM pg_default_acl WHERE defaclrole = (SELECT oid FROM pg_roles WHERE rolname = '$replication_user')
        --    ) THEN
        --        ALTER DEFAULT PRIVILEGES FOR ROLE :"rel_user" IN SCHEMA public GRANT ON TABLES TO :"group_name";
        --    END IF;
        --END
        --$$;

        -- grant usage on the public schema to the group role
        EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', :'group_name');

        -- create tables and grant select privileges to the group role based on the replication user
        DO $$
        BEGIN
            IF :'rel_user' = 'customer' THEN
                CREATE TABLE IF NOT EXISTS public.EmailOutbox ();
                GRANT SELECT ON PUBLIC.emailOutbox TO :"group_name";
            ELSIF :'rel_user' = 'products' THEN
                CREATE TABLE IF NOT EXISTS public.InventoryOutbox ();
                GRANT SELECT ON PUBLIC.InventoryOutbox TO :"group_name";
            ELSIF :'rel_user' = 'shopping' THEN
                CREATE TABLE IF NOT EXISTS public.PaymentOutox ();
                GRANT SELECT ON PUBLIC.PaymentOutox TO :"group_name";
            END IF;
        END
        $$;
        
EOSQL
        
}

if[ -n "${POSTGRES_MULTIPLE_DATABASES:-}" ]; then
    for db in $( echo "$POSTGRES_MULTIPLE_DATABASES" | tr ',' ' ');do
        create_database "$db"
        if[ "$db" = "customer" ] || [ "$db" = "products" ] || [ "$db" = "shopping" ]; then
            create_replication_user "$db"
        fi
        
    done
fi

