from sqlalchemy.orm import Session
from app.models.models import Visitor

class VisitorService:
    @staticmethod
    def add_to_watchlist(db: Session, fullname: str, passport: str, nationality: str, photo_path: str, status: str = 'BLACKLISTED') -> Visitor:
        db_vis = Visitor(
            fullname=fullname,
            passport_number=passport,
            nationality=nationality,
            photo_path=photo_path,
            status=status
        )
        db.add(db_vis)
        db.commit()
        db.refresh(db_vis)
        return db_vis
