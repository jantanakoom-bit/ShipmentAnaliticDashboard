import { userItemHandler } from "../../_lib/adminHandlers.js";

export default async function handler(req, res) {
  try {
    await userItemHandler(req, res, req.query.id);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
}
