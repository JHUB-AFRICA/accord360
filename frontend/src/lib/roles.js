export const ROLE_CONFIG = {
  researcher: {
    label: "JKUAT Champion",
    workspace: "Champion Workspace",
    home: "/champion",
    shortDescription: "Initiate collaborations, respond to feedback and report partnership activity."
  },
  approver: {
    label: "Department / Faculty Approver",
    workspace: "Department Approval Workspace",
    home: "/approvals",
    shortDescription: "Review academic fit and approve, return or reject requests within your scope."
  },
  linkages: {
    label: "Linkages Officer",
    workspace: "Linkages Operations Workspace",
    home: "/linkages",
    shortDescription: "Manage intake, routing, legal coordination, signing and activation."
  },
  director_linkages: {
    label: "Director, Linkages",
    workspace: "Linkages Directorate Workspace",
    home: "/linkages",
    shortDescription: "Oversee the portfolio, escalations, approvals, performance and renewal decisions."
  },
  legal: {
    label: "Legal Office Reviewer",
    workspace: "Legal Review Workspace",
    home: "/legal",
    shortDescription: "Review drafts, maintain feedback, approve legal versions and control legal status."
  },
  dvc: {
    label: "DVC RPE",
    workspace: "DVC RPE Endorsement Queue",
    home: "/dvc",
    shortDescription: "Endorse legally approved packages before submission to the Vice Chancellor."
  },
  vc_office: {
    label: "VC Office",
    workspace: "VC Signing Desk",
    home: "/signing",
    shortDescription: "Receive complete packages and track VC and partner signature milestones."
  },
  me: {
    label: "M&E Officer",
    workspace: "Monitoring & Evaluation Workspace",
    home: "/monitoring",
    shortDescription: "Track six-month reporting, deliverables, evidence, dormancy and value generated."
  },
  executive: {
    label: "Executive Viewer",
    workspace: "Executive Partnership Dashboard",
    home: "/executive",
    shortDescription: "View institutional partnership health, value, risk and performance without operational editing."
  },
  admin: {
    label: "System Administrator",
    workspace: "System Administration Console",
    home: "/admin",
    shortDescription: "Configure users, access, reference data and system controls without issuing business approvals."
  },
  auditor: {
    label: "Auditor / Read-only Reviewer",
    workspace: "Audit and Compliance Workspace",
    home: "/audit-workspace",
    shortDescription: "Review authorized records, reports and immutable audit history."
  }
};

export function roleConfig(role) {
  return ROLE_CONFIG[role] || {
    label: role || "User",
    workspace: "Accord 360 Workspace",
    home: "/",
    shortDescription: "Role-based institutional workspace."
  };
}

export function roleHome(role) {
  return roleConfig(role).home;
}
