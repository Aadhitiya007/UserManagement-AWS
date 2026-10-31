/**
 * Authentication and Token Lifecycle Utilities
 */

/**
 * Decodes a JWT payload without external libraries.
 */
export function decodeToken(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

/**
 * Checks whether a token is missing, malformed, or past its expiration timestamp.
 */
export function isTokenExpired(token) {
  if (!token) return true;
  const payload = decodeToken(token);
  if (!payload || !payload.exp) return true;

  // Compare against current epoch seconds (with a 5-second buffer for clock skew)
  const nowInSeconds = Math.floor(Date.now() / 1000);
  return payload.exp <= nowInSeconds + 5;
}

/**
 * Clears authentication data from storage and redirects to the login screen.
 */
export function handleForceLogout(redirect = true) {
  const hadToken = Boolean(localStorage.getItem("token"));
  localStorage.removeItem("token");
  localStorage.removeItem("user");

  // Broadcast logout event so other components / contexts can reset state
  window.dispatchEvent(new Event("auth:logout"));

  if (hadToken && redirect) {
    if (window.location.pathname !== "/login") {
      window.location.href = "/login?expired=1";
    }
  }
}

/**
 * Global fetch interceptor to automatically catch 401/403 expired token responses.
 */
export function setupAuthInterceptor() {
  if (typeof window === "undefined" || window._authInterceptorInstalled) return;
  window._authInterceptorInstalled = true;

  const originalFetch = window.fetch;
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args);

    if (response.status === 401 || response.status === 403) {
      try {
        const clone = response.clone();
        const data = await clone.json();
        const msg = (data && data.message ? data.message : "").toLowerCase();

        if (
          msg.includes("invalid or expired token") ||
          msg.includes("jwt expired") ||
          msg.includes("no token provided") ||
          msg.includes("authentication error")
        ) {
          console.warn("Session expired or token invalid. Automatically logging out.");
          handleForceLogout(true);
        }
      } catch {
        // Response was not JSON, ignore
      }
    }

    return response;
  };
}

