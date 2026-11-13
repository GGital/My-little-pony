#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# TCG Event Hub — idempotent first deployment to Google Cloud Run (Lab 5, #33/#34)
# Adapted from the Lab 5 Starter Kit (TokTickIT).
# ==============================================================================
# Usage (repository root, Cloud Shell):
#   DRY_RUN=1 PROJECT_ID=... REGION=asia-southeast1 bash deploy/deploy.sh   # print the plan, create nothing
#   PROJECT_ID=... REGION=asia-southeast1 bash deploy/deploy.sh              # create and deploy
#
# Environment variables:
#   PROJECT_ID   GCP project ID (default: the active gcloud project)
#   REGION       GCP region (default: asia-southeast1)
#   DRY_RUN      1 = print every gcloud command, call none
#
# What it does (one-time setup; safe to run again, existing resources are reused, never replaced):
#   1 enable APIs   2 Artifact Registry   3 Cloud SQL instance   4 database   5 runtime service account
#   6 DB user + DATABASE_URL secret   7 SEED_PASSWORD secret   (per-secret access)   8 build image
#   9 migration + seed job (must succeed before the service changes)   10 Cloud Run service   11 APP_ORIGIN
# Routine releases afterwards come from GitHub Actions (deploy.yml -> deploy/release.sh), which only update.
#
# Changes from the kit (docs/labs/lab05/deployment.md §1):
#   - names tcg-event-hub*, database and user tcg_event_hub;
#   - ONE generated seed secret (SEED_PASSWORD) instead of the kit's admin + optional demo passwords: our seed
#     always creates the six Sprint 1 demo accounts (Lab 6 UAT needs them), and there is no admin account;
#   - the service gets NODE_ENV, TZ, TRUST_PROXY=1, LOG_LEVEL and APP_ORIGIN; APP_ORIGIN lists both Cloud Run URLs
#     (deterministic and status.url), so it is set with gcloud's ^;^ delimiter because the value has a comma.
# Passwords are generated with openssl, stored only in Secret Manager and never printed (--password= is redacted).
# Offline test: deploy/tests/test_deploy_stub.sh (CI runs it).
# ==============================================================================

DRY_RUN="${DRY_RUN:-0}"
REGION="${REGION:-asia-southeast1}"

if [ "$#" -gt 0 ]; then
  echo "Unknown argument: $1" >&2
  echo "Usage: [DRY_RUN=1] [PROJECT_ID=...] [REGION=...] $0" >&2
  exit 1
fi

# Prints the command (and runs it unless DRY_RUN=1). --password=... is never printed.
run_cmd() {
  local arg
  if [ "$DRY_RUN" = "1" ]; then printf '[DRY_RUN] '; else printf '+ '; fi
  for arg in "$@"; do
    case "$arg" in
      --password=*) printf '%s ' '--password=<REDACTED>' ;;
      *) printf '%q ' "$arg" ;;
    esac
  done
  printf '\n'
  if [ "$DRY_RUN" != "1" ]; then "$@"; fi
}

if [ "$DRY_RUN" = "1" ]; then
  PROJECT_ID="${PROJECT_ID:-example-gcp-project}"
else
  PROJECT_ID="${PROJECT_ID:-$(gcloud config get-value project 2>/dev/null || true)}"
  if [ -z "$PROJECT_ID" ]; then
    echo "Error: PROJECT_ID is not set and no active gcloud project was found." >&2
    echo "Run: gcloud config set project YOUR_PROJECT_ID" >&2
    exit 1
  fi
fi

# ------------------------------------------------------------------------------
# Resource names. deploy/release.sh, deploy/teardown.sh, .github/workflows/deploy.yml and the stub tests use the
# same names: rename them everywhere at once.
# ------------------------------------------------------------------------------
REPO_NAME="tcg-event-hub"
SQL_INSTANCE="tcg-event-hub-pg"
DB_NAME="tcg_event_hub"
DB_USER="tcg_event_hub"
SERVICE_NAME="tcg-event-hub"
MIGRATE_JOB_NAME="tcg-event-hub-migrate"
SA_NAME="tcg-event-hub-runner"
SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
SQL_CONN_NAME="${PROJECT_ID}:${REGION}:${SQL_INSTANCE}"
IMAGE_URI="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO_NAME}/${SERVICE_NAME}:latest"

