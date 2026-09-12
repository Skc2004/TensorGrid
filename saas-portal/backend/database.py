from sqlalchemy import create_engine, Column, Integer, String, Boolean
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import sessionmaker

# IMPORTANT: Ensure your MySQL server is running and accessible at this URI.
# Update the credentials (root/password) as needed for your live environment.
SQLALCHEMY_DATABASE_URL = "mysql+pymysql://root:password@localhost/htcondor_grid"

try:
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
except Exception as e:
    print(f"Warning: Could not connect to MySQL. Is the server running? Error: {e}")
    # Fallback/mock engine just so the app doesn't crash on import if DB isn't running yet
    engine = None
    SessionLocal = None

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default="student") # admin, faculty, student
    is_approved = Column(Boolean, default=False) # Students require approval

def init_db():
    if engine:
        Base.metadata.create_all(bind=engine)

def get_db():
    if SessionLocal:
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()
