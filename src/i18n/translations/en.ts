// Type for nested translation objects
type TranslationValue = string | Record<string, string>;

export interface Translations {
  nav: {
    dashboard: string;
    appointments: string;
    tests: string;
    procedures: string;
    medications: string;
    doctors: string;
    institutions: string;
    reminders: string;
    clinicalSummary: string;
    settings: string;
    signOut: string;
  };
  actions: {
    add: string;
    edit: string;
    delete: string;
    save: string;
    cancel: string;
    view: string;
    back: string;
    close: string;
    print: string;
    saveAsPDF: string;
    saveChanges: string;
    create: string;
    confirm: string;
    search: string;
  };
  dashboard: {
    title: string;
    description: string;
    addAppointment: string;
    addTest: string;
    addMedication: string;
    noHealthItems: string;
    noHealthItemsDescription: string;
    upcoming: string;
    timeline: string;
    upcomingAppointments: string;
    activeMedications: string;
    viewAll: string;
    editInMedications: string;
    editInReminders: string;
  };
  appointments: {
    title: string;
    description: string;
    addAppointment: string;
    newAppointment: string;
    editAppointment: string;
    noAppointments: string;
    noAppointmentsDescription: string;
    date: string;
    time: string;
    reason: string;
    reasonPlaceholder: string;
    notes: string;
    doctor: string;
    institution: string;
    status: string;
    selectDoctor: string;
    selectInstitution: string;
    searchDoctor: string;
    searchInstitution: string;
    noDoctor: string;
    noInstitution: string;
    addNewDoctor: string;
    addNewInstitution: string;
    backToAppointments: string;
    backToDashboard: string;
    dateRequired: string;
    upcoming: string;
    completed: string;
    cancelled: string;
    past: string;
    createAppointment: string;
  };
  tests: {
    title: string;
    description: string;
    addTest: string;
    newTest: string;
    editTest: string;
    noTests: string;
    noTestsDescription: string;
    type: string;
    typePlaceholder: string;
    date: string;
    status: string;
    institution: string;
    selectInstitution: string;
    notes: string;
    scheduled: string;
    done: string;
    resultReceived: string;
    typeRequired: string;
    dateRequired: string;
    createTest: string;
    backToTests: string;
  };
  procedures: {
    title: string;
    description: string;
    addProcedure: string;
    newProcedure: string;
    editProcedure: string;
    noProcedures: string;
    noProceduresDescription: string;
    type: string;
    title_field: string;
    titlePlaceholder: string;
    date: string;
    doctor: string;
    selectDoctor: string;
    institution: string;
    selectInstitution: string;
    notes: string;
    surgery: string;
    hospitalization: string;
    vaccine: string;
    allTypes: string;
    titleRequired: string;
    dateRequired: string;
    createProcedure: string;
    backToProcedures: string;
  };
  medications: {
    title: string;
    description: string;
    addMedication: string;
    newMedication: string;
    editMedication: string;
    noMedications: string;
    noMedicationsDescription: string;
    name: string;
    namePlaceholder: string;
    dose: string;
    dosePlaceholder: string;
    schedule: string;
    times: string;
    timesPlaceholder: string;
    startDate: string;
    endDate: string;
    status: string;
    notes: string;
    active: string;
    paused: string;
    completed: string;
    daily: string;
    weekly: string;
    asNeeded: string;
    nameRequired: string;
    doseRequired: string;
    timesRequired: string;
    deleteMedication: string;
    deleteMedicationDesc: string;
    noMedicationsTab: string;
  };
  doctors: {
    title: string;
    description: string;
    addDoctor: string;
    newDoctor: string;
    editDoctor: string;
    noDoctors: string;
    noDoctorsDescription: string;
    fullName: string;
    specialty: string;
    specialtyPlaceholder: string;
    phone: string;
    email: string;
    notes: string;
    revealContact: string;
    nameRequired: string;
  };
  institutions: {
    title: string;
    description: string;
    addInstitution: string;
    newInstitution: string;
    editInstitution: string;
    noInstitutions: string;
    noInstitutionsDescription: string;
    name: string;
    type: string;
    address: string;
    phone: string;
    notes: string;
    clinic: string;
    lab: string;
    hospital: string;
    other: string;
    nameRequired: string;
    addNewInstitution: string;
  };
  reminders: {
    title: string;
    description: string;
    addReminder: string;
    newReminder: string;
    editReminder: string;
    noReminders: string;
    noRemindersDescription: string;
    title_field: string;
    type: string;
    date: string;
    time: string;
    repeat: string;
    notes: string;
    checkup: string;
    appointmentFollowUp: string;
    testFollowUp: string;
    custom: string;
    none: string;
    daily: string;
    weekly: string;
    monthly: string;
    yearly: string;
    oneTime: string;
    repeatsDaily: string;
    repeatsWeekly: string;
    repeatsMonthly: string;
    repeatsYearly: string;
    titleRequired: string;
    dateRequired: string;
    pastReminder: string;
    saveAnyway: string;
  };
  clinicalSummary: {
    title: string;
    generatedOn: string;
    saveAsPDFHelper: string;
    includeVisits: string;
    nationalId: string;
    phone: string;
    email: string;
    insurance: string;
    allergies: string;
    notes: string;
    currentMedications: string;
    noActiveMedications: string;
    medication: string;
    dose: string;
    schedule: string;
    testsLast12: string;
    noTestsLast12: string;
    date: string;
    type: string;
    institution: string;
    files: string;
    surgeriesFullHistory: string;
    hospitalizationsLast12: string;
    vaccinesLast12: string;
    procedure: string;
    reason: string;
    noProcedures: string;
    visitsLast12: string;
    noVisitsLast12: string;
    doctor: string;
    last12months: string;
  };
  settings: {
    title: string;
    description: string;
    patientProfile: string;
    firstName: string;
    lastName: string;
    nationalId: string;
    phone: string;
    email: string;
    emailCannotChange: string;
    insuranceInfo: string;
    provider: string;
    plan: string;
    memberId: string;
    allergies: string;
    allergiesPlaceholder: string;
    notes: string;
    notesPlaceholder: string;
    saveProfile: string;
    deleteProfileData: string;
    deleteProfileTitle: string;
    deleteProfileDescription: string;
    notifications: string;
    inAppReminders: string;
    inAppRemindersDesc: string;
    emailReminders: string;
    emailRemindersDesc: string;
    timezone: string;
    saveSettings: string;
    security: string;
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
    updatePassword: string;
    dangerZone: string;
    dangerZoneDesc: string;
    deleteAccount: string;
    deleteAccountTitle: string;
    deleteAccountDescription: string;
    saving: string;
    updating: string;
    deleting: string;
    optional: string;
    required: string;
  };
  auth: {
    signIn: string;
    signUp: string;
    email: string;
    password: string;
    confirmPassword: string;
    forgotPassword: string;
    noAccount: string;
    hasAccount: string;
    signInButton: string;
    signUpButton: string;
    signingIn: string;
    signingUp: string;
  };
  dialogs: {
    deleteItem: string;
    deleteItemDescription: string;
  };
  form: {
    required: string;
    optional: string;
  };
  toast: {
    savedSuccess: string;
    changesUpdated: string;
    deletedSuccess: string;
    error: string;
    settingsSaved: string;
    profileSaved: string;
    profileDeleted: string;
    passwordUpdated: string;
    accountDeleted: string;
    doctorAdded: string;
    institutionAdded: string;
    dateRequired: string;
    titleRequired: string;
    nameRequired: string;
    typeRequired: string;
    doseRequired: string;
    firstNameRequired: string;
    lastNameRequired: string;
    passwordRequirements: string;
    passwordsNoMatch: string;
    signInAgain: string;
    failedAddDoctor: string;
    failedAddInstitution: string;
    couldNotSaveSettings: string;
    couldNotSaveProfile: string;
    couldNotDeleteProfile: string;
    couldNotUpdatePassword: string;
  };
  misc: {
    noLocation: string;
    appointment: string;
    loading: string;
    patient: string;
    fileUploadNotAvailable: string;
  };
}

