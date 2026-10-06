# Run guide (short version)

Needs: Node 20+, Docker Desktop. Put `tanand-code-challenge-main` (the simulator) next to this folder.

1. `copy .env.example .env`      (Mac/Linux: `cp .env.example .env`)
2. `docker compose up -d --build`   -> MQTT 1883, InfluxDB 8086, PostgreSQL 5432 (tables auto-created), simulator 6677
3. `npm install`
4. Three terminals in this folder: `npm run controller` · `npm run datastore` · `npm run dashboard`
5. Open http://localhost:3000   (give it ~1 minute of data first)

Stop: Ctrl+C in each terminal, then `docker compose down` (add `-v` to wipe all stored data).
UI development: see ui/ (`npm run dev` on 5173, `npm run build` rewrites ./public).
