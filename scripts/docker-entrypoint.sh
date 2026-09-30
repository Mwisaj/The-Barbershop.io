#!/bin/sh
set -eu
if [ "$(id -u)" = "0" ]; then
  mkdir -p /var/data/bookings /var/data/backups
  # proper-lockfile creates /var/data/bookings.lock beside the data directory.
  # The runtime user therefore needs write access to the mounted parent too.
  chown node:node /var/data /var/data/bookings /var/data/backups
  chmod 700 /var/data/bookings /var/data/backups
  exec gosu node "$@"
fi
exec "$@"
