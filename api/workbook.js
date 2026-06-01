import { workbookHandler } from "./_lib/shipmentHandlers.js";

export default async function handler(req, res) {
  try {
    return await workbookHandler(req, res);
  } catch (error) {
    const missingWorkbook = error.message.includes("Workbook not found");
    return res.status(missingWorkbook ? 404 : 500).json({ error: error.message });
  }
}
