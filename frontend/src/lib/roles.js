export const ROLE_CONFIG = {
  researcher: { label: "Researcher / Initiator", workspace: "Researcher Workspace", home: "/champion", shortDescription: "Create requests, resolve corrections and track your partnerships." },
  approver: { label: "Faculty / Department Approver", workspace: "Faculty Approval Workspace", home: "/approvals", shortDescription: "Review academic fit and return precise corrections." },
  linkages: { label: "Linkages Officer", workspace: "Linkages Operations", home: "/linkages", shortDescription: "Verify partners, assign Champions and coordinate the lifecycle." },
  director_linkages: { label: "Director, Linkages", workspace: "Directorate Leadership", home: "/linkages", shortDescription: "Oversee portfolio health, escalations and renewals." },
  legal: { label: "Legal Reviewer", workspace: "Legal Review Workspace", home: "/legal", shortDescription: "Review clauses, resolve comments and lock approved versions." },
  dvc: { label: "DVC RPE", workspace: "DVC RPE Endorsement", home: "/dvc", shortDescription: "Endorse complete legally approved packages." },
  vc_office: { label: "VC Office", workspace: "VC Submission & Signing", home: "/signing", shortDescription: "Manage governance packages and signature tracking." },
  me: { label: "Champion / M&E Officer", workspace: "Monitoring & Evaluation", home: "/monitoring", shortDescription: "Report outputs, evidence, scores and expiry risk." },
  executive: { label: "Executive Viewer", workspace: "Executive Portfolio", home: "/executive", shortDescription: "View institutional performance and risk." },
  admin: { label: "System Administrator", workspace: "Administration Console", home: "/admin", shortDescription: "Manage access, configuration and system controls." },
  auditor: { label: "Auditor", workspace: "Audit & Compliance", home: "/audit-workspace", shortDescription: "Review authorized records and immutable history." }
};
export function roleConfig(role) { return ROLE_CONFIG[role] || { label: role || "User", workspace: "Accord360", home: "/", shortDescription: "Role-based workspace." }; }
export function roleHome(role) { return roleConfig(role).home; }
