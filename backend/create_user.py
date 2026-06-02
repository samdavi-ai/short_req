import os
from sqlalchemy.orm import Session
from app.core.database import SessionLocal, engine, Base
from app.models.models import User
from app.core.security import hash_password

def create_admin():
    # Ensure tables exist
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    
    print("Checking for existing admin user...")
    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.username == "admin").first()
        if not user:
            print("Seeding admin user...")
            user = User(
                username="admin",
                email="admin@securewatch.com",
                full_name="System Administrator",
                hashed_password=hash_password("password123"),
                role="admin",
                department="IT & Security",
                is_active=True
            )
            db.add(user)
            db.commit()
            print("Successfully created user 'admin' with password 'password123' ✓")
        else:
            print("User 'admin' already exists.")
    except Exception as e:
        print(f"Error seeding user: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    create_admin()
