from sqlalchemy.orm import Session
from app.models.models import Layout

class LayoutService:
    @staticmethod
    def save_layout(db: Session, floor_num: int, image_path: str) -> Layout:
        db_layout = db.query(Layout).filter(Layout.floor_num == floor_num).first()
        if not db_layout:
            db_layout = Layout(floor_num=floor_num, image_path=image_path)
            db.add(db_layout)
        else:
            db_layout.image_path = image_path
        db.commit()
        db.refresh(db_layout)
        return db_layout
