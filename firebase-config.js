import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  createUserWithEmailAndPassword, getAuth, GoogleAuthProvider,
  signInWithEmailAndPassword, signInWithPopup,
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

// Replace the API-key placeholder with the Firebase Web App API key before deployment.
export const firebaseConfig = {
  apiKey: "REPLACE_WITH_FIREBASE_WEB_API_KEY",
  authDomain: "gen-lang-client-0298492773.firebaseapp.com",
  projectId: "gen-lang-client-0298492773",
  storageBucket: "gen-lang-client-0298492773.firebasestorage.app",
  messagingSenderId: "477672932700",
  appId: "1:477672932700:web:422dbe3bea4b2398626d99",
};

const firebaseApp = initializeApp(firebaseConfig);
const firebaseAuth = getAuth(firebaseApp);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

function bindSignInForm() {
  const gate = document.getElementById("auth-gate");
  if (!gate || gate.dataset.bound === "true") return;
  gate.dataset.bound = "true";
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
      if (creating) await createUserWithEmailAndPassword(firebaseAuth, email.value.trim(), password.value);
      else await signInWithEmailAndPassword(firebaseAuth, email.value.trim(), password.value);
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
    try { await signInWithPopup(firebaseAuth, googleProvider); }
    catch (err) { error.textContent = err.message || "Google sign-in failed. Please try again."; }
    finally { google.disabled = false; }
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bindSignInForm, { once: true });
} else {
  bindSignInForm();
}
