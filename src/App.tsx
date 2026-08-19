import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { ScrollToHash } from "./components/common/ScrollToHash";
import {
  AboutPage,
  AdmissionsPage,
  AttendanceQrDisplayPage,
  AuthorityPage,
  CampusLifePage,
  ContactPage,
  CustomCmsPage,
  FacultiesPage,
  HomePage,
  NewsPage,
  ProgramsPage,
  VerifyCertificatePage,
} from "./pages/public";
import {
  StudentLoginPage,
  StudentDashboardPage,
  StudentProfilePage,
  StudentIdCardPage,
  StudentCoursesPage,
  StudentEvaluateTeacherPage,
  StudentAttendancePage,
  StudentAssignmentsPage,
  StudentQuizzesPage,
  StudentExamResultsPage,
  StudentResultsPage,
  StudentFeesPage,
  StudentDownloadFormsPage,
  StudentEducationMaterialsPage,
  StudentAccountDetailsPage,
  StudentHostelFeesPage,
  StudentImprovementResultPage,
  StudentEligibleSubjectsPage,
  StudentAdmitCardPage,
  StudentRoutinePage,
  StudentMailPage,
  StudentSupportTicketPage,
  StudentBloodBankPage,
  StudentElectionsPage,
  StudentNotificationsPage,
} from "./pages/student";
import {
  TeacherLoginPage,
  TeacherDashboardPage,
  TeacherCoursesPage,
  TeacherMaterialsPage,
  TeacherClassesPage,
  TeacherStudentsPage,
  TeacherMyAttendancePage,
  TeacherStudentAttendancePage,
  TeacherPerformancePage,
  TeacherAssignmentsPage,
  TeacherQuizzesPage,
  TeacherGradesPage,
  TeacherCourseResultsPage,
  TeacherIdCardPage,
  TeacherProfilePage,
  TeacherNotificationsPage,
  TeacherQuestionsPage,
} from "./pages/teacher";
import {
  AdminLoginPage,
  AdminDashboardPage,
  AdminAnalyticsPage,
  AdminStudentsPage,
  AdminTeachersPage,
  AdminTeacherPerformancePage,
  AdminFacultiesPage,
  AdminDepartmentDashboardPage,
  AdminCertificatesPage,
  AdminAuditLogsPage,
  AdminClassesPage,
  AdminEnrollmentsPage,
  AdminAttendancePage,
  AdminTeacherAttendancePage,
  AdminAttendanceLocationsPage,
  AdminGradesPage,
  AdminCourseResultsPage,
  AdminNotificationsPage,
  AdminAdmissionsPage,
  AdminFinancePage,
  AdminSettingsPage,
  AdminElectionsPage,
  AdminUsersPage,
  ExamControlDashboard,
  AdminCmsOverviewPage,
  AdminCmsSettingsPage,
  AdminCmsHomePage,
  AdminCmsPagesPage,
  AdminCmsCustomPagesPage,
  AdminCmsNewsPage,
  AdminCmsEventsPage,
  AdminCmsMediaPage,
  AdminCmsNavigationPage,
  AdminCmsFacultiesPage,
  AdminCmsProgramsPage,
} from "./pages/admin";
import {
  StudentDashboardLayout,
  TeacherDashboardLayout,
  AdminDashboardLayout,
} from "./layouts";
import { useAuth } from "./context/AuthContext";

function AdminIndexRedirect() {
  const { user } = useAuth();
  if (user?.role === "EXAM_ADMIN") {
    return <Navigate to="exam-control" replace />;
  }
  if (user?.role === "CERTIFICATE_ADMIN") {
    return <Navigate to="certificates" replace />;
  }
  if (user?.role === "DEPARTMENT_ADMIN") {
    return <Navigate to="department-dashboard" replace />;
  }
  return <Navigate to="dashboard" replace />;
}

