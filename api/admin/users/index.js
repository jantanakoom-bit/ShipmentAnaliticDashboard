import { usersCollectionHandler } from "../../_lib/adminHandlers.js";

export default async function handler(req, res) {
  try {
    await usersCollectionHandler(req, res);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message });
  }
}
