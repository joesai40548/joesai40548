import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  setPersistence,
  browserLocalPersistence,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

function mountAuthGate() {
  if (document.getElementById("auth-gate")) return;
  const gate = document.createElement("section");
  gate.id = "auth-gate";
  gate.className = "auth-gate";
  gate.setAttribute("aria-labelledby", "auth-title");
  gate.innerHTML = `
    <div class="auth-card">
      <div class="auth-brand">✳ <span>JOES AI</span></div>
      <h1 id="auth-title">Welcome back</h1>
      <p class="auth-subtitle">Sign in to securely access your AI workspace and saved conversations.</p>
      <button id="google-sign-in" class="auth-google" type="button"><span>G</span> Continue with Google</button>
      <div class="auth-divider">or use email</div>
      <form id="email-auth-form">
        <label for="auth-email">Email address</label>
        <input id="auth-email" type="email" autocomplete="email" placeholder="you@example.com" required>
        <label for="auth-password">Password</label>
        <input id="auth-password" type="password" autocomplete="current-password" minlength="6" placeholder="At least 6 characters" required>
        <button id="email-auth-submit" class="auth-submit" type="submit">Sign in</button>
      </form>
      <button id="auth-mode-toggle" class="auth-mode-toggle" type="button">New to JOES AI? Create an account</button>
      <p id="auth-error" class="auth-error" role="alert" aria-live="polite"></p>
      <p class="auth-legal">Your account is secured by Firebase Authentication.</p>
    </div>`;
  document.body.prepend(gate);
  // Firebase may restore a persisted user before DOMContentLoaded mounts the gate.
  gate.classList.toggle("is-hidden", Boolean(auth.currentUser));
  document.getElementById("app")?.classList.toggle("auth-locked", !auth.currentUser);

  const form = gate.querySelector("#email-auth-form");
  const email = gate.querySelector("#auth-email");
  const password = gate.querySelector("#auth-password");
  const error = gate.querySelector("#auth-error");
  const submit = gate.querySelector("#email-auth-submit");
  const toggle = gate.querySelector("#auth-mode-toggle");
  const google = gate.querySelector("#google-sign-in");
  let creating = false;

  toggle.addEventListener("click", () => {
    creating = !creating;
    submit.textContent = creating ? "Create account" : "Sign in";
    password.autocomplete = creating ? "new-password" : "current-password";
    toggle.textContent = creating ? "Already registered? Sign in" : "New to JOES AI? Create an account";
    gate.querySelector("#auth-title").textContent = creating ? "Create your account" : "Welcome back";
    error.textContent = "";
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    error.textContent = "";
    submit.disabled = true;
    submit.textContent = creating ? "Creating account…" : "Signing in…";
    try {
      if (creating) await createUserWithEmailAndPassword(auth, email.value.trim(), password.value);
      else await signInWithEmailAndPassword(auth, email.value.trim(), password.value);
    } catch (err) {
      error.textContent = authErrorMessage(err);
    } finally {
      submit.disabled = false;
      submit.textContent = creating ? "Create account" : "Sign in";
    }
  });

  google.addEventListener("click", () => {
    // Google OAuth runs on a dedicated non-isolated page. The main app keeps
    // COOP/COEP for WebContainers; this page uses a popup so Firebase does not
    // depend on third-party redirect storage on the GitHub Pages custom domain.
    window.location.assign("./google-auth.html");
  });
}

function authErrorMessage(error) {
  const messages = {
    "auth/invalid-credential": "Email or password is incorrect.",
    "auth/email-already-in-use": "An account already exists for this email. Sign in instead.",
    "auth/weak-password": "Choose a password with at least 6 characters.",
    "auth/unauthorized-domain": "This website domain is not authorized in Firebase Authentication. Add joesai.work.gd and joes-ai-6eb7c.firebaseapp.com under Firebase Authentication → Settings → Authorized domains.",
    "auth/operation-not-allowed": "Google sign-in is not enabled in Firebase Authentication. Enable the Google provider in Firebase Console.",
    "auth/network-request-failed": "Network error. Check your connection and try again.",
  };
  return messages[error?.code] || error?.message || "Authentication failed. Please try again.";
}

const authStyles = document.createElement("link");
authStyles.rel = "stylesheet";
authStyles.href = "./auth.css";
document.head.append(authStyles);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountAuthGate, { once: true });
} else {
  mountAuthGate();
}

let previousUid = null;
onAuthStateChanged(auth, (user) => {
  const gate = document.getElementById("auth-gate");
  if (gate) gate.classList.toggle("is-hidden", Boolean(user));
  const appRoot = document.getElementById("app");
  if (appRoot) appRoot.classList.toggle("auth-locked", !user);

  if (user) {
    if (previousUid && previousUid !== user.uid) {
      window.dispatchEvent(new CustomEvent("joes-ai-user-changed"));
    }
    previousUid = user.uid;
    const name = document.querySelector(".profile-copy strong");
    const detail = document.querySelector(".profile-copy small");
    if (name) name.textContent = user.displayName || user.email || "JOES AI";
    if (detail) detail.textContent = user.email || "Signed in";

    const headerActions = document.querySelector(".header-actions");
    if (headerActions && !document.getElementById("sign-out-btn")) {
      const button = document.createElement("button");
      button.id = "sign-out-btn";
      button.className = "header-action";
      button.type = "button";
      button.textContent = "Sign out";
      button.addEventListener("click", () => signOut(auth).catch((err) => console.error("Sign out failed:", err)));
      headerActions.append(button);
    }
  } else {
    const button = document.getElementById("sign-out-btn");
    if (button) button.remove();
  }
});

export { onAuthStateChanged };
