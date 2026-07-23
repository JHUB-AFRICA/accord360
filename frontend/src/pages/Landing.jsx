import { useEffect, useState } from "react";
import { ArrowRight, Building2, CheckCircle2, FileText, Globe2, Handshake, LineChart, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import ChatbotWidget from "../components/ChatbotWidget";
import { API_URL } from "../lib/api";

const steps = [
  { title: "Initiation", text: "A JKUAT Champion initiates the request, or Linkages logs a partner-originated approach and assigns a Champion." },
  { title: "Linkages review", text: "The Directorate verifies completeness, strategic fit and the right template for the partner category." },
  { title: "Legal review", text: "The Legal Office reviews the draft within a 21-day window, with structured feedback to the Champion." },
  { title: "DVC RPE & VC", text: "The DVC (Research, Production and Extension) endorses the package before submission for the Vice Chancellor's signature." },
  { title: "Active & M&E", text: "After signing, six-month activity reports and a weighted performance scorecard track real partnership impact." }
];

export default function Landing() {
  const [faqs, setFaqs] = useState([]);

  useEffect(() => {
    fetch(`${API_URL}/chatbot/faqs`).then((r) => r.json()).then(setFaqs).catch(() => {});
  }, []);

  return (
    <div className="landing-page">
      <header className="landing-header">
        <div className="landing-brand"><div className="brand-mark">A</div><div><strong>Accord 360</strong><span>JKUAT Directorate of Linkages</span></div></div>
        <Link to="/login" className="primary-button">Staff sign in <ArrowRight size={16} /></Link>
      </header>

      <section className="landing-hero">
        <div className="eyebrow eyebrow-light">Jomo Kenyatta University of Agriculture and Technology</div>
        <h1>Partner with JKUAT — governed, transparent, measurable.</h1>
        <p>
          The Directorate of Linkages manages every partnership agreement — MoUs, Collaborative Research
          Agreements and Collaboration Agreements — through one accountable lifecycle: from first request,
          through legal review and executive sign-off, to signed implementation and six-month performance reporting.
        </p>
        <div className="landing-hero-actions">
          <a className="secondary-button landing-cta" href="mailto:linkages@jkuat.ac.ke"><Handshake size={18} /> Propose a partnership</a>
          <Link className="secondary-button landing-cta" to="/login"><ShieldCheck size={18} /> Institutional workspace</Link>
        </div>
      </section>

      <section className="landing-cards">
        {[
          [Building2, "Who we partner with", "Universities, country and county governments, manufacturing industry, NGOs and development partners — each with tailored agreement templates."],
          [FileText, "Approved templates", "Standardised MoU, CRA and CA language per partner category, version-controlled through legal review."],
          [ShieldCheck, "Governed sign-off", "Legal approval and DVC RPE endorsement are completed before any package reaches the Vice Chancellor."],
          [LineChart, "Measured impact", "Six-month activity reports and a weighted scorecard keep every active partnership accountable."],
        ].map(([Icon, title, text]) => (
          <article className="panel landing-card" key={title}><div className="settings-icon"><Icon size={22} /></div><h3>{title}</h3><p>{text}</p></article>
        ))}
      </section>

      <section className="landing-steps">
        <h2>How a partnership becomes an agreement</h2>
        <div className="landing-step-grid">
          {steps.map((step, index) => (
            <div className="landing-step" key={step.title}>
              <span className="landing-step-number">{index + 1}</span>
              <strong>{step.title}</strong>
              <p>{step.text}</p>
            </div>
          ))}
        </div>
      </section>

      {faqs.length > 0 && (
        <section className="landing-faq">
          <h2>Frequently asked questions</h2>
          <div className="landing-faq-grid">
            {faqs.slice(0, 6).map((faq) => (
              <details key={faq.id} className="panel landing-faq-item">
                <summary>{faq.question}</summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </div>
        </section>
      )}

      <footer className="landing-footer">
        <div><Globe2 size={17} /> JKUAT Main Campus, Juja · linkages@jkuat.ac.ke</div>
        <div><CheckCircle2 size={15} /> Accord 360 — Agreement Lifecycle & Performance Management · Built by JHUB Africa</div>
      </footer>

      <ChatbotWidget />
    </div>
  );
}
