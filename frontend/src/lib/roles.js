// TODO(spec): REBUILD_BRIEF.md Section 2.1 names the champion-side role
// "champion", but this codebase still calls it "researcher" everywhere
// (routes, ROLE_CONFIG key, RoleRoute guards). Renaming it is Phase 1 work,
// not this Phase 0 subtractive pass, so the key is left as "researcher" here
// — flagging so a human can confirm this is the same role before Phase 1
// proceeds.
export const ROLE_CONFIG = {
  researcher: {
    label: "Researcher / Initiator",
    workspace: "Researcher & Champion Workspace",
    home: "/researcher",
    shortDescription: "Initiate collaborations, respond to corrections and track assigned partnerships.",
    scope: "own"
  },
  linkages: {
    label: "Linkages Officer",
    workspace: "Linkages Operations Workspace",
    home: "/linkages",
    shortDescription: "Coordinate partner records, reviews and agreement hand-offs.",
    scope: "all"
  },
  legal: {
    label: "Legal Reviewer",
    workspace: "Legal Review Workspace",
    home: "/legal",
    shortDescription: "Review clauses, return amendments and approve legally complete drafts.",
    scope: "assigned"
  },
  me: {
    label: "M&E Officer",
    workspace: "Monitoring & Evaluation Workspace",
    home: "/monitoring",
    shortDescription: "Update deliverables, evidence and partnership value records.",
    scope: "active"
  }
};

export const ALL_ROLES = Object.keys(ROLE_CONFIG);
// All login roles are internal now that the external `partner` login role has
// been removed; kept as a separate export so call sites don't need to change.
export const INTERNAL_ROLES = ALL_ROLES;

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
  return ["researcher", "linkages"].includes(role);
}

export function canViewAllAgreements(role) {
  return ["linkages"].includes(role);
}
