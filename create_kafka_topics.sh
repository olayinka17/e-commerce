#!/bin/bash

BOOTSTRAP_SERVERS="server-0:9092,server-1:9093,server-2:9094,server-3:9095"

while ! nc -z server-0 9092; do
    sleep 3
done

TOPICS=("order.created" "inventory.reserve" "inventory.reserved" "inventory.failed" "inventory.failure" "payment.process" "payment.success" "payment.successful" "payment.failure" "payment.failed" "inventory.failed.retry" "order.failed.retry" "payment.process_DLQ" "inventory.reserve_DLQ" "payment.failed_DLQ" "payment.success_DLQ" "outbox.event.email" "outbox.event.products" "outbox.event.payments" "outbox.event.products_DLQ" "outbox.event.email_DLQ" "outbox.event.payments_DLQ")

for topic in "${TOPICS[@]}"; do
    kafka-topics --create --if-not--exists --topic "$topic" --replication-factor=3 --partitions=3 --bootstrap-server "$BOOTSTRAP_SERVERS"
done