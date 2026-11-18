import { isIP } from "node:net"

// En-tête IP du visiteur pour les appels serveur vers l'API (limitation de débit par IP à la gateway).
// Source unique : `x-real-ip`, posé par l'ingress-nginx (qui écrase toute valeur envoyée par le client).
// Jamais `x-forwarded-for` ni `true-client-ip`. Valeur absente, liste ou non-IP : aucun en-tête.
export function clientIpHeaders(incoming: Headers): Record<string, string> {
  const ip = incoming.get("x-real-ip")?.trim()
  return ip && isIP(ip) !== 0 ? { "X-Real-IP": ip } : {}
}
