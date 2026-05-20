# Opsify — Deployment Guide

> **No Docker needed.** Cloud Run can build directly from your source code using Google Cloud Buildpacks.

---

## Part 1 — Backend: Deploy to Google Cloud Run (No Docker)

### Prerequisites
- [Google Cloud CLI (`gcloud`)](https://cloud.google.com/sdk/docs/install) installed
- A Google Cloud project with billing enabled
- Your Firebase service account JSON file (`firebase-adminsdk.json` or `service_account.json`)

---

### Step 1 — Install & Authenticate gcloud

```bash
# Install gcloud (Windows — download the installer from the link above)
# Then authenticate:
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
```

> [!NOTE]
> Replace `YOUR_PROJECT_ID` with your actual Google Cloud project ID (e.g. `opsify-prod-123`).

---

### Step 2 — Enable Required APIs

```bash
gcloud services enable run.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable secretmanager.googleapis.com
```

---

### Step 3 — Store Secrets in Secret Manager

Instead of bundling sensitive files, store them as secrets. **This is the recommended way.**

#### 3a — Firebase Credentials (most important)

```bash
# Convert your service account JSON to a one-liner and store it:
gcloud secrets create FIREBASE_SERVICE_ACCOUNT_JSON --replication-policy=automatic

# On Windows (PowerShell), pipe the file content:
Get-Content firebase-adminsdk.json -Raw | gcloud secrets versions add FIREBASE_SERVICE_ACCOUNT_JSON --data-file=-
```

#### 3b — Other Secrets

```bash
# Gemini API Key
echo -n "your_gemini_api_key" | gcloud secrets create GEMINI_API_KEY --data-file=-

# Opsify API Key
echo -n "your_opsify_api_key" | gcloud secrets create OPSIFY_API_KEY --data-file=-

# Google Maps API Key (optional)
echo -n "your_maps_api_key" | gcloud secrets create GOOGLE_MAPS_API_KEY --data-file=-
```

---

### Step 4 — Deploy from Source (No Docker!)

Run this from the **`e:\projects\Opsify`** directory:

```bash
gcloud run deploy opsify-backend \
  --source . \
  --region asia-south1 \
  --platform managed \
  --allow-unauthenticated \
  --port 8080 \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 5 \
  --set-secrets="FIREBASE_SERVICE_ACCOUNT_JSON=FIREBASE_SERVICE_ACCOUNT_JSON:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest,OPSIFY_API_KEY=OPSIFY_API_KEY:latest,GOOGLE_MAPS_API_KEY=GOOGLE_MAPS_API_KEY:latest"
```

> [!IMPORTANT]
> `--source .` tells Cloud Run to build from your source code automatically using Buildpacks — **no Dockerfile or Docker installation needed**.
>
> Cloud Run reads your `Procfile` to know how to start the server:
> ```
> web: uvicorn main:app --host 0.0.0.0 --port $PORT --workers 2
> ```

> [!NOTE]
> `asia-south1` = Mumbai (closest to Pakistan). You can also use `asia-southeast1` (Singapore).

---

### Step 5 — Grant Secret Access

After the first deploy, grant the Cloud Run service account permission to read secrets:

```bash
# Get your project number
PROJECT_NUMBER=$(gcloud projects describe YOUR_PROJECT_ID --format="value(projectNumber)")

# Grant secret access to the Cloud Run service account
gcloud secrets add-iam-policy-binding FIREBASE_SERVICE_ACCOUNT_JSON \
  --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding GEMINI_API_KEY \
  --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding OPSIFY_API_KEY \
  --member="serviceAccount:$PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

Then redeploy:

```bash
gcloud run deploy opsify-backend --source . --region asia-south1
```

---

### Step 6 — Get Your API URL

```bash
gcloud run services describe opsify-backend --region asia-south1 --format="value(status.url)"
```

You'll get a URL like: `https://opsify-backend-xxxxxx-em.a.run.app`

---

### Step 7 — Update the React Native App URL

In `react_native_app/src/services/api.ts`, update the production URL:

```ts
const getBaseUrl = () => {
  // Production Cloud Run URL
  const PROD_URL = 'https://opsify-backend-xxxxxx-em.a.run.app/api';
  
  if (__DEV__) {
    return Platform.OS === 'android'
      ? 'http://10.0.2.2:8000/api'   // Android emulator → localhost
      : 'http://localhost:8000/api';   // iOS / web dev
  }
  return PROD_URL;
};
```

---

## Part 2 — Mobile: Build Android APK/AAB (Expo EAS)

### Prerequisites
- Node.js installed
- Expo account (free at [expo.dev](https://expo.dev))

### Step 1 — Install EAS CLI

```bash
npm install -g eas-cli
eas login
```

### Step 2 — Configure EAS Build

```bash
cd e:\projects\Opsify\react_native_app
eas build:configure
```

This creates `eas.json`. Make sure it has:

```json
{
  "build": {
    "preview": {
      "android": { "buildType": "apk" }
    },
    "production": {
      "android": { "buildType": "app-bundle" }
    }
  }
}
```

### Step 3 — Build APK (for direct install/testing)

```bash
eas build --platform android --profile preview
```

- Builds in the cloud (no local Android SDK needed)
- When done, download the `.apk` from the link provided
- Install with: `adb install opsify.apk` or share the download link

### Step 4 — Build AAB (for Google Play Store)

```bash
eas build --platform android --profile production
```

---

## Part 3 — Alternative: Google App Engine (even simpler)

If Cloud Run feels complex, App Engine is one command:

```bash
# From e:\projects\Opsify
gcloud app deploy
```

The `app.yaml` file is already configured. App Engine automatically:
- Installs `requirements.txt`
- Reads `app.yaml` for the startup command
- No Docker, no Buildpacks to think about

> [!WARNING]
> App Engine **always** has at least one instance running (can't scale to zero), so it will have a small monthly cost even when idle. Cloud Run scales to zero = free when not in use.

---

## Quick Reference

| Goal | Command |
|---|---|
| Deploy backend (no Docker) | `gcloud run deploy opsify-backend --source . --region asia-south1` |
| View live URL | `gcloud run services describe opsify-backend --region asia-south1 --format="value(status.url)"` |
| Stream live logs | `gcloud run services logs tail opsify-backend --region asia-south1` |
| Update a secret | `echo -n "new_value" \| gcloud secrets versions add SECRET_NAME --data-file=-` |
| Build Android APK | `eas build --platform android --profile preview` |
| Build Play Store AAB | `eas build --platform android --profile production` |
| Check build status | `eas build:list` |
| App Engine deploy | `gcloud app deploy` |

---

## Files Added to Repo

| File | Purpose |
|---|---|
| `Procfile` | Tells Cloud Run / Buildpacks how to start the server |
| `app.yaml` | Alternative: Google App Engine config |
| `requirements.txt` | Pinned dependency versions for reproducible builds |
| `.env.example` | Template with all required env vars documented |
| `firebase_store.py` | Updated to support `FIREBASE_SERVICE_ACCOUNT_JSON` env var |
