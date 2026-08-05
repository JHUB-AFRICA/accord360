export const ROLE_CONFIG = {
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
    shortDescription: "Review academic fit and expected outcomes within your department scope.",
    scope: "faculty"
  },
  linkages: {
    label: "Linkages Officer",
    workspace: "Linkages Operations Workspace",
    home: "/linkages",
    shortDescription: "Coordinate partner records, reviews and agreement hand-offs.",
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
    shortDescription: "Review clauses, return amendments and approve legally complete drafts.",
    scope: "assigned"
  },
  dvc: {
    label: "DVC RPE",
    workspace: "DVC RPE Endorsement Workspace",
    home: "/dvc",
    shortDescription: "Endorse legally approved packages before VC submission.",
    scope: "all_read"
  },
  vc_office: {
    label: "VC Office",
    workspace: "VC Submission & Signing Workspace",
    home: "/signing",
    shortDescription: "Manage VC signature and partner execution milestones.",
    scope: "signing"
  },
  executive: {
    label: "Executive Viewer",
    workspace: "Executive Partnership Dashboard",
    home: "/executive",
    shortDescription: "View portfolio performance, risk and value without operational editing.",
    scope: "read_all"
  },
  me: {
    label: "M&E Officer",
    workspace: "Monitoring & Evaluation Workspace",
    home: "/monitoring",
    shortDescription: "Update deliverables, evidence and partnership value records.",
    scope: "active"
  },
  admin: {
    label: "System Administrator",
    workspace: "System Administration Console",
    home: "/admin",
    shortDescription: "Manage users and inspect technical configuration without business approvals.",
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
export const INTERNAL_ROLES = ALL_ROLES;
export const READ_ONLY_ROLES = ["executive", "auditor", "admin"];

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
  return ["linkages", "director_linkages", "executive", "admin", "auditor", "dvc"].includes(role);
}
