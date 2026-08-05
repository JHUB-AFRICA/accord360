import { ArrowRight, Building2, CheckCircle2, FileCheck2, FileSignature, Gavel, GraduationCap, Landmark, LineChart, ShieldCheck, Users } from "lucide-react";
import { Link } from "react-router-dom";

const agreementTypes = [
  { code: "MoU", title: "Memorandum of Understanding", text: "A broad framework for academic, research or institutional cooperation." },
  { code: "MoA", title: "Memorandum of Agreement", text: "An operational agreement with defined obligations, resources and measurable commitments." },
  { code: "CRA", title: "Collaborative Research Agreement", text: "A research framework covering protocols, intellectual property, data and project milestones." },
  { code: "CA", title: "Configurable agreement type", text: "The official definition will be published after stakeholder and Legal Office confirmation." }
];

const process = ["Submit request", "Verify partner", "Assign Champion", "Faculty review", "Linkages review", "Legal review", "DVC RPE & VC", "Signing", "Activation & M&E", "Renewal or closure"];

export default function LandingPage() {
  return (
    <>
      <section className="hero-section">
        <div className="hero-grid">
          <div className="hero-copy">
            <span className="hero-kicker">Official partnership lifecycle portal</span>
            <h1>Accountable university partnerships from inquiry to measurable impact.</h1>
            <p>Accord360 supports the Directorate of Linkages (RPE) to register partners, manage agreements, coordinate institutional approvals, track signing and monitor collaboration outcomes.</p>
            <div className="hero-actions"><Link className="primary-button large-button" to="/partner/register">Start a partnership request <ArrowRight size={18} /></Link><Link className="secondary-button large-button" to="/login">Sign in to workspace</Link></div>
            <div className="hero-trust"><span><ShieldCheck size={17} /> Role-based access</span><span><FileCheck2 size={17} /> Traceable approvals</span><span><LineChart size={17} /> Measurable outcomes</span></div>
          </div>
          <div className="hero-visual" aria-label="Accord360 workflow preview">
            <div className="hero-visual-header"><span>JKUAT/ACC/2026/0041</span><b>Legal review</b></div>
            <h2>Digital Agriculture Research Collaboration</h2>
            <p>East Africa Institute of Technology</p>
            <div className="hero-status-row"><span className="visual-pill green"><CheckCircle2 size={15} /> Faculty approved</span><span className="visual-pill blue"><Gavel size={15} /> Legal review</span></div>
            <div className="hero-workflow">
              {["Partner verified", "Champion assigned", "Faculty approved", "Linkages approved", "Legal review", "DVC RPE", "VC signing"].map((item, index) => <div className={index < 4 ? "done" : index === 4 ? "active" : ""} key={item}><span>{index < 4 ? "✓" : index + 1}</span><b>{item}</b></div>)}
            </div>
          </div>
        </div>
      </section>

      <section id="about" className="public-section two-column-section">
        <div><span className="section-kicker">About the Directorate</span><h2>Coordinating credible, strategic and compliant partnerships.</h2><p>The Directorate of Linkages (RPE) coordinates institutional relationships across academia, government, industry, development partners and civil society. Accord360 supports institutional compliance, accountability, legal review and continuous performance monitoring.</p></div>
        <div className="feature-stack"><article><Building2 /><div><h3>Partner assurance</h3><p>Verify institutional legitimacy, registration evidence, accreditation and duplication risk.</p></div></article><article><Users /><div><h3>Clear ownership</h3><p>Assign an internal JKUAT Champion and identify responsible offices at every stage.</p></div></article><article><FileSignature /><div><h3>Governed execution</h3><p>Separate Faculty, Linkages, Legal, DVC RPE and VC responsibilities.</p></div></article></div>
      </section>

      <section id="agreement-types" className="public-section soft-section">
        <div className="section-heading-public"><span className="section-kicker">Agreement frameworks</span><h2>Supported collaboration instruments</h2><p>Agreement types and document requirements are centrally configured and governed.</p></div>
        <div className="agreement-type-grid">{agreementTypes.map((item) => <article key={item.code}><span>{item.code}</span><h3>{item.title}</h3><p>{item.text}</p></article>)}</div>
      </section>

      <section id="process" className="public-section">
        <div className="section-heading-public"><span className="section-kicker">Lifecycle clarity</span><h2>One connected process from first contact to renewal.</h2><p>Users always see the current stage, responsible office, required action and next gate.</p></div>
        <div className="public-process">{process.map((item, index) => <div key={item}><span>{index + 1}</span><b>{item}</b></div>)}</div>
      </section>

      <section id="eligibility" className="public-section soft-section">
        <div className="eligibility-grid"><div><span className="section-kicker">Partner eligibility</span><h2>Who may propose a collaboration?</h2><div className="eligibility-list"><span><GraduationCap /> Accredited universities and recognized institutions</span><span><Landmark /> Government and public research bodies</span><span><Building2 /> Certified industry and private-sector partners</span><span><Users /> NGOs, foundations and development partners</span></div></div><div className="document-card-public"><h3>Typical supporting documents</h3><ul><li>Registration certificate, charter or accreditation evidence</li><li>Partnership concept note and proposed outcomes</li><li>Profiles of JKUAT and partner project leads</li><li>Financial plan for MoA and CRA requests</li><li>Draft work plan and risk information</li></ul><Link to="/partner/register">Begin registration <ArrowRight size={16} /></Link></div></div>
      </section>

      <section id="faq" className="public-section">
        <div className="section-heading-public"><span className="section-kicker">Frequently asked questions</span><h2>Before you begin</h2></div>
        <div className="faq-grid"><details open><summary>Who can initiate a partnership?</summary><p>An external institution may register an inquiry, while authorized JKUAT staff can create internal requests. Partner-originated requests require an assigned internal JKUAT Champion before drafting proceeds.</p></details><details><summary>What happens after registration?</summary><p>The Directorate of Linkages reviews institutional details and supporting evidence, records a verification decision and assigns a Champion where appropriate.</p></details><details><summary>Can a record be returned for correction?</summary><p>Yes. Every return identifies the exact field, document or clause requiring attention, the responsible user and the due date.</p></details><details><summary>How are active partnerships monitored?</summary><p>Champions submit six-month reports, evidence and deliverable updates. Linkages validates reports and the platform maintains configurable partnership scorecards.</p></details></div>
      </section>

      <section className="public-cta"><div><h2>Ready to propose a collaboration?</h2><p>Register your institution and submit the initial partnership interest for Directorate review.</p></div><Link className="primary-button light-button" to="/partner/register">Start partnership request <ArrowRight size={18} /></Link></section>
    </>
  );
}