SECRET_DB_URL="tcg-event-hub-database-url"
SECRET_SEED_PASS="tcg-event-hub-seed-password"

echo "=================================================================="
echo "TCG Event Hub Cloud Run Deployment"
echo "Project : ${PROJECT_ID}"
echo "Region  : ${REGION}"
echo "Dry Run : ${DRY_RUN}"
echo "=================================================================="

# 1. Enable the Google APIs ------------------------------------------------------
run_cmd gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  secretmanager.googleapis.com \
  iam.googleapis.com \
  --project "$PROJECT_ID"

# 2. Artifact Registry repository (stores one image per commit SHA) -------------
if [ "$DRY_RUN" = "1" ]; then
  run_cmd gcloud artifacts repositories describe "$REPO_NAME" --location "$REGION" --project "$PROJECT_ID"
  run_cmd gcloud artifacts repositories create "$REPO_NAME" --repository-format=docker --location "$REGION" --description="TCG Event Hub container images" --project "$PROJECT_ID"
elif ! gcloud artifacts repositories describe "$REPO_NAME" --location "$REGION" --project "$PROJECT_ID" >/dev/null 2>&1; then
  run_cmd gcloud artifacts repositories create "$REPO_NAME" \
    --repository-format=docker \
    --location "$REGION" \
    --description="TCG Event Hub container images" \
    --project "$PROJECT_ID"
fi

# 3. Cloud SQL for PostgreSQL 16 — the main cost, billed every hour it exists ---
#    Keep --edition=enterprise: db-f1-micro needs it on POSTGRES_16 (asserted by the stub test).
#    After the first run: gcloud sql instances patch tcg-event-hub-pg --no-storage-auto-increase (Episode 5.4).
if [ "$DRY_RUN" = "1" ]; then
  run_cmd gcloud sql instances describe "$SQL_INSTANCE" --project "$PROJECT_ID"
  run_cmd gcloud sql instances create "$SQL_INSTANCE" --database-version=POSTGRES_16 --edition=enterprise --tier=db-f1-micro --region="$REGION" --storage-size=10GB --storage-type=SSD --backup-start-time=03:00 --project "$PROJECT_ID"
elif ! gcloud sql instances describe "$SQL_INSTANCE" --project "$PROJECT_ID" >/dev/null 2>&1; then
  run_cmd gcloud sql instances create "$SQL_INSTANCE" \
    --database-version=POSTGRES_16 \
    --edition=enterprise \
    --tier=db-f1-micro \
    --region="$REGION" \
    --storage-size=10GB \
    --storage-type=SSD \
    --backup-start-time=03:00 \
    --project "$PROJECT_ID"
fi

# 4. Database -------------------------------------------------------------------
if [ "$DRY_RUN" = "1" ]; then
  run_cmd gcloud sql databases describe "$DB_NAME" --instance="$SQL_INSTANCE" --project "$PROJECT_ID"
  run_cmd gcloud sql databases create "$DB_NAME" --instance="$SQL_INSTANCE" --project "$PROJECT_ID"
elif ! gcloud sql databases describe "$DB_NAME" --instance="$SQL_INSTANCE" --project "$PROJECT_ID" >/dev/null 2>&1; then
  run_cmd gcloud sql databases create "$DB_NAME" --instance="$SQL_INSTANCE" --project "$PROJECT_ID"
fi

# 5. Runtime service account: Cloud SQL Client only; secret access is granted per secret below ----
if [ "$DRY_RUN" = "1" ]; then
  run_cmd gcloud iam service-accounts describe "$SA_EMAIL" --project "$PROJECT_ID"
  run_cmd gcloud iam service-accounts create "$SA_NAME" --display-name="TCG Event Hub Cloud Run runtime" --project "$PROJECT_ID"
elif ! gcloud iam service-accounts describe "$SA_EMAIL" --project "$PROJECT_ID" >/dev/null 2>&1; then
  run_cmd gcloud iam service-accounts create "$SA_NAME" \
    --display-name="TCG Event Hub Cloud Run runtime" \
    --project "$PROJECT_ID"
fi

run_cmd gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:${SA_EMAIL}" \
  --role="roles/cloudsql.client" \
  --condition=None \
  --quiet

