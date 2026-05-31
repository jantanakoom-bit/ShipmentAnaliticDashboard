import { resolveWorkbookPath } from "./_lib/workbook.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const source = resolveWorkbookPath();
    return res.status(200).json({
      ok: true,
      service: "shipment-analytic-dashboard-api",
      workbookFound: Boolean(source),
      workbookSource: source,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
}
