# UptimeRobot monitoring

PasaOrder does not need an UptimeRobot SDK or API key. UptimeRobot checks the
public HTTP endpoints and sends alerts to the contacts configured in the
UptimeRobot account.

## Recommended monitors

Create HTTP(s) monitors for the deployed domain:

| Monitor name               | URL                                 | What it checks                             |
| -------------------------- | ----------------------------------- | ------------------------------------------ |
| PasaOrder web              | `https://pasaorder.store/`          | The public Next.js site responds.          |
| PasaOrder API and database | `https://pasaorder.store/api/ready` | Express responds and can query PostgreSQL. |

`/api/health` is also public and reports whether the API process responds, but
it does not query PostgreSQL. Use `/api/ready` as the main backend monitor so a
database outage is reported too.

In UptimeRobot, choose an HTTP(s) monitor, use the URL above, and alert the
email address you want notified. Keep the monitor interval and retry policy
appropriate for the account and desired alert delay. No authentication header
is required for these health endpoints.

## Verify the endpoints

Run these from a machine outside the server, or use the URLs in a browser:

```sh
curl -i https://pasaorder.store/
curl -i https://pasaorder.store/api/ready
```

The web route should return a successful HTTP response. The API readiness
route should return HTTP `200` with `{"status":"ready"}`. If PostgreSQL is
unavailable, it returns HTTP `503` with `{"status":"unavailable"}`.

These monitors check reachability and API/database readiness. They do not
verify that a customer can complete checkout, that Socket.IO is connected, or
that order notifications are delivered.
