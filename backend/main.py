from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session, joinedload
from typing import List, Dict, Tuple
import json
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
import models
import database
from sqlalchemy.sql import func
from fastapi.responses import JSONResponse
from fastapi import Request

# Создаем таблицы
models.Base.metadata.create_all(bind=database.engine)

app = FastAPI()

# Настройка CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Разрешаем все origins
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=3600
)

# Настройки JWT
SECRET_KEY = "your-secret-key"  # В продакшене использовать безопасный ключ
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

# Настройки паролей
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token", auto_error=False)

# Pydantic модели
class UserCreate(BaseModel):
    username: str
    email: str
    password: str

class User(BaseModel):
    id: int
    username: str
    email: str
    is_online: bool

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: str | None = None


class MessageOut(BaseModel):
    id: int
    sender_id: int
    chat_id: int
    content: str
    timestamp: datetime

    class Config:
        orm_mode = True


# Basic output schemas
class UserBasic(BaseModel):
    id: int
    username: str

    class Config:
        orm_mode = True


class ChatOut(BaseModel):
    id: int
    name: str
    is_private: bool
    participants: List[UserBasic]

    class Config:
        orm_mode = True

# Хранение активных соединений
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[Tuple[str, int], WebSocket] = {}

    async def connect(self, websocket: WebSocket, client_id: str, chat_id: int):
        await websocket.accept()
        self.active_connections[(client_id, chat_id)] = websocket

    def disconnect(self, websocket: WebSocket, client_id: str, chat_id: int):
        if (client_id, chat_id) in self.active_connections:
            del self.active_connections[(client_id, chat_id)]

    async def broadcast(self, message: dict, chat_id: int):
        for (client_id, current_chat_id), connection in self.active_connections.items():
            if current_chat_id == chat_id:
                await connection.send_json(message)

manager = ConnectionManager()

# Функции для работы с пользователями
def get_user(db: Session, username: str):
    return db.query(models.User).filter(models.User.username == username).first()

def create_user(db: Session, user: UserCreate):
    hashed_password = pwd_context.hash(user.password)
    db_user = models.User(
        username=user.username,
        email=user.email,
        password_hash=hashed_password
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def authenticate_user(db: Session, username: str, password: str):
    user = get_user(db, username)
    if not user:
        return False
    if not verify_password(password, user.password_hash):
        return False
    return user

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

@app.post("/register", response_model=User)
def register(user: UserCreate, db: Session = Depends(database.get_db)):
    db_user = get_user(db, username=user.username)
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    return create_user(db=db, user=user)

@app.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(database.get_db)):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    response = JSONResponse(content={"access_token": access_token, "token_type": "bearer"})
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="lax",
        secure=False  # В проде обязательно True!
    )
    return response

@app.post("/logout")
async def logout():
    response = JSONResponse(content={"message": "Logged out"})
    response.delete_cookie("access_token")
    return response

@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str, db: Session = Depends(database.get_db)):
    params = websocket.query_params
    token = params.get("token")
    chat_id = params.get("chat_id")
    if not token:
        await websocket.close(code=1008, reason="No token provided")
        return

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if not username:
            await websocket.close(code=1008, reason="Invalid token")
            return
    except jwt.JWTError:
        await websocket.close(code=1008, reason="Invalid token")
        return

    if username != client_id:
        await websocket.close(code=1008, reason="Token username doesn't match client_id")
        return

    if not chat_id:
        await websocket.close(code=1008, reason="No chat_id provided")
        return
    try:
        chat_id = int(chat_id)
    except ValueError:
        await websocket.close(code=1008, reason="Invalid chat_id")
        return

    # Проверяем, что пользователь является участником чата
    chat = db.query(models.Chat).filter(models.Chat.id == chat_id).first()
    if not chat:
        await websocket.close(code=1008, reason="Chat not found")
        return

    user = db.query(models.User).filter(models.User.username == username).first()
    if not user or user not in chat.participants:
        await websocket.close(code=1008, reason="User is not a participant of this chat")
        return

    await manager.connect(websocket, client_id, chat_id)
    try:
        while True:
            data = await websocket.receive_text()

            # Сохраняем сообщение в БД
            new_msg = models.Message(
                content=data,
                sender_id=user.id,
                chat_id=chat_id
            )
            db.add(new_msg)
            db.commit()
            db.refresh(new_msg)

            # Рассылаем сохранённое сообщение
            message = {
                "id": new_msg.id,
                "sender": username,
                "content": new_msg.content,
                "timestamp": new_msg.timestamp.isoformat()
            }
            await manager.broadcast(message, chat_id)
    except WebSocketDisconnect:
        manager.disconnect(websocket, client_id, chat_id)