function App() {
  return (
    <Router>
      <ScrollToHash />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/authority" element={<AuthorityPage />} />
        <Route path="/programs" element={<ProgramsPage />} />
        <Route path="/academics" element={<ProgramsPage />} />
        <Route path="/faculties" element={<FacultiesPage />} />
        <Route path="/campus-life" element={<CampusLifePage />} />
        <Route path="/news" element={<NewsPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/admissions" element={<AdmissionsPage />} />
        <Route path="/pages/:slug" element={<CustomCmsPage />} />
        <Route
          path="/attendance/display/:locationId"
          element={<AttendanceQrDisplayPage />}
        />
        <Route
          path="/verify/certificate/:code"
          element={<VerifyCertificatePage />}
        />

        <Route path="/student/login" element={<StudentLoginPage />} />
        <Route
          path="/student"
          element={
            <ProtectedRoute allowedRoles={["STUDENT"]} loginPath="/student/login" />
          }
        >
          <Route element={<StudentDashboardLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<StudentDashboardPage />} />
            <Route path="profile" element={<StudentProfilePage />} />
            <Route path="id-card" element={<StudentIdCardPage />} />
            <Route path="courses" element={<StudentCoursesPage />} />
            <Route path="evaluate-teacher" element={<StudentEvaluateTeacherPage />} />
            <Route path="attendance" element={<StudentAttendancePage />} />
            <Route path="assignments" element={<StudentAssignmentsPage />} />
            <Route path="quizzes" element={<StudentQuizzesPage />} />
            <Route path="notifications" element={<StudentNotificationsPage />} />
            <Route path="exam-results" element={<StudentExamResultsPage />} />
            <Route path="results" element={<StudentResultsPage />} />
            <Route path="improvement-result" element={<StudentImprovementResultPage />} />
            <Route path="eligible-subjects" element={<StudentEligibleSubjectsPage />} />
            <Route path="admit-card" element={<StudentAdmitCardPage />} />
            <Route path="fees" element={<StudentFeesPage />} />
            <Route path="account-details" element={<StudentAccountDetailsPage />} />
            <Route path="hostel-fees" element={<StudentHostelFeesPage />} />
            <Route path="routine" element={<StudentRoutinePage />} />
            <Route path="schedule" element={<StudentRoutinePage />} />
            <Route path="education-materials" element={<StudentEducationMaterialsPage />} />
            <Route path="download-forms" element={<StudentDownloadFormsPage />} />
            <Route path="mail" element={<StudentMailPage />} />
            <Route path="support-ticket" element={<StudentSupportTicketPage />} />
            <Route path="support" element={<StudentSupportTicketPage />} />
            <Route path="blood-bank" element={<StudentBloodBankPage />} />
            <Route path="elections" element={<StudentElectionsPage />} />
            <Route path="election" element={<Navigate to="/student/elections" replace />} />
          </Route>
        </Route>

        <Route path="/teacher/login" element={<TeacherLoginPage />} />
        <Route
          path="/teacher"
          element={
            <ProtectedRoute allowedRoles={["TEACHER"]} loginPath="/teacher/login" />
          }
        >
          <Route element={<TeacherDashboardLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<TeacherDashboardPage />} />
            <Route path="courses" element={<TeacherCoursesPage />} />
            <Route path="materials" element={<TeacherMaterialsPage />} />
            <Route path="classes" element={<TeacherClassesPage />} />
            <Route path="students" element={<TeacherStudentsPage />} />
            <Route path="attendance" element={<Navigate to="/teacher/student-attendance" replace />} />
            <Route path="my-attendance" element={<TeacherMyAttendancePage />} />
            <Route path="student-attendance" element={<TeacherStudentAttendancePage />} />
            <Route path="assignments" element={<TeacherAssignmentsPage />} />
            <Route path="quizzes" element={<TeacherQuizzesPage />} />
            <Route path="grading" element={<TeacherGradesPage />} />
            <Route path="course-results" element={<TeacherCourseResultsPage />} />
            <Route path="performance" element={<TeacherPerformancePage />} />
            <Route path="questions" element={<TeacherQuestionsPage />} />
            <Route path="id-card" element={<TeacherIdCardPage />} />
            <Route path="profile" element={<TeacherProfilePage />} />
            <Route path="notifications" element={<TeacherNotificationsPage />} />
          </Route>
        </Route>

        <Route path="/admin/login" element={<AdminLoginPage />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute
              allowedRoles={[
                "ADMIN",
                "DEPARTMENT_ADMIN",
                "EXAM_ADMIN",
                "CERTIFICATE_ADMIN",
              ]}
              loginPath="/admin/login"
            />
          }
        >
          <Route element={<AdminDashboardLayout />}>
            <Route index element={<AdminIndexRedirect />} />
            <Route path="dashboard" element={<AdminDashboardPage />} />
            <Route path="exam-control" element={<ExamControlDashboard />} />
            <Route path="analytics" element={<AdminAnalyticsPage />} />
            <Route
              path="department-dashboard"
              element={<AdminDepartmentDashboardPage />}
            />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="students" element={<AdminStudentsPage />} />
            <Route path="teachers" element={<AdminTeachersPage />} />
            <Route path="teacher-performance" element={<AdminTeacherPerformancePage />} />
            <Route path="faculties" element={<AdminFacultiesPage />} />
            <Route path="classes" element={<AdminClassesPage />} />
            <Route path="enrollments" element={<AdminEnrollmentsPage />} />
            <Route path="attendance" element={<AdminAttendancePage />} />
            <Route
              path="teacher-attendance"
              element={<AdminTeacherAttendancePage />}
            />
            <Route
              path="attendance-locations"
              element={<AdminAttendanceLocationsPage />}
            />
            <Route path="grades" element={<AdminGradesPage />} />
            <Route path="grade-review" element={<Navigate to="/admin/course-results" replace />} />
            <Route path="results" element={<Navigate to="/admin/course-results" replace />} />
            <Route path="course-results" element={<AdminCourseResultsPage />} />
            <Route path="certificates" element={<AdminCertificatesPage />} />
            <Route path="audit-logs" element={<AdminAuditLogsPage />} />
            <Route path="notifications" element={<AdminNotificationsPage />} />
            <Route path="admissions" element={<AdminAdmissionsPage />} />
            <Route path="finance" element={<AdminFinancePage />} />
            <Route path="settings" element={<AdminSettingsPage />} />
            <Route path="elections" element={<AdminElectionsPage />} />
            <Route path="cms" element={<AdminCmsOverviewPage />} />
            <Route path="cms/settings" element={<AdminCmsSettingsPage />} />
            <Route path="cms/home" element={<AdminCmsHomePage />} />
            <Route path="cms/pages" element={<AdminCmsPagesPage />} />
            <Route path="cms/custom-pages" element={<AdminCmsCustomPagesPage />} />
            <Route path="cms/news" element={<AdminCmsNewsPage />} />
            <Route path="cms/events" element={<AdminCmsEventsPage />} />
            <Route path="cms/faculties" element={<AdminCmsFacultiesPage />} />
            <Route path="cms/programs" element={<AdminCmsProgramsPage />} />
            <Route path="cms/media" element={<AdminCmsMediaPage />} />
            <Route path="cms/navigation" element={<AdminCmsNavigationPage />} />
          </Route>
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
