
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = process.env.PORT || 3001;
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/taskflowDB";
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error("Set JWT_SECRET in your .env file before starting.");
  process.exit(1);
}

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// USER MODEL
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

// TASK MODEL
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

// CREATE LOGIN TOKEN
function createToken(user) {
  return jwt.sign(
    { userId: user._id.toString() },
    JWT_SECRET,
    { expiresIn: "2h" }
  );
}

// PROTECT PRIVATE ROUTES
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

// REGISTER
app.post("/api/auth/register", async (req, res) => {
  try {
    const name = String(req.body.name || "").trim();
    const email = String(req.body.email || "").trim().toLowerCase();
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

    res.status(201).json({
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

    console.error(error);
    res.status(500).json({
      message: "Could not create your account."
    });
  }
});

// LOGIN
app.post("/api/auth/login", async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
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

    res.json({
      token: createToken(user),
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Could not sign in. Please try again."
    });
  }
});

// GET CURRENT USER
app.get("/api/auth/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("name email");

    if (!user) {
      return res.status(401).json({
        message: "Account not found. Please sign in again."
      });
    }

    res.json({
      id: user._id,
      name: user.name,
      email: user.email
    });
  } catch (error) {
    res.status(500).json({
      message: "Could not load account."
    });
  }
});

// GET ONLY THE SIGNED-IN USER'S TASKS
app.get("/api/tasks", requireAuth, async (req, res) => {
  try {
    const tasks = await Task.find({ owner: req.userId })
      .sort({ createdAt: -1 });

    res.json(tasks);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Could not load tasks."
    });
  }
});

// CREATE TASK
app.post("/api/tasks", requireAuth, async (req, res) => {
  try {
    const title = String(req.body.title || "").trim();
    const subject = String(req.body.subject || "General").trim();
    const priority = req.body.priority || "Medium";
    const dueDate = req.body.dueDate || "";

    if (!title) {
      return res.status(400).json({
        message: "Please enter a task title."
      });
    }

    const task = await Task.create({
      title,
      subject,
      priority,
      dueDate,
      owner: req.userId
    });

    res.status(201).json(task);
  } catch (error) {
    console.error(error);
    res.status(400).json({
      message: "Could not create task. Check the task details."
    });
  }
});

// UPDATE TASK
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

    if (
      updates.title !== undefined &&
      !String(updates.title).trim()
    ) {
      return res.status(400).json({
        message: "Task title cannot be empty."
      });
    }

    if (updates.title !== undefined) {
      updates.title = String(updates.title).trim();
    }

    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, owner: req.userId },
      updates,
      { new: true, runValidators: true }
    );

    if (!task) {
      return res.status(404).json({
        message: "Task not found."
      });
    }

    res.json(task);
  } catch (error) {
    res.status(400).json({
      message: "Could not update task. Check the task details."
    });
  }
});

// DELETE TASK
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

    res.json({ message: "Task deleted." });
  } catch (error) {
    res.status(400).json({
      message: "Could not delete task."
    });
  }
});

// SERVE THE WEBSITE
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// START SERVER AFTER MONGODB CONNECTS
async function start() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to MongoDB");

    app.listen(PORT, () => {
      console.log(`TaskFlow running at http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
}

start();
