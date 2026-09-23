# AWS Free plan deployment

This guide runs the existing application image, analysis daemon, MongoDB, and Redis on one EC2 instance. Cloudflare Tunnel publishes the app over HTTPS without opening inbound web ports. The root Docker image builds and serves the React client and Node API together; the client uses the same-origin `/api` path.

> **Database security:** This deployment still defaults to MongoDB 6.0 for compatibility with existing data. MongoDB 6.0 is out of support. Review the [MongoDB upgrade runbook](MONGODB_UPGRADE_RUNBOOK.md) and plan a staged 6.0 → 7.0 → 8.0 migration; do not point an existing data volume directly at MongoDB 8.0.

## Free plan limits

AWS's Free plan includes selected EC2 instance types and uses promotional credits. The plan ends when credits are exhausted or six months after account creation, whichever comes first. AWS closes a Free plan account at that point unless it is upgraded; the hosted app and its data then become unavailable. Check the remaining credit and plan end date in AWS Billing before creating infrastructure.

The `m7i-flex.large` is an x86 EC2 option listed as eligible for the AWS Free plan, with 2 vCPUs and 8 GiB memory. Use one analysis worker at a time on this size. Video processing is CPU-based and can be slow; this is a small demo host, not a durable production deployment. EC2, disk, networking, and data usage draw down the account's credits.

## 1. Create the EC2 instance

In the AWS console:

1. Confirm Billing shows the **Free plan** and review the credit balance and expiry.
2. Launch an x86_64 Amazon Linux 2023 instance using `m7i-flex.large` (or another EC2 type explicitly marked eligible in the Free plan console).
3. Use an EBS volume large enough for the container image and your test videos. Start with 30 GiB and monitor free disk space.
4. Create a security group with no inbound HTTP/HTTPS rules. For administration, allow SSH only from your current public IP; Cloudflare Tunnel makes the website reachable without an inbound web rule.
5. Keep the instance in a public subnet with outbound internet access so it can download packages, build dependencies, and connect to Cloudflare.

## 2. Install Docker and check out the app

Connect to the instance using the SSH key selected at launch. Install Docker and Git using the current Amazon Linux 2023 instructions, start Docker, and verify that Docker Compose v2 is available.

Then clone the repository and enter its directory:

```bash
git clone https://github.com/joshuejags/scout-bridge-analytics.git
cd scout-bridge-analytics
```

## 3. Connect the Cloudflare Tunnel

In Cloudflare, create a Tunnel for this server and copy its token. Add a public hostname for `scoutbridgeanalytics.com` that routes to `http://app:5000`. Cloudflare's tunnel setup manages the hostname's DNS record. The tunnel target `app` is the Compose service name on the shared Docker network.

The app serves the website and API on the same origin, so the client calls `https://scoutbridgeanalytics.com/api`. Set `CLIENT_URL` to that exact origin. Add a redirect for `www.scoutbridgeanalytics.com` to the apex domain if you want the www hostname too.

Cloudflare's Free plan limits each request body to 100 MB. The client uses 5 MB upload chunks, so use its resumable chunked-upload flow for larger videos; do not use a single direct request over 100 MB through the tunnel.

## 4. Set secrets and start the app

Copy the application and tunnel environment examples on the EC2 host:

```bash
cp .env.aws.example .env.aws
cp .env.tunnel.example .env.tunnel
chmod 600 .env.aws .env.tunnel
```

Replace the placeholders. Use long random values for `JWT_SECRET`, `MONGO_ROOT_PASSWORD`, and `REDIS_PASSWORD`; keep the MongoDB and Redis passwords to letters and numbers so the Mongo connection URI remains valid. Put the Cloudflare Tunnel token in `TUNNEL_TOKEN` inside `.env.tunnel`. Keep both secret files private and do not commit them.

Build and start the stack:

```bash
docker compose --env-file .env.aws -f compose.aws.yml up -d --build
docker compose --env-file .env.aws -f compose.aws.yml ps
```

The API and analysis daemon share the local-upload volume, while MongoDB and Redis data use persistent Docker volumes. MongoDB and Redis ports are not published to the internet. The Cloudflare Tunnel is the only public route to the app.

## 5. Verify

Open `https://scoutbridgeanalytics.com`. Check the API and dependencies with:

```bash
curl https://scoutbridgeanalytics.com/api/health
```

The health response should report `status: ok`, `database: connected`, and `redis: connected`. Check container logs with:

```bash
docker compose --env-file .env.aws -f compose.aws.yml logs --tail=100 app analysis-daemon cloudflared
```

## Data and shutdown

This deployment stores uploads and database files on the EC2 instance's EBS-backed Docker volumes. Back up data you need to keep before stopping or deleting the instance, changing its volumes, exhausting the Free plan credits, or reaching the plan expiry date. The AWS Free plan is temporary; keep a verified backup outside the account before its expiry.
