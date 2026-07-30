#!/bin/bash

set -eu
function create_database() {
    local database = $1

    psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "postgres" <<-EOSQL
        CREATE DATABASE "$database";
EOSQL    
}

if[ -n "${POSTGRES_MULTIPLE_DATABASES:-}" ]; then
    for db in $( echo "$POSTGRES_MULTIPLE_DATABASES" | tr ',' ' ');do
        create_database "$db"
    done
fi