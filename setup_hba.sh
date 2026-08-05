#!/bin/bash
set -eu

HBA_FILE="$PGDATA/pg_hba.conf"

cat <<EOF >> "$HBA_FILE"

# Custom Connector Subnet Access Rules
host    replication     +e-commerce     10.0.1.0/24     scram-sha-256
EOF