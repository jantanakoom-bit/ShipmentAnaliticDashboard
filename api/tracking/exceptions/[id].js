import { trackingExceptionItemHandler } from "../../_lib/trackingHandlers.js";

export default async function handler(req, res) {
  try {
    return await trackingExceptionItemHandler(req, res, req.query.id);
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.message || "Internal server error" });
  }
}
