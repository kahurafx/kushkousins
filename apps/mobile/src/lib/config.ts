/**
 * The Next.js server (API + auth). iOS simulator: http://localhost:3000 · Android emulator:
 * http://10.0.2.2:3000 · physical device: http://<your LAN IP>:3000 (start `next dev -H 0.0.0.0`).
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000").replace(/\/$/, "");
