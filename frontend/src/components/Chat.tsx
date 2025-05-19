import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

interface Message {
  sender: string;
  content: string;
  timestamp: string;
}

interface ChatProps {
  username: string;
  token: string;
}

interface Friend {
  id: number;
  username: string;
}

interface ChatRoom {
  id: number;
  name: string;
  is_private: boolean;
}

const Chat: React.FC<ChatProps> = ({ username, token }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [message, setMessage] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [chats, setChats] = useState<ChatRoom[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatRoom | null>(null);
  const [newFriendUsername, setNewFriendUsername] = useState('');
  const [error, setError] = useState('');
  const ws = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const loadFriends = async () => {
      try {
        const response = await axios.get('http://localhost:8000/friends', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setFriends(response.data);
      } catch (error) {
        console.error('Error loading friends:', error);
      }
    };

    const loadChats = async () => {
      try {
        const response = await axios.get('http://localhost:8000/chats', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setChats(response.data);
      } catch (error) {
        console.error('Error loading chats:', error);
      }
    };

    loadFriends();
    loadChats();
  }, [token]);

  const addFriend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFriendUsername.trim()) return;
    
    try {
      await axios.post(`http://localhost:8000/friends/add/${newFriendUsername}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNewFriendUsername('');
      const response = await axios.get('http://localhost:8000/friends', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setFriends(response.data);
    } catch (error) {
      console.error('Error adding friend:', error);
      setError('Не удалось добавить друга. Проверьте имя пользователя и попробуйте снова.');
    }
  };

  const createChat = async (friendUsername: string) => {
    try {
      const response = await axios.post(`http://localhost:8000/chats/create/${friendUsername}`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const chatsResponse = await axios.get('http://localhost:8000/chats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setChats(chatsResponse.data);
      const newChat = chatsResponse.data.find((chat: ChatRoom) => chat.id === response.data.chat_id);
      if (newChat) {
        setSelectedChat(newChat);
      }
    } catch (error) {
      console.error('Error creating chat:', error);
      setError('Не удалось создать чат. Попробуйте снова.');
    }
  };

  useEffect(() => {
    if (!selectedChat) return;

    const wsUrl = `ws://localhost:8000/ws/${username}?token=${encodeURIComponent(token)}&chat_id=${selectedChat.id}`;
    
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 3;
    const reconnectDelay = 1000;
    let reconnectTimeout: NodeJS.Timeout;

    const connectWebSocket = () => {
      if (ws.current?.readyState === WebSocket.OPEN) return;

      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        setIsConnected(true);
        reconnectAttempts = 0;
      };

      ws.current.onclose = (event) => {
        setIsConnected(false);
        
        if (event.code === 1008) {
          setError('Ошибка аутентификации. Пожалуйста, войдите снова.');
        } else if (reconnectAttempts < maxReconnectAttempts) {
          reconnectTimeout = setTimeout(() => {
            reconnectAttempts++;
            connectWebSocket();
          }, reconnectDelay);
        } else {
          setError('Соединение потеряно. Пожалуйста, обновите страницу.');
        }
      };

      ws.current.onerror = () => {
        setIsConnected(false);
      };

      ws.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          setMessages(prev => [...prev, message]);
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      };
    };

    connectWebSocket();

    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [username, token, selectedChat]);

  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(message);
      setMessage('');
    }
  };

  const loadChatHistory = async (chatId: number) => {
    try {
      const response = await axios.get(`http://localhost:8000/chats/${chatId}/messages`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setMessages(response.data);
    } catch (error) {
      console.error('Error loading chat history:', error);
      setError('Не удалось загрузить историю сообщений');
    }
  };

  useEffect(() => {
    if (selectedChat) {
      loadChatHistory(selectedChat.id);
    }
  }, [selectedChat, token]);

  const handleChatSelect = (chat: ChatRoom) => {
    setSelectedChat(chat);
    setMessage('');
  };

  return (
    <div className="chat-container">
      <div className="sidebar">
        <div className="friends-section">
          <h3>Друзья</h3>
          <form onSubmit={addFriend} className="add-friend-form">
            <input
              type="text"
              value={newFriendUsername}
              onChange={(e) => setNewFriendUsername(e.target.value)}
              placeholder="Имя пользователя"
            />
            <button type="submit">Добавить</button>
          </form>
          {error && <div className="error-message">{error}</div>}
          <ul className="friends-list">
            {friends.map(friend => (
              <li key={friend.id}>
                <span>{friend.username}</span>
                <button onClick={() => createChat(friend.username)}>
                  Написать
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="chats-section">
          <h3>Чаты</h3>
          <ul className="chats-list">
            {chats.map(chat => (
              <li
                key={chat.id}
                className={selectedChat?.id === chat.id ? 'selected' : ''}
                onClick={() => handleChatSelect(chat)}
              >
                {chat.name}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="chat-main">
        {selectedChat ? (
          <>
            <div className="messages-container">
              {messages.length === 0 ? (
                <div className="no-messages">
                  Нет сообщений. Начните разговор!
                </div>
              ) : (
                messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`message ${msg.sender === username ? 'sent' : 'received'}`}
                  >
                    <div className="message-sender">{msg.sender}</div>
                    <div className="message-content">{msg.content}</div>
                    <div className="message-timestamp">
                      {new Date(msg.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={sendMessage} className="message-form">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Введите сообщение..."
              />
              <button type="submit" disabled={!isConnected}>
                Отправить
              </button>
            </form>
            <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
              {isConnected ? 'Подключено' : 'Отключено'}
            </div>
          </>
        ) : (
          <div className="no-chat-selected">
            Выберите чат или начните новый
          </div>
        )}
      </div>
    </div>
  );
};

export default Chat; 