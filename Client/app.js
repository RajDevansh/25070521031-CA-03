
const taskList = document.getElementById("task-list");
const dialog = document.getElementById("task-dialog");
const taskForm = document.getElementById("task-form");
const searchInput = document.getElementById("search-input");
const sortSelect = document.getElementById("sort-select");

let tasks = [];
let currentFilter = "all";
let editingId = null;
let toastTimer;
let authMode = "login";
let authToken = localStorage.getItem("taskflowToken") || "";

document.getElementById("today-label").textContent =
  new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric"
  }).toUpperCase();

async function api(url, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const response = await fetch(url, { ...options, headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401 && url.startsWith("/api/tasks")) {
      signOut("Your session expired. Please sign in again.");
    }
    throw new Error(data.message || "Something went wrong.");
  }

  return data;
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 2600);
}

function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function updateStats() {
  const complete = tasks.filter(task => task.completed).length;
  const pending = tasks.length - complete;
  const percent = tasks.length
    ? Math.round((complete / tasks.length) * 100)
    : 0;

  document.getElementById("total-count").textContent = tasks.length;
  document.getElementById("pending-count").textContent = pending;
  document.getElementById("completed-count").textContent = complete;
  document.getElementById("progress-percent").textContent = `${percent}%`;
  document.getElementById("progress-fill").style.width = `${percent}%`;
}

function prettyDate(dateString) {
  if (!dateString) return "No due date";

  const date = new Date(`${dateString}T00:00:00`);

  return `Due ${date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short"
  })}`;
}

function renderTasks() {
  updateStats();

  const query = searchInput.value.trim().toLowerCase();

  let visible = tasks.filter(task => {
    const matchesFilter =
      currentFilter === "all" ||
      (currentFilter === "pending" && !task.completed) ||
      (currentFilter === "completed" && task.completed);

    const matchesSearch =
      `${task.title} ${task.subject} ${task.priority}`
        .toLowerCase()
        .includes(query);

    return matchesFilter && matchesSearch;
  });

  const sort = sortSelect.value;

  if (sort === "due") {
    visible.sort((a, b) =>
      (a.dueDate || "9999").localeCompare(b.dueDate || "9999")
    );
  }

  if (sort === "priority") {
    const rank = { High: 0, Medium: 1, Low: 2 };
    visible.sort((a, b) => rank[a.priority] - rank[b.priority]);
  }

  if (sort === "newest") {
    visible.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
  }

  document.getElementById("result-count").textContent =
    `${visible.length} item${visible.length === 1 ? "" : "s"}`;

  const heading =
    currentFilter === "all"
      ? "Your tasks"
      : currentFilter === "pending"
        ? "In progress"
        : "Completed";

  document.getElementById("list-heading").innerHTML =
    `${heading}<span class="heading-period">.</span>`;

  if (!visible.length) {
    const message = query
      ? "No matching tasks"
      : currentFilter === "completed"
        ? "Nothing completed yet"
        : "A fresh start.";

    const description = query
      ? "Try a different search term."
      : "Add a task to get your study plan moving.";

    taskList.innerHTML = `
      <div class="empty-state">
        <strong>${message}</strong>
        <span>${description}</span><br>
        <button class="primary-btn" id="empty-add">＋ Add a task</button>
      </div>`;

    document.getElementById("empty-add")
      .addEventListener("click", openCreateDialog);

    return;
  }

  taskList.innerHTML = visible.map(task => `
    <article class="task-row ${task.completed ? "is-complete" : ""}">
      <button
        class="task-check"
        data-action="toggle"
        data-id="${task._id}"
        aria-label="${task.completed ? "Mark as in progress" : "Mark complete"}"
      >${task.completed ? "✓" : ""}</button>

      <div class="task-info">
        <div class="task-title">${escapeHTML(task.title)}</div>
        <div class="task-meta">
          <span>${escapeHTML(task.subject || "General")}</span>
          <span>·</span>
          <span>${prettyDate(task.dueDate)}</span>
          <span class="priority ${escapeHTML(task.priority)}">
            ${escapeHTML(task.priority)} priority
          </span>
        </div>
      </div>

      <div class="task-actions">
        <button data-action="edit" data-id="${task._id}">Edit</button>
        <button data-action="delete" data-id="${task._id}">Delete</button>
      </div>
    </article>
  `).join("");
}