@app.get("/")
async def root():
    return {"message": "WebSocket Messenger API"}

async def get_current_user(
    request: Request,
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(database.get_db)
):
    # Если заголовка Authorization нет, пробуем взять токен из cookie
    token = token or request.cookies.get("access_token")
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
    user = get_user(db, username=token_data.username)
    if user is None:
        raise credentials_exception
    return user

@app.post("/friends/add/{friend_username}")
async def add_friend(
    friend_username: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    friend = db.query(models.User).filter(models.User.username == friend_username).first()
    if not friend:
        raise HTTPException(status_code=404, detail="User not found")
    if friend.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot add yourself as a friend")
    if friend in current_user.friends:
        raise HTTPException(status_code=400, detail="Already friends")
    
    current_user.friends.append(friend)
    db.commit()
    return {"message": f"Added {friend_username} as a friend"}

@app.get("/friends", response_model=List[UserBasic])
async def get_friends(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    return current_user.friends

@app.post("/chats/create/{friend_username}")
async def create_chat(
    friend_username: str,
    current_user: models.User = Depends(lambda db=Depends(database.get_db), token=Depends(oauth2_scheme): db.query(models.User).options(joinedload(models.User.friends)).filter(models.User.username == jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])["sub"]).first()),
    db: Session = Depends(database.get_db)
):
    friend = db.query(models.User).filter(models.User.username == friend_username).first()
    if not friend:
        raise HTTPException(status_code=404, detail="User not found")
    if friend.id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot add yourself as a friend")
    if friend not in current_user.friends:
        raise HTTPException(status_code=400, detail="User is not your friend")
    
    # Проверяем, существует ли уже чат между пользователями
    existing_chat = db.query(models.Chat).join(models.user_chat).filter(
        models.Chat.is_private == True,
        models.user_chat.c.user_id.in_([current_user.id, friend.id])
    ).group_by(models.Chat.id).having(func.count(models.user_chat.c.user_id) == 2).first()
    
    if existing_chat:
        return {"chat_id": existing_chat.id, "message": "Chat already exists"}
    
    # Создаем новый чат
    chat = models.Chat(name=f"{current_user.username} - {friend.username}", is_private=True)
    chat.participants = [current_user, friend]
    db.add(chat)
    db.commit()
    db.refresh(chat)
    
    return {"chat_id": chat.id, "message": "Chat created successfully"}

@app.get("/chats", response_model=List[ChatOut])
async def get_chats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    return current_user.chats

@app.get("/chats/{chat_id}/messages", response_model=List[MessageOut])
async def get_chat_messages(
    chat_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(database.get_db)
):
    # Проверяем, является ли пользователь участником чата
    chat = db.query(models.Chat).filter(models.Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Чат не найден")
    
    user_chat = db.query(models.user_chat).filter(
        models.user_chat.c.user_id == current_user.id,
        models.user_chat.c.chat_id == chat_id
    ).first()
    
    if not user_chat:
        raise HTTPException(status_code=403, detail="Нет доступа к этому чату")
    
    # Получаем все сообщения чата
    messages = db.query(models.Message).filter(
        models.Message.chat_id == chat_id
    ).order_by(models.Message.timestamp).all()
    
    return messages 