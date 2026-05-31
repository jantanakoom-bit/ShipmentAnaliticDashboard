import "dotenv/config";
import { createApp } from "./api/_lib/createApp.js";

const PORT = Number(process.env.PORT) || 3001;
const app = createApp();

app.listen(PORT, () => {
  console.log(`Shipment analytics API listening on http://localhost:${PORT}`);
});