function showAuth(mode = "login", error = "") {
  authMode = mode;

  document.getElementById("auth-screen").hidden = false;
  document.getElementById("app-shell").hidden = true;

  document.getElementById("auth-heading").textContent =
    mode === "login" ? "Welcome back" : "Create your account";

  document.getElementById("auth-subtitle").textContent =
    mode === "login"
      ? "Sign in to continue to your planner."
      : "Start your own personal study workspace.";

  document.getElementById("auth-name-wrap")
    .classList.toggle("hidden-field", mode === "login");

  document.getElementById("auth-name").required = mode === "register";

  document.getElementById("auth-password").autocomplete =
    mode === "login" ? "current-password" : "new-password";

  document.getElementById("auth-submit").innerHTML =
    mode === "login"
      ? 'Sign in <span>↗</span>'
      : 'Create account <span>↗</span>';

  document.getElementById("auth-switch-text").innerHTML =
    mode === "login"
      ? 'New to TaskFlow? <button type="button" id="auth-switch">Create an account</button>'
      : 'Already have an account? <button type="button" id="auth-switch">Sign in</button>';

  document.getElementById("auth-error").textContent = error;
  document.getElementById("auth-form").reset();
  document.getElementById("auth-password").type = "password";
  document.getElementById("toggle-password").textContent = "Show";
}

function showDashboard(user) {
  document.getElementById("auth-screen").hidden = true;
  document.getElementById("app-shell").hidden = false;

  document.getElementById("profile-name").textContent = user.name;
  document.getElementById("profile-email").textContent = user.email;
  document.getElementById("profile-avatar").textContent =
    (user.name || "S").charAt(0).toUpperCase();

  document.querySelector(".subheading").textContent =
    `Welcome back, ${user.name.split(" ")[0]}. Make room for what matters today.`;
}

function signOut(message = "") {
  authToken = "";
  tasks = [];

  localStorage.removeItem("taskflowToken");
  showAuth("login", message);
}

document.getElementById("auth-switch-text").addEventListener("click", event => {
  if (event.target.id === "auth-switch") {
    showAuth(authMode === "login" ? "register" : "login");
  }
});

document.getElementById("toggle-password").addEventListener("click", () => {
  const field = document.getElementById("auth-password");
  field.type = field.type === "password" ? "text" : "password";

  document.getElementById("toggle-password").textContent =
    field.type === "password" ? "Show" : "Hide";
});

