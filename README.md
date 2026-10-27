
# TaskFlow — Student Task Manager

TaskFlow is a full-stack student task management application built with
HTML, CSS, JavaScript, Node.js, Express, and MongoDB.

## Features

- User registration and login
- Password hashing with bcrypt
- JWT-based authentication
- Personal tasks for each authenticated user
- Create, view, update, complete, and delete tasks
- Task priorities and due dates
- Search, filtering, and dashboard functionality provided by the frontend

## Requirements

- Node.js and npm
- MongoDB Community Server running locally, or a configured MongoDB Atlas database
- A modern web browser

## Project structure

    TaskFlow/
    ├── Client/
    │   ├── index.html
    │   ├── style.css
    │   └── app.js
    ├── Server/
    │   ├── server.js
    │   ├── package.json
    │   ├── package-lock.json
    │   ├── .env.example
    │   └── .env
    ├── .gitignore
    └── README.md

The .env file is created locally and must not be committed to GitHub.

## Installation

1. Install Node.js and MongoDB.
2. Start the MongoDB service.
3. Download or clone this repository.
4. Open a terminal in the Server directory.
5. Install the dependencies:

       npm install

6. Copy `.env.example` to `.env`.
7. Edit `.env` with your MongoDB connection string and a strong,
   randomly generated JWT secret.

Example local configuration:

    PORT=3001
    MONGODB_URI=mongodb://127.0.0.1:27017/taskflowDB
    JWT_SECRET=replace_with_your_own_random_secret

Do not use the example JWT secret in a real deployment.

## Run the application

From the Server directory, execute:

    npm start

When MongoDB connects successfully, open:

    http://localhost:3001

Register an account to start creating tasks.

## MongoDB configuration

By default, the application uses the local database named `taskflowDB`.

To use MongoDB Atlas, replace `MONGODB_URI` in `.env` with your Atlas
connection string. Configure database credentials and network access
securely. Never commit database credentials to GitHub.

Each faculty member's computer will use its own local database unless
the application is configured to connect to a shared database.

## Troubleshooting

- If MongoDB connection fails, check that MongoDB is running and that
  the connection string is correct.
- If a dependency is missing, run `npm install` inside Server.
- If the port is occupied, change PORT in `.env`.
- If the page does not load, verify that Client/index.html exists and
  the server has started successfully.

## Security note

This project is intended for educational use. Review authentication,
input validation, rate limiting, and deployment security before
exposing it to the public internet.
