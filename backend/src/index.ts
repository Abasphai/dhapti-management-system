import "dotenv/config";
import { createApp } from "./app.js";
import { getJwtSecret } from "./lib/auth.js";
import { ensureDefaultAttendanceLocations } from "./lib/ensureAttendanceLocations.js";
import { ensureBiuFacultyCatalog } from "./lib/ensureBiuFacultyCatalog.js";
import { ensureDemoAccounts } from "./lib/ensureDemoAccounts.js";

// Fail fast on boot if JWT is misconfigured
getJwtSecret();

const app = createApp();
const PORT = Number(process.env.PORT || 4000);

void (async () => {
  try {
    await ensureDemoAccounts();
  } catch (err) {
    console.error("Failed to ensure demo accounts:", err);
  }
  try {
    const faculties = await ensureBiuFacultyCatalog();
    console.log(`Dhapti faculty catalog ready (${faculties.length} faculties).`);
  } catch (err) {
    console.error("Failed to ensure Dhapti faculty catalog:", err);
  }
  try {
    if (process.env.NODE_ENV !== "production") {
      const loc = await ensureDefaultAttendanceLocations();
      console.log(
        `Attendance locations ready (${loc.created} created / ${loc.departments} departments).`
      );
    }
  } catch (err) {
    console.error("Failed to ensure attendance locations:", err);
  }
})();

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Dhapti API listening on http://localhost:${PORT}`);
  console.log(`Health: http://127.0.0.1:${PORT}/api/health`);
});