# 6. Database user + DATABASE_URL secret (only when the secret does not exist yet) -------------
#    The user's password and the one inside DATABASE_URL are the same generated value (stub test checks it).
#    Prisma reaches Cloud SQL through the Unix socket Cloud Run mounts at /cloudsql/<connection name>.
if [ "$DRY_RUN" = "1" ]; then
  run_cmd gcloud secrets describe "$SECRET_DB_URL" --project "$PROJECT_ID"
  run_cmd gcloud sql users list --instance="$SQL_INSTANCE" --project "$PROJECT_ID" --format="value(name)"
  run_cmd gcloud sql users create "$DB_USER" --instance="$SQL_INSTANCE" --password="<GENERATED_HEX_PASSWORD>" --project "$PROJECT_ID"
  run_cmd gcloud secrets create "$SECRET_DB_URL" --replication-policy="automatic" --project "$PROJECT_ID"
  run_cmd gcloud secrets versions add "$SECRET_DB_URL" --data-file=- --project "$PROJECT_ID"
elif ! gcloud secrets describe "$SECRET_DB_URL" --project "$PROJECT_ID" >/dev/null 2>&1; then
  DB_PASS="$(openssl rand -hex 24)"
  if gcloud sql users list --instance="$SQL_INSTANCE" --project "$PROJECT_ID" --format="value(name)" | grep -qx "$DB_USER"; then
    run_cmd gcloud sql users set-password "$DB_USER" --instance="$SQL_INSTANCE" --password="$DB_PASS" --project "$PROJECT_ID"
  else
    run_cmd gcloud sql users create "$DB_USER" --instance="$SQL_INSTANCE" --password="$DB_PASS" --project "$PROJECT_ID"
  fi
  DB_URL_VALUE="postgresql://${DB_USER}:${DB_PASS}@localhost/${DB_NAME}?host=/cloudsql/${SQL_CONN_NAME}&schema=public&connection_limit=3"
  run_cmd gcloud secrets create "$SECRET_DB_URL" --replication-policy="automatic" --project "$PROJECT_ID"
  printf "%s" "$DB_URL_VALUE" | gcloud secrets versions add "$SECRET_DB_URL" --data-file=- --project "$PROJECT_ID"
fi

# 7. SEED_PASSWORD secret: the password of every seeded demo account (at least 12 characters) -----
#    Read it privately with: gcloud secrets versions access latest --secret=tcg-event-hub-seed-password
if [ "$DRY_RUN" = "1" ]; then
  run_cmd gcloud secrets describe "$SECRET_SEED_PASS" --project "$PROJECT_ID"
  run_cmd gcloud secrets create "$SECRET_SEED_PASS" --replication-policy="automatic" --project "$PROJECT_ID"
  run_cmd gcloud secrets versions add "$SECRET_SEED_PASS" --data-file=- --project "$PROJECT_ID"
elif ! gcloud secrets describe "$SECRET_SEED_PASS" --project "$PROJECT_ID" >/dev/null 2>&1; then
  SEED_PASS="$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-20)"
  run_cmd gcloud secrets create "$SECRET_SEED_PASS" --replication-policy="automatic" --project "$PROJECT_ID"
  printf "%s" "$SEED_PASS" | gcloud secrets versions add "$SECRET_SEED_PASS" --data-file=- --project "$PROJECT_ID"
fi

# Secret access for the runtime account: per secret, never project-wide (the stub test fails otherwise).
for secret in "$SECRET_DB_URL" "$SECRET_SEED_PASS"; do
  run_cmd gcloud secrets add-iam-policy-binding "$secret" \
    --member="serviceAccount:${SA_EMAIL}" \
    --role="roles/secretmanager.secretAccessor" \
    --project "$PROJECT_ID" --quiet
done

# 8. Build and push the image with Cloud Build (root Dockerfile; run from the repository root) ----
#    `latest` is only for this first manual setup; deploy.yml tags every release with its commit SHA.
run_cmd gcloud builds submit \
  --tag "$IMAGE_URI" \
  --project "$PROJECT_ID"

