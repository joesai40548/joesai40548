import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

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
      <button id="google-sign-in" class="auth-google" type="button"><svg class="google-mark" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11c-.5 2.5-1.9 4.6-4 6l6.5 5C41.3 35.3 43.6 30.3 43.6 24.5z"/><path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.5-5c-1.8 1.2-4.1 2-7 2-5.4 0-10-3.6-11.6-8.5l-6.7 5.2C9.1 39.4 16 44 24 44z"/><path fill="#FBBC05" d="M12.4 27.7a12 12 0 0 1 0-7.4l-6.7-5.2a20 20 0 0 0 0 17.8l6.7-5.2z"/><path fill="#EA4335" d="M24 11.8c3 0 5.7 1 7.8 3.1l5.8-5.8C34.1 5.8 29.5 4 24 4 16 4 9.1 8.6 5.7 15.1l6.7 5.2C14 15.4 18.6 11.8 24 11.8z"/></svg><span>Continue with Google</span></button>
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
