from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import audit, require_roles
from ..models import FAQEntry, User
from ..schemas import ChatAsk, FAQCreate, FAQOut

router = APIRouter(prefix="/chatbot", tags=["Guidance Chatbot"])

# BR-008: the assistant answers process questions only and never gives legal advice.
LEGAL_ADVICE_PATTERNS = [
    "legal advice", "sue", "lawsuit", "liab", "indemn", "is this clause", "interpret",
    "legally binding", "can we be held", "breach of contract", "legal opinion", "court",
    "what does clause", "enforce",
]

GUARD_REPLY = (
    "I can explain how the partnership process works, but I can't provide legal advice or "
    "interpret contract clauses. For legal questions, please contact the JKUAT Legal Office "
    "through the Directorate of Linkages (linkages@jkuat.ac.ke), or raise it in the agreement's "
    "legal feedback thread if you are a registered Champion."
)

FALLBACK_REPLY = (
    "I don't have an answer for that yet. I can help with: starting a partnership, MoU/CRA/CA "
    "differences, the approval workflow (Legal, DVC RPE and VC), templates, six-month M&E reports, "
    "and renewals. You can also contact the Directorate of Linkages at linkages@jkuat.ac.ke."
)


STOPWORDS = {
    "the", "and", "for", "are", "can", "you", "with", "this", "that", "does", "about",
    "when", "where", "why", "will", "have", "has", "was", "were", "they", "them", "their",
    "our", "your", "but", "not", "any", "all", "get", "what", "who", "how", "into", "from",
    "there", "here", "one", "two", "use", "need", "needed", "between", "before", "after",
}


def _tokenize(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z]{3,}", text.lower()) if w not in STOPWORDS}


@router.get("/faqs", response_model=list[FAQOut])
def list_faqs(db: Session = Depends(get_db)):
    """Public endpoint: the FAQ list also renders on the landing page."""
    return db.scalars(select(FAQEntry).where(FAQEntry.is_active.is_(True)).order_by(FAQEntry.category, FAQEntry.id)).all()


@router.post("/ask")
def ask(payload: ChatAsk, db: Session = Depends(get_db)):
    question = payload.question.strip().lower()

    for pattern in LEGAL_ADVICE_PATTERNS:
        if pattern in question:
            return {"answer": GUARD_REPLY, "matched_question": None, "related": [], "guarded": True}

    tokens = _tokenize(question)
    best, best_score = None, 0.0
    scored: list[tuple[float, FAQEntry]] = []
    for faq in db.scalars(select(FAQEntry).where(FAQEntry.is_active.is_(True))).all():
        keywords = _tokenize(faq.keywords.replace(",", " ")) | _tokenize(faq.question)
        if not keywords:
            continue
        overlap = len(tokens & keywords)
        all_words = set(re.findall(r"[a-z]+", question))
        keyword_hits = sum(1 for k in faq.keywords.lower().split(",") if k.strip() and k.strip() in all_words)
        score = overlap + keyword_hits * 2
        scored.append((score, faq))
        if score > best_score:
            best, best_score = faq, score

    if not best or best_score < 2:
        return {"answer": FALLBACK_REPLY, "matched_question": None, "related": [], "guarded": False}

    related = [f.question for score, f in sorted(scored, key=lambda x: -x[0])[1:4] if score >= 2 and f.id != best.id]
    return {"answer": best.answer, "matched_question": best.question, "related": related, "guarded": False}


@router.post("/faqs", response_model=FAQOut, status_code=status.HTTP_201_CREATED)
def create_faq(
    payload: FAQCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("admin")),
):
    item = FAQEntry(**payload.model_dump())
    db.add(item)
    db.flush()
    audit(db, actor, "create_faq", "faq", item.id, request, new_value=item.question)
    db.commit()
    db.refresh(item)
    return item


@router.put("/faqs/{faq_id}", response_model=FAQOut)
def update_faq(
    faq_id: int,
    payload: FAQCreate,
    request: Request,
    db: Session = Depends(get_db),
    actor: User = Depends(require_roles("admin")),
):
    item = db.get(FAQEntry, faq_id)
    if not item:
        raise HTTPException(status_code=404, detail="FAQ not found")
    for key, value in payload.model_dump().items():
        setattr(item, key, value)
    audit(db, actor, "update_faq", "faq", item.id, request, new_value=item.question)
    db.commit()
    db.refresh(item)
    return item
