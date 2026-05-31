import { google } from "googleapis";

export function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

export function getPrivateKey() {
  return requiredEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n");
}

export function getSheetsClient() {
  const auth = new google.auth.JWT({
    email: requiredEnv("GOOGLE_CLIENT_EMAIL"),
    key: getPrivateKey(),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
}
