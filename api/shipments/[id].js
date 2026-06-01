import { shipmentItemHandler } from "../_lib/shipmentHandlers.js";

export default async function handler(req, res) {
  try {
    return await shipmentItemHandler(req, res, req.query.id);
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message });
  }
}
