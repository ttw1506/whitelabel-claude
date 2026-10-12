// Gera as chaves anon e service_role do ambiente local (mesmo formato do Supabase).
import { createHmac } from "node:crypto";
const segredo = process.argv[2];
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const assinar = (payload) => {
  const corpo = `${b64({ alg: "HS256", typ: "JWT" })}.${b64(payload)}`;
  return `${corpo}.${createHmac("sha256", segredo).update(corpo).digest("base64url")}`;
};
const exp = Math.floor(Date.now() / 1000) + 10 * 365 * 24 * 3600;
console.log(`ANON_KEY=${assinar({ role: "anon", iss: "supabase-local", exp })}`);
console.log(`SERVICE_ROLE_KEY=${assinar({ role: "service_role", iss: "supabase-local", exp })}`);
