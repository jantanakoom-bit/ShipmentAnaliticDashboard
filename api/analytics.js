import { analyticsHandler } from "./_lib/shipmentHandlers.js";

export default async function handler(req, res) {
  try {
    return await analyticsHandler(req, res);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
