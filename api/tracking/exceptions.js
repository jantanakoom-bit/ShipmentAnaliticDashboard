import { trackingExceptionsHandler } from "../_lib/trackingHandlers.js";

export default async function handler(req, res) {
  try {
    return await trackingExceptionsHandler(req, res);
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
  }
}