# 9. Migration + seed job; it must succeed before the service is created or changed --------------
#    Only the job gets SEED_PASSWORD. The seed is idempotent: it creates missing rows, never resets a password.
run_cmd gcloud run jobs deploy "$MIGRATE_JOB_NAME" \
  --image "$IMAGE_URI" \
  --region "$REGION" \
  --service-account "$SA_EMAIL" \
  --set-cloudsql-instances "$SQL_CONN_NAME" \
  --set-secrets "DATABASE_URL=${SECRET_DB_URL}:latest,SEED_PASSWORD=${SECRET_SEED_PASS}:latest" \
  --set-env-vars "NODE_ENV=production,TZ=Asia/Bangkok" \
  --command "sh" \
  --args "-c,npx prisma migrate deploy && npm run db:seed" \
  --max-retries 1 \
  --task-timeout 300s \
  --project "$PROJECT_ID"

if ! run_cmd gcloud run jobs execute "$MIGRATE_JOB_NAME" \
  --region "$REGION" \
  --wait \
  --project "$PROJECT_ID"; then
  printf '%s\n' "ERROR: Cloud Run migration job '${MIGRATE_JOB_NAME}' failed. Aborting service deployment." >&2
  printf '%s\n' "View job logs with:" >&2
  printf '%s\n' "  gcloud logging read \"resource.type=cloud_run_job AND resource.labels.job_name=${MIGRATE_JOB_NAME}\" --project \"${PROJECT_ID}\" --limit 50 --format=\"value(textPayload)\"" >&2
  exit 1
fi

# 10. Cloud Run service (public: the demo and Lab 6 UAT need it) -----------------------------------
#     APP_ORIGIN starts as the deterministic URL, which exists before the service does; step 11 adds status.url.
if [ "$DRY_RUN" = "1" ]; then
  PROJECT_NUMBER="<PROJECT_NUMBER>"
else
  PROJECT_NUMBER="$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')"
fi
DETERMINISTIC_URL="https://${SERVICE_NAME}-${PROJECT_NUMBER}.${REGION}.run.app"
SERVICE_ENV="NODE_ENV=production;TZ=Asia/Bangkok;TRUST_PROXY=1;LOG_LEVEL=info"

run_cmd gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE_URI" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --service-account "$SA_EMAIL" \
  --add-cloudsql-instances "$SQL_CONN_NAME" \
  --set-secrets "DATABASE_URL=${SECRET_DB_URL}:latest" \
  --set-env-vars "^;^${SERVICE_ENV};APP_ORIGIN=${DETERMINISTIC_URL}" \
  --min-instances 0 \
  --max-instances 3 \
  --memory 512Mi \
  --cpu 1 \
  --port 3000 \
  --project "$PROJECT_ID"

# 11. Allow both service URLs in APP_ORIGIN (sign-in and registration POSTs come from either one) -----
if [ "$DRY_RUN" = "1" ]; then
  SERVICE_URL="https://${SERVICE_NAME}-<hash>-as.a.run.app"
else
  SERVICE_URL="$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --project "$PROJECT_ID" --format='value(status.url)')"
fi
if [ "$SERVICE_URL" != "$DETERMINISTIC_URL" ]; then
  run_cmd gcloud run services update "$SERVICE_NAME" \
    --region "$REGION" \
    --update-env-vars "^;^APP_ORIGIN=${DETERMINISTIC_URL},${SERVICE_URL}" \
    --project "$PROJECT_ID"
fi

printf '\n'
printf '%s\n' "=================================================================="
printf '%s\n' "Deployment Completed!"
printf '%s\n' "Service URL    : ${SERVICE_URL}"
printf '%s\n' "Also serves    : ${DETERMINISTIC_URL}"
printf '%s\n' "Health Check   : ${SERVICE_URL}/api/health"
printf '%s\n' "Readiness Check: ${SERVICE_URL}/api/ready"
printf '%s\n' "Demo accounts  : quantum@organizer.example, dragon@organizer.example (organizers);"
printf '%s\n' "                 mint@, ploy@, boss@, nok@player.example (participants)"
printf '%s\n' "Demo password  : Stored in Secret Manager: ${SECRET_SEED_PASS} (not printed)."
printf '%s\n' "Next           : gcloud sql instances patch ${SQL_INSTANCE} --no-storage-auto-increase"
printf '%s\n' "=================================================================="
