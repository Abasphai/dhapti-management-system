import "dotenv/config";
import app from "./app.js";
import { getJwtSecret } from "./lib/auth.js";
import { ensureDefaultAttendanceLocations } from "./lib/ensureAttendanceLocations.js";
import { ensureBiuFacultyCatalog } from "./lib/ensureBiuFacultyCatalog.js";
import { ensureDemoAccounts } from "./lib/ensureDemoAccounts.js";
import { ensureMasterAdmin } from "./lib/ensureMasterAdmin.js";

// Fail fast on boot if JWT is misconfigured
getJwtSecret();

const PORT = Number(process.env.PORT) || 4000;
const HOST = "0.0.0.0";

void (async () => {
  try {
    const master = await ensureMasterAdmin();
    console.log(
      `Master admin ready (${master.email}` +
        `${master.created ? ", created" : ""}${master.repaired ? ", repaired" : ""}).`
    );
  } catch (err) {
    console.error("Failed to ensure master admin:", err);
  }
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

app.listen(PORT, HOST, () => {
  console.log(`Dhapti API listening on http://${HOST}:${PORT}`);
  console.log(`Health: http://${HOST}:${PORT}/api/health`);
});
