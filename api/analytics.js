import { requireSession } from "./_lib/authHandlers.js";
import { loadWorkbookData, filterRows, buildAnalytics } from "./_lib/workbook.js";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      res.setHeader("Allow", "GET");
      return res.status(405).json({ error: "Method not allowed" });
    }

    const session = await requireSession(req, res);
    if (!session) return;

    const { detailData } = await loadWorkbookData();
    const filtered = filterRows(detailData, req.query);
    const grain = ["month", "quarter", "year"].includes(req.query.grain)
      ? req.query.grain
      : "month";

    return res.status(200).json(buildAnalytics(filtered, grain));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
