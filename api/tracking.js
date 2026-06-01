import { trackingCollectionHandler } from "./_lib/trackingHandlers.js";

export default async function handler(req, res) {
  try {
    return await trackingCollectionHandler(req, res);
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
  }
}
