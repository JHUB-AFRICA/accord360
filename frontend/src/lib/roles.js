export const ROLE_CONFIG = {
  partner: {
    label: "External Partner",
    workspace: "Partner Collaboration Portal",
    home: "/partner/dashboard",
    shortDescription: "Track shared requests, complete required actions and exchange approved documents.",
    scope: "partner"
  },
  researcher: {
    label: "Researcher / Initiator",
    workspace: "Researcher & Champion Workspace",
    home: "/researcher",
    shortDescription: "Initiate collaborations, respond to corrections and track assigned partnerships.",
    scope: "own"
  },
  approver: {
    label: "Faculty / Department Approver",
    workspace: "Faculty Approval Workspace",
    home: "/approvals",
    shortDescription: "Review academic fit and expected outcomes within your faculty scope.",
    scope: "faculty"
  },
  linkages: {
    label: "Linkages Officer",
    workspace: "Linkages Operations Workspace",
    home: "/linkages",
    shortDescription: "Verify partners, coordinate reviews and move complete records through the lifecycle.",
    scope: "all"
  },
  director_linkages: {
    label: "Director, Linkages",
    workspace: "Directorate Portfolio Workspace",
    home: "/director",
    shortDescription: "Oversee portfolio health, escalations, performance and renewal decisions.",
    scope: "all"
  },
  legal: {
    label: "Legal Reviewer",
    workspace: "Legal Review Workspace",
    home: "/legal",
    shortDescription: "Review clauses, manage amendments and lock the approved legal version.",
    scope: "assigned"
  },
  dvc: {
    label: "DVC RPE",
    workspace: "DVC RPE Endorsement Workspace",
    home: "/dvc",
    shortDescription: "Endorse legally approved packages before VC submission.",
    scope: "assigned"
  },
  vc_office: {
    label: "VC Office",
    workspace: "VC Submission & Signing Workspace",
    home: "/signing",
    shortDescription: "Manage complete submission packages and JKUAT/partner signature milestones.",
    scope: "assigned"
  },
  me: {
    label: "M&E Officer",
    workspace: "Monitoring & Evaluation Workspace",
    home: "/monitoring",
    shortDescription: "Validate six-month reports, evidence, deliverables and partnership scores.",
    scope: "active"
  },
  executive: {
    label: "Executive Viewer",
    workspace: "Executive Partnership Dashboard",
    home: "/executive",
    shortDescription: "View portfolio performance, risk and value without operational editing.",
    scope: "read_all"
  },
  admin: {
    label: "System Administrator",
    workspace: "System Administration Console",
    home: "/admin",
    shortDescription: "Manage users, reference data and configuration without business approvals.",
    scope: "admin"
  },
  auditor: {
    label: "Auditor",
    workspace: "Audit & Compliance Workspace",
    home: "/audit-workspace",
    shortDescription: "Review authorized records and immutable audit history without editing.",
    scope: "read_all"
  }
};

export const ALL_ROLES = Object.keys(ROLE_CONFIG);
export const INTERNAL_ROLES = ALL_ROLES.filter((role) => role !== "partner");
export const READ_ONLY_ROLES = ["executive", "auditor"];

export function roleConfig(role) {
  return ROLE_CONFIG[role] || {
    label: role || "User",
    workspace: "Accord360 Workspace",
    home: "/",
    shortDescription: "Role-based institutional workspace.",
    scope: "none"
  };
}

export function roleHome(role) {
  return roleConfig(role).home;
}

export function canCreateAgreement(role) {
  return ["researcher", "linkages", "director_linkages"].includes(role);
}

export function canViewAllAgreements(role) {
  return ["linkages", "director_linkages", "executive", "admin", "auditor"].includes(role);
}
