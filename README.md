# TaskFlow — Student Task Manager

TaskFlow is a beginner-friendly full-stack task and assignment manager. It uses HTML, CSS and browser JavaScript for the interface, Node.js + Express for the backend API, and MongoDB for persistent storage. MongoDB Compass can be used to view the saved database records.

## Features

- Create, read, update and delete assignments (CRUD)
- Mark tasks complete / in progress
- Set subject, due date and priority
- Search and filter tasks
- Sort by newest, due date or priority
- Responsive dashboard
- MongoDB persistence

## Requirements

Install:
1. Node.js LTS: https://nodejs.org/
2. MongoDB Community Server (local database server): https://www.mongodb.com/try/download/community
3. MongoDB Compass (visual database tool): https://www.mongodb.com/try/download/compass
4. Git: https://git-scm.com/downloads

> Important: Compass is a GUI for viewing and managing MongoDB. It is not the database server itself. Install and run MongoDB Community Server too, or use a MongoDB Atlas cluster.

## Run on Windows

1. Extract the ZIP to a folder you can find easily, such as `Desktop\\taskflow-fullstack`.
2. Open that folder in VS Code (`File > Open Folder`).
3. In VS Code, choose `Terminal > New Terminal`.
4. Copy `.env.example` to a new file named `.env`. Keep the default URI for a local MongoDB server:
   `MONGODB_URI=mongodb://127.0.0.1:27017/taskflowDB`
5. Check that the MongoDB Server service is running. If you selected it during installation, it often starts automatically.
6. In the VS Code terminal, run:

   ```bash
   npm install
   npm start
   ```

7. Open http://localhost:3002 in Chrome.
8. Create a task. It should appear in the dashboard.

## See the data in MongoDB Compass

1. Open Compass.
2. Click **Add New Connection**.
3. Enter `mongodb://127.0.0.1:27017`.
4. Click **Connect**.
5. Refresh the databases list if needed.
6. Open `taskflowDB` → `tasks` → `Documents`.

The database and collection are created automatically after the first task is saved by the website.

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/tasks` | List all tasks |
| POST | `/api/tasks` | Create a task |
| PATCH | `/api/tasks/:id` | Update task fields / completion |
| DELETE | `/api/tasks/:id` | Delete a task |

## Common problems

- **`ECONNREFUSED 127.0.0.1:27017`**: MongoDB Server is not running, or the URI is wrong. Compass alone does not start the server.
- **`npm is not recognized`**: Install Node.js LTS, close VS Code, reopen it, then run `node -v` and `npm -v`.
- **Port 3000 already in use**: Change `PORT=3001` in `.env`, restart, and open `http://localhost:3001`.
- **No database appears in Compass**: Create and save a task in the website first, then refresh Compass.

