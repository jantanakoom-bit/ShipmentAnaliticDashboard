import { metadataHandler } from "./_lib/shipmentHandlers.js";

export default async function handler(req, res) {
  try {
    return await metadataHandler(req, res);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
