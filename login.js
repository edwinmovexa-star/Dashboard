import { signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";
import { auth, db } from "./firebase-service.js";

const form = document.getElementById("loginForm");
const message = document.getElementById("loginMessage");
const button = document.getElementById("loginButton");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  message.classList.add("hidden");
  button.disabled = true;
  button.textContent = "Ingresando…";
  try {
    const credential = await signInWithEmailAndPassword(auth, document.getElementById("email").value.trim(), document.getElementById("password").value);
    const profile = await getDoc(doc(db, "usuarios", credential.user.uid));
    if (!profile.exists() || !profile.data().activo || !["admin", "super_admin"].includes(profile.data().rol)) {
      await signOut(auth);
      throw new Error("Tu cuenta no tiene un perfil activo.");
    }
    location.href = "index.html";
  } catch (error) {
    message.textContent = error.message.includes("perfil activo") ? error.message : "Correo o contraseña incorrectos.";
    message.classList.remove("hidden");
  } finally {
    button.disabled = false;
    button.textContent = "Entrar al dashboard";
  }
});
