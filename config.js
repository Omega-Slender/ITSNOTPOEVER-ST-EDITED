// Server configuration
import dotenv from "dotenv";
dotenv.config();

export const SERVER_PORT = process.env.PORT || 3000; // Server port
export const DEBUG = false; // Debug mode (Set to true to enable debugging)
export const PRIOD = 15 * 1000; // 15 seconds (Time interval in milliseconds)
export const RATE_LIMIT = 50; // 50 requests per 15 seconds (Maximum allowed requests in the given interval)
export const WHITELISTED_IPS = [
// "127.0.0.1" (List of IP addresses allowed to access the server, currently empty)
];
// Prompt Moderation before sending to OpenAI
export const MODERATION = false; // Moderation mode (Set to true to enable content moderation)
export let COOKIE = process.env.COOKIE || "Your cookie here"; // User cookie value
export let BROWSER = process.env.BROWSER || "edge"; // Browser type, defaults to "edge"
export let WEBDRIVERMODE = process.env.DRIVERMODE == "true" || true; // Web driver mode (Set to true to enable web driver mode)