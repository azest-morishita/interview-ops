import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

type FirebaseClientConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  storageBucket?: string;
  messagingSenderId?: string;
};

const staticFirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
};

let runtimeConfigPromise: Promise<FirebaseClientConfig> | null = null;

function hasRequiredConfig(config: Partial<FirebaseClientConfig>) {
  return Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
}

async function getFirebaseClientConfig() {
  if (hasRequiredConfig(staticFirebaseConfig)) {
    return staticFirebaseConfig as FirebaseClientConfig;
  }

  runtimeConfigPromise ??= fetch("/api/firebase-config", { cache: "no-store" })
    .then(async (response) => {
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || "Firebaseクライアント設定の取得に失敗しました。");
      }

      if (!hasRequiredConfig(payload.firebaseConfig || {})) {
        throw new Error("Firebaseクライアント設定が未設定です。");
      }

      return payload.firebaseConfig as FirebaseClientConfig;
    });

  return runtimeConfigPromise;
}

export async function getClientAuth() {
  const firebaseConfig = await getFirebaseClientConfig();

  if (!getApps().length) {
    initializeApp(firebaseConfig);
  }

  return getAuth(getApp());
}
