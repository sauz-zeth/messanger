# WebSocket Messenger

Полнофункциональный мессенджер с использованием WebSocket, FastAPI и React.

## Структура проекта

```
messenger/
├── backend/           # FastAPI бэкенд
├── frontend/          # React фронтенд
└── docker/           # Docker конфигурации
```

## Требования

- Python 3.8+
- Node.js 16+
- Docker и Docker Compose (опционально)

## Установка и запуск

### Бэкенд

```bash
cd backend
python -m venv venv
source venv/bin/activate  # для Linux/Mac
# или
.\venv\Scripts\activate  # для Windows
pip install -r requirements.txt
uvicorn main:app --reload
```

### Фронтенд

```bash
cd frontend
npm install
npm run dev
```

## Функциональность

- Реал-тайм обмен сообщениями через WebSocket
- Аутентификация пользователей
- Групповые и личные чаты
- Статус онлайн/оффлайн
- Уведомления о новых сообщениях 