import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  createUserWithEmailAndPassword, getAuth, GoogleAuthProvider, onAuthStateChanged,
  signInWithEmailAndPassword, signInWithPopup, signOut,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

const authStyles = document.createElement("link");
authStyles.rel = "stylesheet";
authStyles.href = "./auth.css";
document.head.append(authStyles);

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

let resolveFirstSignIn;
const firstSignIn = new Promise((resolve) => { resolveFirstSignIn = resolve; });
let lastUid = null;

function mountAuthGate() {
  if (document.getElementById("auth-gate")) return;
  const gate = document.createElement("section");
  gate.id = "auth-gate";
  gate.className = "auth-gate";
  gate.innerHTML = `
    <div class="auth-card">
      <div class="auth-brand">✳ <span>JOES AI</span></div>
      <h1 id="auth-title">Welcome back</h1>
      <p class="auth-subtitle">Sign in to securely access your AI workspace and saved conversations.</p>
      <button id="google-sign-in" class="auth-google" type="button"><span>G</span> Continue with Google</button>
      <div class="auth-divider"><span>or use email</span></div>
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
      error.textContent = err.message || "Authentication failed. Please try again.";
    } finally {
      submit.disabled = false;
      submit.textContent = creating ? "Create account" : "Sign in";
    }
  });
  google.addEventListener("click", async () => {
    error.textContent = "";
    google.disabled = true;
    try { await signInWithPopup(auth, googleProvider); }
    catch (err) { error.textContent = err.message || "Google sign-in failed. Please try again."; }
    finally { google.disabled = false; }
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountAuthGate, { once: true });
else mountAuthGate();

window.getJoesAiIdToken = async () => {
  const user = auth.currentUser || await firstSignIn;
  return user.getIdToken();
};

const nativeFetch = window.fetch.bind(window);
window.fetch = async (input, init = {}) => {
  const url = typeof input === "string" ? input : input.url;
  if (url.startsWith("https://joes-ai-jlzt.onrender.com/api/")) {
    const token = await window.getJoesAiIdToken();
    const requestHeaders = typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined;
    const headers = new Headers(init.headers || requestHeaders || {});
    headers.set("Authorization", "Bearer " + token);
    headers.delete("x-user-id");
    return nativeFetch(input, { ...init, headers });
  }
  return nativeFetch(input, init);
};

onAuthStateChanged(auth, (user) => {
  const gate = document.getElementById("auth-gate");
  if (gate) gate.classList.toggle("is-hidden", Boolean(user));
  const appRoot = document.getElementById("app");
  if (appRoot) appRoot.classList.toggle("auth-locked", !user);
  if (user) {
    resolveFirstSignIn(user);
    const headerActions = document.querySelector(".header-actions");
    if (headerActions && !document.getElementById("sign-out-btn")) {
      const button = document.createElement("button");
      button.id = "sign-out-btn";
      button.className = "header-action";
      button.type = "button";
      button.textContent = "Sign out";
      button.addEventListener("click", () => signOut(auth));
      headerActions.append(button);
    }
    if (lastUid && lastUid !== user.uid) window.dispatchEvent(new CustomEvent("joes-ai-user-changed"));
    lastUid = user.uid;
    const name = document.querySelector(".profile-copy strong");
    const detail = document.querySelector(".profile-copy small");
    if (name) name.textContent = user.displayName || user.email || "JOES AI";
    if (detail) detail.textContent = user.email || "Signed in";
  }
});

export {
  createUserWithEmailAndPassword, onAuthStateChanged, signInWithEmailAndPassword,
  signInWithPopup, signOut,
};
