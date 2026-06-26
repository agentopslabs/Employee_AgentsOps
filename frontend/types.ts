export enum UserRole {
  ADMIN = "admin",
  EMPLOYEE = "employee",
}

export enum UserStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
}

export interface User {
  id: string;
  name: string;
  email: string;
  mobile: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
}

export enum ApplicationStatus {
  NOT_STARTED = "not_started",
  DRAFT = "draft",
  SUBMITTED = "submitted",
  APPROVED = "approved",
  REJECTED = "rejected",
}

export interface Application {
  employeeId: string;
  fullName: string;
  email: string;
  mobile: string;
  gender: string;
  highestQualification: string;
  collegeName: string;
  yearOfPassing: string;
  percentageOrCgpa?: string;
  technicalSkills: string[];
  otherSkills: string[];
  status: ApplicationStatus;
  submittedAt?: string;
  updatedAt: string;
  googleDriveLink?: string;
  submittedDocs?: string[];
}

export enum DocumentStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
}

export interface EmployeeDocument {
  id: string;
  employeeId: string;
  type: "resume" | "aadhaar" | "pan" | "photo" | "educational" | "experience";
  fileName: string;
  fileSize: string;
  status: DocumentStatus;
  uploadedAt: string;
  remarks?: string;
  url: string; // Base64 or mock blob URL
}

export enum QuestionType {
  SINGLE_CHOICE = "single_choice",
  MULTIPLE_CHOICE = "multiple_choice",
  TRUE_FALSE = "true_false",
}

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  options: string[];
  correctAnswers: number[]; // Index of options
  moduleName?: string;
}

export interface Test {
  id: string;
  name: string;
  duration: number; // Mins
  passingMarks: number;
  questions: Question[];
  isPublished: boolean;
  createdAt: string;
}

export enum TestStatus {
  NOT_STARTED = "not_started",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
}

export interface AssignedTest {
  id: string; // unique assigned test id
  testId: string;
  testName: string;
  employeeId: string;
  status: TestStatus;
  score?: number;
  totalQuestions?: number;
  passingMarks?: number;
  passed?: boolean;
  answers?: Record<string, number[]>; // questionId -> selectedOptionIndices
  remainingTime?: number; // local state tracker, in seconds
  startedAt?: string;
  completedAt?: string;
  assignedAt?: string;
  isDefaultOnboardingTest?: boolean;
}

export interface ChecklistItem {
  id: string;
  employeeId: string;
  category: "application" | "documents" | "assessments" | "approval";
  text: string;
  isCompleted: boolean;
  updatedAt: string;
}

export interface ActivityLog {
  id: string;
  employeeId: string;
  employeeName: string;
  action: string;
  details: string;
  timestamp: string;
}

export interface EmailRecord {
  id: string;
  to: string;
  subject: string;
  body: string;
  sentAt: string;
  type: string; // "welcome" | "test_assigned" | "test_completed" | "pass" | "fail" | "doc_approved" etc.
}

export interface SystemNotification {
  id: string;
  employeeId?: string; // empty means global or for admins
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  type: "info" | "success" | "warning" | "alert";
}

export interface DocumentAnnotation {
  id: string;
  documentId: string;
  x: number; // percentage coordinate (0-100)
  y: number; // percentage coordinate (0-100)
  width?: number; // percentage width for highlights (0-100)
  height?: number; // percentage height for highlights (0-100)
  text: string;
  author: string;
  createdAt: string;
  color: string; // e.g. "#fbbf24" (amber), "#ef4444" (rose), "#06b6d4" (cyan), "#22c55e" (green)
  type: "comment" | "highlight";
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  subject: string;
  body: string;
  createdAt: string;
  isRead: boolean;
  type: string;
}

export interface TaskAttachment {
  name: string;
  size: string;
  url: string; // Base64 Data URL or link
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assignedTo: string; // "all" or specific employee ID
  files: TaskAttachment[];
  createdAt: string;
  status: string;
}

export interface TaskSubmission {
  id: string;
  taskId: string;
  employeeId: string;
  employeeName: string;
  submittedText: string;
  files: TaskAttachment[];
  status: "pending" | "approved" | "rejected";
  submittedAt: string;
  reviewedAt?: string;
  remarks?: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string; // YYYY-MM-DD
  status: "pending" | "approved" | "rejected";
  submittedAt: string;
  approvedAt?: string;
  remarks?: string;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  leaveType: "instant" | "oneday_before" | "oneweek_before";
  reason: string;
  status: "pending" | "approved" | "rejected";
  submittedAt: string;
  reviewedAt?: string;
  remarks?: string;
}

