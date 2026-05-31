import { requireSession } from "./_lib/authHandlers.js";
import { loadWorkbookData, serializeWorkbookData } from "./_lib/workbook.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ error: "Method not allowed" });
    }

    const session = await requireSession(req, res);
    if (!session) return;

    return res.status(200).json(serializeWorkbookData(loadWorkbookData()));
  } catch (error) {
    const missingWorkbook = error.message.includes("Workbook not found");
    return res.status(missingWorkbook ? 404 : 500).json({ error: error.message });
  }
}
