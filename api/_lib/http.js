export function sendJson(res, status, body, headers = {}) {
  for (const [key, value] of Object.entries(headers)) {
    res.setHeader(key, value);
  }
  res.status(status).json(body);
}

export function sendMethodNotAllowed(res, methods) {
  res.setHeader("Allow", methods.join(", "));
  sendJson(res, 405, { error: "Method not allowed" });
}

export function readCookie(req, name) {
  const header = req.headers.cookie || "";
  const cookies = header.split(";").map((item) => item.trim());
  const prefix = `${name}=`;
  const match = cookies.find((item) => item.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : "";
}

export function getRequestBody(req) {
  return req.body || {};
}

export function isProduction() {
  return process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
}
