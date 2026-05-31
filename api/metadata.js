import { requireSession } from "./_lib/authHandlers.js";
import { loadWorkbookData } from "./_lib/workbook.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ error: "Method not allowed" });
    }

    const session = await requireSession(req, res);
    if (!session) return;

    const data = await loadWorkbookData();
    return res.status(200).json(data.metadata);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
