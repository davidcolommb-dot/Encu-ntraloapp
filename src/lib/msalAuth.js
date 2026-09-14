import { PublicClientApplication } from "@azure/msal-browser";

// Inicio de sesión con la cuenta de Microsoft 365 (opcional — convive con el
// acceso por nombre y contraseña, no lo sustituye). Solo se activa si estas
// dos variables están rellenas; si no, el botón simplemente no aparece, para
// no romper nada en despliegues donde todavía no se haya configurado Azure.
export const msalClientId = import.meta.env.VITE_MSAL_CLIENT_ID || "";
export const msalTenantId = import.meta.env.VITE_MSAL_TENANT_ID || "";
export const msalIsConfigured = !!(msalClientId && msalTenantId);
let msalInstancePromise = null;
export function getMsalInstance() {
  if (!msalInstancePromise) {
    const pca = new PublicClientApplication({
      auth: {
        clientId: msalClientId,
        authority: `https://login.microsoftonline.com/${msalTenantId}`,
        redirectUri: window.location.origin,
      },
      cache: { cacheLocation: "sessionStorage" },
    });
    msalInstancePromise = pca.initialize().then(() => pca);
  }
  return msalInstancePromise;
}
// Abre la ventana de acceso de Microsoft y devuelve el email + nombre de la
// persona una vez confirmada su identidad. No devuelve ninguna contraseña —
// eso lo comprueba Microsoft, nunca esta aplicación.
export async function loginWithMicrosoftPopup() {
  const pca = await getMsalInstance();
  const result = await pca.loginPopup({ scopes: ["User.Read"] });
  return { email: result.account.username, name: result.account.name };
}