export const en: Translations = {
  // Navigation
  nav: {
    dashboard: "Dashboard",
    appointments: "Appointments",
    tests: "Tests",
    procedures: "Procedures",
    medications: "Medications",
    doctors: "Doctors",
    institutions: "Institutions",
    reminders: "Reminders",
    clinicalSummary: "Clinical Summary",
    settings: "Settings",
    signOut: "Sign out",
  },
  
  // Common actions
  actions: {
    add: "Add",
    edit: "Edit",
    delete: "Delete",
    save: "Save",
    cancel: "Cancel",
    view: "View",
    back: "Back",
    close: "Close",
    print: "Print",
    saveAsPDF: "Save as PDF",
    saveChanges: "Save Changes",
    create: "Create",
    confirm: "Confirm",
    search: "Search",
  },
  
  // Dashboard
  dashboard: {
    title: "Dashboard",
    description: "Your health at a glance",
    addAppointment: "Add appointment",
    addTest: "Add test",
    addMedication: "Add medication",
    noHealthItems: "No health items yet",
    noHealthItemsDescription: "Add your first appointment, test, or medication to get started.",
    upcoming: "Upcoming",
    timeline: "Timeline",
    upcomingAppointments: "Upcoming Appointments",
    activeMedications: "Active Medications",
    viewAll: "View all",
    editInMedications: "Edit in Medications",
    editInReminders: "Edit in Reminders",
  },
  
  // Appointments
  appointments: {
    title: "Appointments",
    description: "Manage your medical appointments",
    addAppointment: "Add appointment",
    newAppointment: "New Appointment",
    editAppointment: "Edit Appointment",
    noAppointments: "No appointments yet",
    noAppointmentsDescription: "Add your first appointment to get started.",
    date: "Date",
    time: "Time",
    reason: "Reason",
    reasonPlaceholder: "e.g., Annual checkup",
    notes: "Notes",
    doctor: "Doctor",
    institution: "Institution",
    status: "Status",
    selectDoctor: "Select doctor...",
    selectInstitution: "Select institution...",
    searchDoctor: "Search doctor...",
    searchInstitution: "Search institution...",
    noDoctor: "No doctor found.",
    noInstitution: "No institution found.",
    addNewDoctor: "Add new doctor",
    addNewInstitution: "Add new institution",
    backToAppointments: "Back to appointments",
    backToDashboard: "Back to dashboard",
    dateRequired: "Date is required.",
    upcoming: "Upcoming",
    completed: "Completed",
    cancelled: "Cancelled",
    past: "Past",
    createAppointment: "Create Appointment",
  },
  
  // Tests
  tests: {
    title: "Tests",
    description: "Track your medical tests and results",
    addTest: "Add test",
    newTest: "New Test",
    editTest: "Edit Test",
    noTests: "No tests yet",
    noTestsDescription: "Add your first test to track your results.",
    type: "Type",
    typePlaceholder: "e.g., Blood test",
    date: "Date",
    status: "Status",
    institution: "Institution",
    selectInstitution: "Select institution",
    notes: "Notes",
    scheduled: "Scheduled",
    done: "Done",
    resultReceived: "Result received",
    typeRequired: "Type is required.",
    dateRequired: "Date is required.",
    createTest: "Create Test",
    backToTests: "Back to Tests",
  },
  
  // Procedures
  procedures: {
    title: "Procedures",
    description: "Track your surgeries, hospitalizations, and vaccines",
    addProcedure: "Add procedure",
    newProcedure: "New Procedure",
    editProcedure: "Edit Procedure",
    noProcedures: "No procedures yet",
    noProceduresDescription: "Add your first procedure to track your medical history.",
    type: "Type",
    title_field: "Title",
    titlePlaceholder: "e.g., Appendectomy",
    date: "Date",
    doctor: "Doctor",
    selectDoctor: "Select doctor",
    institution: "Institution",
    selectInstitution: "Select institution",
    notes: "Notes",
    surgery: "Surgery",
    hospitalization: "Hospitalization",
    vaccine: "Vaccine",
    allTypes: "All types",
    titleRequired: "Title is required.",
    dateRequired: "Date is required.",
    createProcedure: "Create Procedure",
    backToProcedures: "Back to Procedures",
  },
  
  // Medications
  medications: {
    title: "Medications",
    description: "Manage your medications and schedules",
    addMedication: "Add medication",
    newMedication: "New Medication",
    editMedication: "Edit Medication",
    noMedications: "No medications yet",
    noMedicationsDescription: "Add your first medication to track your treatment.",
    name: "Name",
    namePlaceholder: "e.g., Aspirin",
    dose: "Dose",
    dosePlaceholder: "e.g., 100mg",
    schedule: "Schedule",
    times: "Times (comma-separated)",
    timesPlaceholder: "e.g., 8:00, 20:00",
    startDate: "Start date",
    endDate: "End date",
    status: "Status",
    notes: "Notes",
    active: "Active",
    paused: "Paused",
    completed: "Completed",
    daily: "Daily",
    weekly: "Weekly",
    asNeeded: "As needed",
    nameRequired: "Name is required.",
    doseRequired: "Dose is required.",
    timesRequired: "Add at least one time.",
    deleteMedication: "Delete medication?",
    deleteMedicationDesc: "This action cannot be undone. The medication record will be permanently removed.",
    noMedicationsTab: "No medications",
  },
  
  // Doctors
  doctors: {
    title: "Doctors",
    description: "Manage your healthcare providers",
    addDoctor: "Add doctor",
    newDoctor: "New Doctor",
    editDoctor: "Edit Doctor",
    noDoctors: "No doctors yet",
    noDoctorsDescription: "Add your first doctor to keep track of your healthcare providers.",
    fullName: "Full name",
    specialty: "Specialty",
    specialtyPlaceholder: "e.g., Cardiology",
    phone: "Phone",
    email: "Email",
    notes: "Notes",
    revealContact: "Reveal contact information",
    nameRequired: "Name is required.",
  },
  
  // Institutions
  institutions: {
    title: "Institutions",
    description: "Manage your healthcare facilities",
    addInstitution: "Add institution",
    newInstitution: "New Institution",
    editInstitution: "Edit Institution",
    noInstitutions: "No institutions yet",
    noInstitutionsDescription: "Add your first institution to keep track of your healthcare facilities.",
    name: "Name",
    type: "Type",
    address: "Address",
    phone: "Phone",
    notes: "Notes",
    clinic: "Clinic",
    lab: "Lab",
    hospital: "Hospital",
    other: "Other",
    nameRequired: "Name is required.",
    addNewInstitution: "Add New Institution",
  },
  
  // Reminders
  reminders: {
    title: "Reminders",
    description: "Never miss an important health task",
    addReminder: "Add reminder",
    newReminder: "New Reminder",
    editReminder: "Edit Reminder",
    noReminders: "No reminders yet",
    noRemindersDescription: "Create reminders to stay on top of your health tasks.",
    title_field: "Title",
    type: "Type",
    date: "Date",
    time: "Time",
    repeat: "Repeat",
    notes: "Notes",
    checkup: "Checkup",
    appointmentFollowUp: "Appointment follow-up",
    testFollowUp: "Test follow-up",
    custom: "Custom",
    none: "None",
    daily: "Daily",
    weekly: "Weekly",
    monthly: "Monthly",
    yearly: "Yearly",
    oneTime: "One-time",
    repeatsDaily: "Repeats daily",
    repeatsWeekly: "Repeats weekly",
    repeatsMonthly: "Repeats monthly",
    repeatsYearly: "Repeats yearly",
    titleRequired: "Title is required.",
    dateRequired: "Date is required.",
    pastReminder: "This reminder is in the past",
    saveAnyway: "Save anyway?",
  },
  
  // Clinical Summary
  clinicalSummary: {
    title: "Clinical Summary",
    generatedOn: "Generated on",
    saveAsPDFHelper: "To download, choose \"Save as PDF\" in the print dialog.",
    includeVisits: "Include visits from the last 12 months",
    nationalId: "National ID",
    phone: "Phone",
    email: "Email",
    insurance: "Insurance",
    allergies: "Allergies",
    notes: "Notes",
    currentMedications: "Current Medications",
    noActiveMedications: "No active medications.",
    medication: "Medication",
    dose: "Dose",
    schedule: "Schedule",
    testsLast12: "Tests",
    noTestsLast12: "No tests in the last 12 months.",
    date: "Date",
    type: "Type",
    institution: "Institution",
    files: "Files",
    surgeriesFullHistory: "Surgeries (full history)",
    hospitalizationsLast12: "Hospitalizations (last 12 months)",
    vaccinesLast12: "Vaccines (last 12 months)",
    procedure: "Procedure",
    reason: "Reason",
    noProcedures: "No procedures recorded.",
    visitsLast12: "Visits",
    noVisitsLast12: "No visits in the last 12 months.",
    doctor: "Doctor",
    last12months: "(last 12 months)",
  },
  
  // Settings
  settings: {
    title: "Settings",
    description: "Manage your account and preferences",
    patientProfile: "Patient Profile",
    firstName: "First Name",
    lastName: "Last Name",
    nationalId: "National ID",
    phone: "Phone",
    email: "Email",
    emailCannotChange: "Email cannot be changed",
    insuranceInfo: "Insurance Information",
    provider: "Provider",
    plan: "Plan",
    memberId: "Member ID",
    allergies: "Allergies",
    allergiesPlaceholder: "List any known allergies...",
    notes: "Notes",
    notesPlaceholder: "Any additional health information...",
    saveProfile: "Save Profile",
    deleteProfileData: "Delete profile data",
    deleteProfileTitle: "Delete profile data?",
    deleteProfileDescription: "This will remove your personal profile details from this app.",
    notifications: "Notifications",
    inAppReminders: "In-app reminders",
    inAppRemindersDesc: "Show reminders within the app",
    emailReminders: "Email reminders",
    emailRemindersDesc: "Receive reminders via email",
    timezone: "Timezone",
    saveSettings: "Save settings",
    security: "Security",
    currentPassword: "Current password",
    newPassword: "New password",
    confirmPassword: "Confirm new password",
    updatePassword: "Update password",
    dangerZone: "Danger Zone",
    dangerZoneDesc: "Permanently delete your account and all data.",
    deleteAccount: "Delete account",
    deleteAccountTitle: "Delete account?",
    deleteAccountDescription: "This will permanently remove your data.",
    saving: "Saving...",
    updating: "Updating...",
    deleting: "Deleting...",
    optional: "Optional",
    required: "required",
  },
  
  // Auth
  auth: {
    signIn: "Sign In",
    signUp: "Sign Up",
    email: "Email",
    password: "Password",
    confirmPassword: "Confirm Password",
    forgotPassword: "Forgot password?",
    noAccount: "Don't have an account?",
    hasAccount: "Already have an account?",
    signInButton: "Sign in",
    signUpButton: "Sign up",
    signingIn: "Signing in...",
    signingUp: "Signing up...",
  },
  
  // Dialogs
  dialogs: {
    deleteItem: "Delete item?",
    deleteItemDescription: "This action cannot be undone.",
  },
  
  // Form labels
  form: {
    required: "required",
    optional: "Optional",
  },
  
  // Toast messages
  toast: {
    savedSuccess: "Saved successfully.",
    changesUpdated: "Changes updated.",
    deletedSuccess: "Deleted successfully.",
    error: "Something went wrong. Please try again.",
    settingsSaved: "Settings saved.",
    profileSaved: "Profile saved.",
    profileDeleted: "Profile data deleted.",
    passwordUpdated: "Password updated.",
    accountDeleted: "Account deleted",
    doctorAdded: "Doctor added!",
    institutionAdded: "Institution added!",
    dateRequired: "Date is required.",
    titleRequired: "Title is required.",
    nameRequired: "Name is required.",
    typeRequired: "Type is required.",
    doseRequired: "Dose is required.",
    firstNameRequired: "First name is required.",
    lastNameRequired: "Last name is required.",
    passwordRequirements: "New password must be at least 10 characters and include a number or symbol.",
    passwordsNoMatch: "Passwords do not match.",
    signInAgain: "For security reasons, please sign in again and retry.",
    failedAddDoctor: "Failed to add doctor",
    failedAddInstitution: "Failed to add institution",
    couldNotSaveSettings: "We couldn't save your settings. Please try again.",
    couldNotSaveProfile: "We couldn't save your profile. Please try again.",
    couldNotDeleteProfile: "We couldn't delete your profile data. Please try again.",
    couldNotUpdatePassword: "We couldn't update your password. Please try again.",
  },
  
  // Misc
  misc: {
    noLocation: "No location",
    appointment: "Appointment",
    loading: "Loading...",
    patient: "Patient",
    fileUploadNotAvailable: "File upload not available on mobile",
  },
};
