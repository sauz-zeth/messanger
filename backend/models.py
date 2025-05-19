from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, Table, Text
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
from datetime import datetime
from sqlalchemy.sql import func

Base = declarative_base()

# Таблица для связи многие-ко-многим между пользователями и чатами
user_chat = Table(
    'user_chat',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id'), primary_key=True),
    Column('chat_id', Integer, ForeignKey('chats.id'), primary_key=True),
    extend_existing=True
)

# Таблица для связи друзей
friendship = Table(
    'friendship',
    Base.metadata,
    Column('user_id', Integer, ForeignKey('users.id'), primary_key=True),
    Column('friend_id', Integer, ForeignKey('users.id'), primary_key=True)
)

class User(Base):
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    password_hash = Column(String)
    is_online = Column(Boolean, default=False)
    last_seen = Column(DateTime, default=func.now())
    timestamp = Column(DateTime, default=func.now())
    
    # Отношения
    messages = relationship("Message", back_populates="sender")
    chats = relationship("Chat", secondary=user_chat, back_populates="participants")
    friends = relationship(
        "User",
        secondary="friendship",
        primaryjoin="User.id==friendship.c.user_id",
        secondaryjoin="User.id==friendship.c.friend_id",
        backref="friend_of"
    )

class Chat(Base):
    __tablename__ = 'chats'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    is_private = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Отношения
    messages = relationship("Message", back_populates="chat")
    participants = relationship("User", secondary=user_chat, back_populates="chats")

class Message(Base):
    __tablename__ = 'messages'

    id = Column(Integer, primary_key=True, index=True)
    content = Column(String)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    is_read = Column(Boolean, default=False)
    
    # Внешние ключи
    sender_id = Column(Integer, ForeignKey('users.id'))
    chat_id = Column(Integer, ForeignKey('chats.id'))
    
    # Отношения
    sender = relationship("User")
    chat = relationship("Chat", back_populates="messages") 