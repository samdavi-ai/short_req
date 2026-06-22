"""Auth routes — login, register, get current user."""

from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Query, Request
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from sqlalchemy.orm import Session
from datetime import datetime, timezone
from typing import Optional

from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token, decode_access_token
from app.core.config import settings
from app.models.models import User
from app.schemas.schemas import UserCreate, UserResponse, TokenResponse
from app.models.models import AuditLog

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

def log_audit(db: Session, user_id: int, action: str, resource_type: str, resource_id: str, details: dict):
    """Helper to record an audit log."""
    log_entry = AuditLog(
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details
    )
    db.add(log_entry)
    db.commit()

def get_current_user(
    token: Optional[str] = Depends(oauth2_scheme),
    token_query: Optional[str] = Query(None, alias="token"),
    db: Session = Depends(get_db),
) -> User:
    """Decode JWT and return the authenticated user."""
    active_token = token or token_query
    if not active_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    payload = decode_access_token(active_token)
    username: str = payload.get("sub")
    user = db.query(User).filter(User.username == username, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


def require_role(*roles: str):
    """Dependency factory to enforce role-based access control."""
    def _check(
        request: Request,
        current_user: User = Depends(get_current_user),
        db: Session = Depends(get_db)
    ):
        if current_user.role not in roles:
            ip_address = request.client.host if request.client else "unknown"
            user_agent = request.headers.get("user-agent", "unknown")
            log_audit(
                db, 
                current_user.id, 
                "UNAUTHORIZED_ACCESS", 
                "Route", 
                None, 
                {
                    "username": current_user.username,
                    "required_roles": list(roles),
                    "user_role": current_user.role,
                    "ip_address": ip_address,
                    "user_agent": user_agent,
                }
            )
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of roles: {roles}",
            )
        return current_user
    return _check


@router.post("/register", response_model=UserResponse, status_code=201)
def register_user(user_in: UserCreate, db: Session = Depends(get_db)):
    """Register a new operator/supervisor account."""
    if db.query(User).filter(User.username == user_in.username).first():
        raise HTTPException(status_code=400, detail="Username already registered")
    if db.query(User).filter(User.email == user_in.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    db_user = User(
        username=user_in.username,
        email=user_in.email,
        full_name=user_in.full_name,
        hashed_password=hash_password(user_in.password),
        role=user_in.role,
        department=user_in.department,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    log_audit(db, db_user.id, "REGISTER_USER", "User", str(db_user.id), {"username": db_user.username, "role": db_user.role})

    return db_user


@router.post("/login", response_model=TokenResponse)
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    """Authenticate and return a JWT access token."""
    user = db.query(User).filter(User.username == form_data.username).first()
    ip_address = request.client.host if request.client else "unknown"
    if not user or not verify_password(form_data.password, user.hashed_password):
        if user:
            log_audit(db, user.id, "FAILED_LOGIN", "User", str(user.id), {"username": form_data.username, "reason": "Invalid password", "ip_address": ip_address})
        else:
            log_audit(db, None, "FAILED_LOGIN", "User", None, {"username": form_data.username, "reason": "User not found", "ip_address": ip_address})
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        log_audit(db, user.id, "FAILED_LOGIN", "User", str(user.id), {"username": form_data.username, "reason": "Account disabled", "ip_address": ip_address})
        raise HTTPException(status_code=403, detail="Account is disabled")

    # Update last_login
    user.last_login = datetime.now(timezone.utc)
    db.commit()

    log_audit(db, user.id, "LOGIN", "User", str(user.id), {"username": user.username, "ip_address": ip_address})

    expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    token = create_access_token(
        subject=user.username,
        expires_delta=expires,
        extra_claims={"role": user.role},
    )

    return TokenResponse(
        access_token=token,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        user=user,
    )

from pydantic import BaseModel
class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

@router.post("/change-password")
def change_password(
    req: ChangePasswordRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Change user password."""
    ip_address = request.client.host if request.client else "unknown"
    if not verify_password(req.current_password, current_user.hashed_password):
        log_audit(db, current_user.id, "FAILED_PASSWORD_CHANGE", "User", str(current_user.id), {"reason": "Incorrect current password", "ip_address": ip_address})
        raise HTTPException(status_code=400, detail="Incorrect current password")
    
    if len(req.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long")
        
    current_user.hashed_password = hash_password(req.new_password)
    db.commit()
    
    log_audit(db, current_user.id, "PASSWORD_CHANGED", "User", str(current_user.id), {"ip_address": ip_address})
    return {"message": "Password changed successfully"}

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """Return the currently authenticated user's profile."""
    return current_user
