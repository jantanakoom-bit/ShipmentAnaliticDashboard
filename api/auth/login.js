import { loginHandler } from "../_lib/authHandlers.js";

export default async function handler(req, res) {
  try {
    await loginHandler(req, res);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
}
