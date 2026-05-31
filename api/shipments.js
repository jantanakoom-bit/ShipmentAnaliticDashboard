import { requireSession } from "./_lib/authHandlers.js";
import { loadWorkbookData, filterRows, clampNumber, serializeRow } from "./_lib/workbook.js";

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
    const limit = clampNumber(req.query.limit, 1, 500, 100);

    return res.status(200).json({
      count: filtered.length,
      rows: filtered.slice(0, limit).map(serializeRow),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
