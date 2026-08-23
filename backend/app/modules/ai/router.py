from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.deps import get_current_user
from app.modules.users.models import User

from . import service
from .schemas import ChatRequest, ChatResponse

router = APIRouter(prefix="/ai", tags=["AI Assistant"])


@router.post("/chat", response_model=ChatResponse)
def chat(payload: ChatRequest, user: User = Depends(get_current_user)) -> ChatResponse:
    try:
        session_id, message = service.chat(user.id, payload.session_id, payload.message)
    except service.AIConfigurationError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    except service.AIProviderError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc
    return ChatResponse(session_id=session_id, message=message)


@router.delete("/chat/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def clear_chat(session_id: str, user: User = Depends(get_current_user)) -> Response:
    service.clear_session(user.id, session_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
