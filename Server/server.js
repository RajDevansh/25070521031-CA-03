
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 3001;

const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb://127.0.0.1:27017/taskflowDB";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error("ERROR: Please configure JWT_SECRET in Server/.env");
  process.exit(1);
}

app.use(express.json({ limit: "100kb" }));

// Serve frontend files from the Client folder.
const clientPath = path.join(__dirname, "..", "Client");

app.use(express.static(clientPath));

// ========================
// USER MODEL
// ========================

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    passwordHash: {
      type: String,
      required: true
    }
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);

// ========================
// TASK MODEL
// ========================

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },
    subject: {
      type: String,
      default: "General",
      trim: true,
      maxlength: 60
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High"],
      default: "Medium"
    },
    dueDate: {
      type: String,
      default: ""
    },
    completed: {
      type: Boolean,
      default: false
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    }
  },
  { timestamps: true }
);

const Task = mongoose.model("Task", taskSchema);

// ========================
// AUTHENTICATION HELPERS
// ========================

function createToken(user) {
  return jwt.sign(
    { userId: user._id.toString() },
    JWT_SECRET,
    { expiresIn: "2h" }
  );
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";

  const token = header.startsWith("Bearer ")
    ? header.slice(7)
    : "";

  if (!token) {
    return res.status(401).json({
      message: "Please sign in to continue."
    });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch (error) {
    return res.status(401).json({
      message: "Your session expired. Please sign in again."
    });
  }
}

// ========================
// REGISTER
// ========================

app.post("/api/auth/register", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body.password || "");

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "Please complete every field."
      });
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({
        message: "Enter a valid email address."
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters."
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(409).json({
        message: "This email is already registered. Please sign in."
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      email,
      passwordHash
    });

    return res.status(201).json({
      token: createToken(user),
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "This email is already registered."
      });
    }

    console.error("Registration error:", error.message);

    return res.status(500).json({
      message: "Could not create your account."
    });
  }
});

// ========================
// LOGIN
// ========================

app.post("/api/auth/login", async (req, res) => {
  try {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();
    const password = String(req.body.password || "");

    const user = await User.findOne({ email });

    if (
      !user ||
      !(await bcrypt.compare(password, user.passwordHash))
    ) {
      return res.status(401).json({
        message: "Incorrect email or password."
      });
    }

    return res.json({
      token: createToken(user),
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      message: "Could not sign in. Please try again."
    });
  }
});

// ========================
// CURRENT USER
// ========================

app.get("/api/auth/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .select("name email");

    if (!user) {
      return res.status(401).json({
        message: "Account not found. Please sign in again."
      });
    }

    return res.json({
      id: user._id,
      name: user.name,
      email: user.email
    });
  } catch (error) {
    console.error("User lookup error:", error.message);

    return res.status(500).json({
      message: "Could not load account."
    });
  }
});

// ========================
// GET USER'S TASKS
// ========================

app.get("/api/tasks", requireAuth, async (req, res) => {
  try {
    const tasks = await Task.find({
      owner: req.userId
    }).sort({ createdAt: -1 });

    return res.json(tasks);
  } catch (error) {
    console.error("Task loading error:", error.message);

    return res.status(500).json({
      message: "Could not load tasks."
    });
  }
});

// ========================
// CREATE TASK
// ========================

app.post("/api/tasks", requireAuth, async (req, res) => {
  try {
    const title = String(req.body.title || "").trim();
    const subject = String(
      req.body.subject || "General"
    ).trim();

    const priority = req.body.priority || "Medium";
    const dueDate = req.body.dueDate || "";

    if (!title) {
      return res.status(400).json({
        message: "Please enter a task title."
      });
    }

    if (title.length > 120 || subject.length > 60) {
      return res.status(400).json({
        message: "Task title or subject is too long."
      });
    }

    if (!["Low", "Medium", "High"].includes(priority)) {
      return res.status(400).json({
        message: "Invalid task priority."
      });
    }

    const task = await Task.create({
      title,
      subject,
      priority,
      dueDate,
      owner: req.userId
    });

    return res.status(201).json(task);
  } catch (error) {
    console.error("Task creation error:", error.message);

    return res.status(400).json({
      message: "Could not create task. Check the task details."
    });
  }
});

// ========================
// UPDATE TASK
// ========================

app.patch("/api/tasks/:id", requireAuth, async (req, res) => {
  try {
    const allowedFields = [
      "title",
      "subject",
      "priority",
      "dueDate",
      "completed"
    ];

    const updates = {};

    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: "No valid task fields supplied."
      });
    }

    if (updates.title !== undefined) {
      if (
        typeof updates.title !== "string" ||
        !updates.title.trim() ||
        updates.title.length > 120
      ) {
        return res.status(400).json({
          message: "Enter a valid task title."
        });
      }

      updates.title = updates.title.trim();
    }

    if (updates.subject !== undefined) {
      if (
        typeof updates.subject !== "string" ||
        updates.subject.length > 60
      ) {
        return res.status(400).json({
          message: "Enter a valid subject."
        });
      }

      updates.subject = updates.subject.trim();
    }

    if (
      updates.priority !== undefined &&
      !["Low", "Medium", "High"].includes(updates.priority)
    ) {
      return res.status(400).json({
        message: "Invalid task priority."
      });
    }

    if (
      updates.completed !== undefined &&
      typeof updates.completed !== "boolean"
    ) {
      return res.status(400).json({
        message: "Invalid completion status."
      });
    }

    if (
      updates.dueDate !== undefined &&
      typeof updates.dueDate !== "string"
    ) {
      return res.status(400).json({
        message: "Invalid due date."
      });
    }

    const task = await Task.findOneAndUpdate(
      {
        _id: req.params.id,
        owner: req.userId
      },
      updates,
      {
        new: true,
        runValidators: true
      }
    );

    if (!task) {
      return res.status(404).json({
        message: "Task not found."
      });
    }

    return res.json(task);
  } catch (error) {
    console.error("Task update error:", error.message);

    if (error.name === "CastError") {
      return res.status(400).json({
        message: "Invalid task ID."
      });
    }

    return res.status(400).json({
      message: "Could not update task. Check the task details."
    });
  }
});

// ========================
// DELETE TASK
// ========================

app.delete("/api/tasks/:id", requireAuth, async (req, res) => {
  try {
    const task = await Task.findOneAndDelete({
      _id: req.params.id,
      owner: req.userId
    });

    if (!task) {
      return res.status(404).json({
        message: "Task not found."
      });
    }

    return res.json({
      message: "Task deleted."
    });
  } catch (error) {
    console.error("Task deletion error:", error.message);

    if (error.name === "CastError") {
      return res.status(400).json({
        message: "Invalid task ID."
      });
    }

    return res.status(500).json({
      message: "Could not delete task."
    });
  }
});

// ========================
// FRONTEND FALLBACK
// ========================

// Send index.html for non-API browser routes.
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return next();
  }

  res.sendFile(
    path.join(clientPath, "index.html"),
    (error) => {
      if (error) next(error);
    }
  );
});

// Handle unknown API routes.
app.use("/api", (req, res) => {
  res.status(404).json({
    message: "API endpoint not found."
  });
});

// General error handler.
app.use((error, req, res, next) => {
  console.error("Server error:", error.message);

  if (res.headersSent) {
    return next(error);
  }

  res.status(500).json({
    message: "An unexpected server error occurred."
  });
});

// ========================
// START SERVER
// ========================

async function start() {
  try {
    await mongoose.connect(MONGODB_URI);

    console.log("Connected to MongoDB successfully.");

    app.listen(PORT, () => {
      console.log(`TaskFlow running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
}

start();