document.getElementById("auth-form").addEventListener("submit", async event => {
  event.preventDefault();

  const errorBox = document.getElementById("auth-error");
  const submit = document.getElementById("auth-submit");

  errorBox.textContent = "";

  const payload = {
    email: document.getElementById("auth-email").value.trim(),
    password: document.getElementById("auth-password").value
  };

  if (authMode === "register") {
    payload.name = document.getElementById("auth-name").value.trim();
  }

  const endpoint =
    authMode === "login"
      ? "/api/auth/login"
      : "/api/auth/register";

  submit.disabled = true;

  try {
    const result = await api(endpoint, {
      method: "POST",
      headers: {},
      body: JSON.stringify(payload)
    });

    authToken = result.token;
    localStorage.setItem("taskflowToken", authToken);

    showDashboard(result.user);
    await loadTasks();

    showToast(
      authMode === "login"
        ? "Welcome back!"
        : "Account created successfully."
    );
  } catch (error) {
    errorBox.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});

document.getElementById("logout-button").addEventListener("click", () => {
  signOut();
});

async function restoreSession() {
  if (!authToken) {
    showAuth("login");
    return;
  }

  try {
    const user = await api("/api/auth/me");
    showDashboard(user);
    await loadTasks();
  } catch (error) {
    signOut("Please sign in to continue.");
  }
}

async function loadTasks() {
  try {
    tasks = await api("/api/tasks");
    renderTasks();
  } catch (error) {
    taskList.innerHTML = `
      <div class="empty-state">
        <strong>Couldn't load your tasks.</strong>
        <span>Check the server connection and refresh the page.</span>
      </div>`;
  }
}

function openCreateDialog() {
  editingId = null;
  taskForm.reset();

  document.getElementById("dialog-title").textContent = "Create a task";
  document.getElementById("task-priority").value = "Medium";
  document.getElementById("form-error").textContent = "";

  dialog.showModal();
  document.getElementById("task-title").focus();
}

function openEditDialog(task) {
  editingId = task._id;

  document.getElementById("dialog-title").textContent = "Edit your task";
  document.getElementById("task-title").value = task.title;
  document.getElementById("task-subject").value = task.subject || "";
  document.getElementById("task-priority").value = task.priority;
  document.getElementById("task-due").value = task.dueDate || "";
  document.getElementById("form-error").textContent = "";

  dialog.showModal();
}

document.getElementById("open-add")
  .addEventListener("click", openCreateDialog);

document.getElementById("welcome-add")
  .addEventListener("click", openCreateDialog);

document.getElementById("close-dialog")
  .addEventListener("click", () => dialog.close());

dialog.addEventListener("click", event => {
  if (event.target === dialog) dialog.close();
});

taskForm.addEventListener("submit", async event => {
  event.preventDefault();

  const payload = {
    title: document.getElementById("task-title").value.trim(),
    subject: document.getElementById("task-subject").value.trim() || "General",
    priority: document.getElementById("task-priority").value,
    dueDate: document.getElementById("task-due").value
  };

  try {
    if (editingId) {
      await api(`/api/tasks/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });

      showToast("Task updated successfully.");
    } else {
      await api("/api/tasks", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      showToast("Your new task is saved.");
    }

    dialog.close();
    await loadTasks();
  } catch (error) {
    document.getElementById("form-error").textContent = error.message;
  }
});

taskList.addEventListener("click", async event => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const task = tasks.find(item => item._id === button.dataset.id);
  if (!task) return;

  try {
    if (button.dataset.action === "toggle") {
      await api(`/api/tasks/${task._id}`, {
        method: "PATCH",
        body: JSON.stringify({ completed: !task.completed })
      });

      showToast(
        task.completed
          ? "Task moved back to in progress."
          : "Nice work — task completed!"
      );
    } else if (button.dataset.action === "edit") {
      openEditDialog(task);
      return;
    } else if (button.dataset.action === "delete") {
      if (!confirm(`Delete "${task.title}"? This cannot be undone.`)) {
        return;
      }

      await api(`/api/tasks/${task._id}`, {
        method: "DELETE"
      });

      showToast("Task deleted.");
    }

    await loadTasks();
  } catch (error) {
    showToast(error.message);
  }
});

function changeFilter(filter) {
  currentFilter = filter;

  document.querySelectorAll("[data-filter]").forEach(button => {
    button.classList.toggle(
      "selected",
      button.classList.contains("filter-chip") &&
      button.dataset.filter === filter
    );

    button.classList.toggle(
      "active",
      button.classList.contains("nav-item") &&
      button.dataset.filter === filter
    );
  });

  renderTasks();
}

document.querySelectorAll("[data-filter]").forEach(button => {
  button.addEventListener("click", () => {
    changeFilter(button.dataset.filter);
  });
});

searchInput.addEventListener("input", renderTasks);
sortSelect.addEventListener("change", renderTasks);

restoreSession();
