# Opsify — Deployment Guide

This guide covers deploying the backend to Google Cloud Run using the Web Console and building the React Native mobile app using Expo EAS.

---

## Part 1 — Backend: Deploy to Google Cloud Run (Web Console)

> **No Docker needed.** Cloud Run can build directly from your source code using Google Cloud Buildpacks.

### Step 1 — Create your Google Cloud Project

1. Go to **[console.cloud.google.com](https://console.cloud.google.com)**
2. Click the project dropdown at the top → **"New Project"**
3. Name it `opsify-prod` (or similar) → **Create**
4. Make sure **billing is enabled** (required for Cloud Run)

### Step 2 — Enable Required APIs

Go to **APIs & Services → Enable APIs and Services** → search and enable:
- **Cloud Run API**
- **Cloud Build API**
- **Secret Manager API**
- **Artifact Registry API**

### Step 3 — Store Environment Variables (Secrets) in Secret Manager

Instead of bundling sensitive files, store them as secrets in Google Cloud. Cloud Run will inject them as environment variables.

1. Go to **Security → Secret Manager**
2. Click **"+ Create Secret"** for each of your environment variables:

| Secret Name | Secret Value |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Paste the **entire content** of your `firebase-adminsdk.json` file. |
| `GEMINI_API_KEY` | Your Gemini API key from AI Studio. |
| `OPSIFY_API_KEY` | Any strong secret string you choose for your backend API security. |
| `GOOGLE_MAPS_API_KEY` | Your Google Maps API key (if applicable). |

### Step 4 — Deploy via Cloud Shell (Easiest Method)

Cloud Shell gives you a terminal **inside the browser** — no local `gcloud` installation needed.

1. Click the **Cloud Shell icon** `>_` in the top-right of the Google Cloud console.
2. In the Cloud Shell terminal, clone your repo:
   ```bash
   git clone https://github.com/YOUR_USERNAME/Opsify.git
   cd Opsify
   ```

3. Run the deploy command:
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
     --set-secrets="FIREBASE_SERVICE_ACCOUNT_JSON=FIREBASE_SERVICE_ACCOUNT_JSON:latest,GEMINI_API_KEY=GEMINI_API_KEY:latest,OPSIFY_API_KEY=OPSIFY_API_KEY:latest"
   ```
   *Note: Change `asia-south1` to your preferred region.*

> **What happens here?** 
> The `--source .` flag tells Cloud Run to build from your source code automatically using Buildpacks — **no Dockerfile needed**. It reads your `Procfile` and `requirements.txt`.

### Step 5 — Grant Secret Access (IAM)

After the first deploy, the Cloud Run service account needs permission to read the secrets.

1. Go to **IAM & Admin → Service Accounts**
2. Find the default compute service account (looks like `PROJECT_NUMBER-compute@developer.gserviceaccount.com`).
3. Go back to **Secret Manager** → click each secret → **"Manage access"** (or Permissions) → **Add principal** → paste the service account email → select role: **Secret Manager Secret Accessor** → Save.

Alternatively, in Cloud Shell:
```bash
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format="value(projectNumber)")
SA="$PROJECT_NUMBER-compute@developer.gserviceaccount.com"

for SECRET in FIREBASE_SERVICE_ACCOUNT_JSON GEMINI_API_KEY OPSIFY_API_KEY; do
  gcloud secrets add-iam-policy-binding $SECRET \
    --member="serviceAccount:$SA" \
    --role="roles/secretmanager.secretAccessor"
done
```
Then redeploy the service using the same command from Step 4.

### Step 6 — Get Your Live URL

In **Cloud Run** in the console, click your `opsify-backend` service. Copy the **URL** shown near the top.
It will look like: `https://opsify-backend-xxxxxx-em.a.run.app`

---

## Part 2 — Update the React Native App Environment

### Step 1 — Add the Production API URL

In your React Native app, update the production API URL to point to your new Cloud Run service.

Open `react_native_app/src/services/api.ts` (or wherever your API base URL is defined) and update it:

```typescript
const getBaseUrl = () => {
  // Replace with your actual Cloud Run URL
  const PROD_URL = 'https://opsify-backend-xxxxxx-em.a.run.app/api';
  
  if (__DEV__) {
    return Platform.OS === 'android'
      ? 'http://10.0.2.2:8000/api'   // Android emulator → localhost
      : 'http://localhost:8000/api';   // iOS / web dev
  }
  return PROD_URL;
};
```

### Step 2 — Configure Android Package Name

Before building the APK, your app needs an Android package name. Open `react_native_app/app.json` and ensure the `android` section has a `package` property:

```json
"android": {
  "package": "com.opsify.app",
  "adaptiveIcon": {
    "foregroundImage": "./assets/adaptive-icon.png",
    "backgroundColor": "#ffffff"
  },
  "edgeToEdgeEnabled": true,
  "predictiveBackGestureEnabled": false
}
```

---

## Part 3 — Mobile: Build Android APK (Expo EAS)

Expo Application Services (EAS) allows you to build the APK in the cloud without installing Android Studio locally.

### Step 1 — Create an Expo Account
Go to **[expo.dev](https://expo.dev)** and sign up for a free account.

### Step 2 — Install EAS CLI & Login

Run this in your terminal (locally):
```bash
npm install -g eas-cli
eas login
```

### Step 3 — Configure EAS Build

Navigate to the React Native app directory:
```bash
cd e:\projects\Opsify\react_native_app
eas build:configure
```
This generates an `eas.json` file. Edit it to ensure the preview profile builds an `.apk`:

```json
{
  "cli": {
    "version": ">= 12.0.0"
  },
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  }
}
```

### Step 4 — Build the APK

Run the following command to start the build in Expo's cloud:
```bash
eas build --platform android --profile preview
```

- This takes about 5–10 minutes.
- Once finished, you will receive a **download link** for the `.apk` file in your terminal (and on your expo.dev dashboard).
- Download the `.apk` and install it on your Android device directly or via adb: `adb install opsify.apk`.

> **Note:** If you want to publish to the Google Play Store later, use the production profile to build an Android App Bundle (`.aab`):
> `eas build --platform android --profile production`
