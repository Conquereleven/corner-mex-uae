# A3.2b Controlled Runtime

Deploy only the independently reviewed commit to the existing Railway project. Production may be created without domain or DNS. Health path is `/api/health`; build is `npm run build:railway`; start is `npm run start:railway`. Checkout, payments, email, messaging, auto-import, inventory sync, OpenClaw and CornerOps direct writes remain false.
