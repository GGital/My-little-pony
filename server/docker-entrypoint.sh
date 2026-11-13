#!/bin/sh
set -e

# Container entrypoint (from the Lab 5 Starter Kit). It only hands control to the CMD with `exec`, so the
# Node process becomes PID 1 and receives Cloud Run's SIGTERM for a graceful shutdown (server/src/index.ts).
# Migrations are NOT run here: they run in the separate Cloud Run job (and the `migrate` Compose service).
# Keep `exec "$@"` as the last line.
exec "$@"
