-- Convert legacy Roman semester labels to numeric Semester 1–8.

UPDATE "Student" SET "semester" = 'Semester 1' WHERE "semester" = 'Semester I';
UPDATE "Student" SET "semester" = 'Semester 2' WHERE "semester" = 'Semester II';
UPDATE "Student" SET "semester" = 'Semester 3' WHERE "semester" = 'Semester III';
UPDATE "Student" SET "semester" = 'Semester 4' WHERE "semester" = 'Semester IV';
UPDATE "Student" SET "semester" = 'Semester 5' WHERE "semester" = 'Semester V';
UPDATE "Student" SET "semester" = 'Semester 6' WHERE "semester" = 'Semester VI';
UPDATE "Student" SET "semester" = 'Semester 7' WHERE "semester" = 'Semester VII';
UPDATE "Student" SET "semester" = 'Semester 8' WHERE "semester" = 'Semester VIII';

UPDATE "Course" SET "semester" = 'Semester 1' WHERE "semester" = 'Semester I';
UPDATE "Course" SET "semester" = 'Semester 2' WHERE "semester" = 'Semester II';
UPDATE "Course" SET "semester" = 'Semester 3' WHERE "semester" = 'Semester III';
UPDATE "Course" SET "semester" = 'Semester 4' WHERE "semester" = 'Semester IV';
UPDATE "Course" SET "semester" = 'Semester 5' WHERE "semester" = 'Semester V';
UPDATE "Course" SET "semester" = 'Semester 6' WHERE "semester" = 'Semester VI';
UPDATE "Course" SET "semester" = 'Semester 7' WHERE "semester" = 'Semester VII';
UPDATE "Course" SET "semester" = 'Semester 8' WHERE "semester" = 'Semester VIII';

UPDATE "ClassSection" SET "semester" = 'Semester 1' WHERE "semester" = 'Semester I';
UPDATE "ClassSection" SET "semester" = 'Semester 2' WHERE "semester" = 'Semester II';
UPDATE "ClassSection" SET "semester" = 'Semester 3' WHERE "semester" = 'Semester III';
UPDATE "ClassSection" SET "semester" = 'Semester 4' WHERE "semester" = 'Semester IV';
UPDATE "ClassSection" SET "semester" = 'Semester 5' WHERE "semester" = 'Semester V';
UPDATE "ClassSection" SET "semester" = 'Semester 6' WHERE "semester" = 'Semester VI';
UPDATE "ClassSection" SET "semester" = 'Semester 7' WHERE "semester" = 'Semester VII';
UPDATE "ClassSection" SET "semester" = 'Semester 8' WHERE "semester" = 'Semester VIII';

UPDATE "Payment" SET "semester" = 'Semester 1' WHERE "semester" = 'Semester I';
UPDATE "Payment" SET "semester" = 'Semester 2' WHERE "semester" = 'Semester II';
UPDATE "Payment" SET "semester" = 'Semester 3' WHERE "semester" = 'Semester III';
UPDATE "Payment" SET "semester" = 'Semester 4' WHERE "semester" = 'Semester IV';
UPDATE "Payment" SET "semester" = 'Semester 5' WHERE "semester" = 'Semester V';
UPDATE "Payment" SET "semester" = 'Semester 6' WHERE "semester" = 'Semester VI';
UPDATE "Payment" SET "semester" = 'Semester 7' WHERE "semester" = 'Semester VII';
UPDATE "Payment" SET "semester" = 'Semester 8' WHERE "semester" = 'Semester VIII';

UPDATE "SystemSetting" SET "value" = 'Semester 1' WHERE "key" = 'currentSemester' AND "value" = 'Semester I';
UPDATE "SystemSetting" SET "value" = 'Semester 2' WHERE "key" = 'currentSemester' AND "value" = 'Semester II';
UPDATE "SystemSetting" SET "value" = 'Semester 3' WHERE "key" = 'currentSemester' AND "value" = 'Semester III';
UPDATE "SystemSetting" SET "value" = 'Semester 4' WHERE "key" = 'currentSemester' AND "value" = 'Semester IV';
UPDATE "SystemSetting" SET "value" = 'Semester 5' WHERE "key" = 'currentSemester' AND "value" = 'Semester V';
UPDATE "SystemSetting" SET "value" = 'Semester 6' WHERE "key" = 'currentSemester' AND "value" = 'Semester VI';
UPDATE "SystemSetting" SET "value" = 'Semester 7' WHERE "key" = 'currentSemester' AND "value" = 'Semester VII';
UPDATE "SystemSetting" SET "value" = 'Semester 8' WHERE "key" = 'currentSemester' AND "value" = 'Semester VIII';
