#!/bin/sh
set -eu
if [ "$(id -u)" = "0" ]; then
  mkdir -p /var/data/bookings /var/data/backups
  chown node:node /var/data/bookings /var/data/backups
  chmod 700 /var/data/bookings /var/data/backups
  exec gosu node "$@"
fi
exec "$@"
