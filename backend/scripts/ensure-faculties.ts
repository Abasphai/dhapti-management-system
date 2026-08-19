import { ensureBiuFacultyCatalog } from "../src/lib/ensureBiuFacultyCatalog.js";

const rows = await ensureBiuFacultyCatalog();
console.log(`Ensured ${rows.length} faculties:`);
for (const f of rows) {
  console.log(
    `  - ${f.code}: ${f.name} (${f.departments.length} depts, ${f.status})`
  );
}
