const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'todos.json');

// Middleware
app.use(cors());
app.use(express.json());

// Logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  if (Object.keys(req.body).length > 0) {
    console.log('Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// In-memory data store
let todos = [];
let nextId = 1;

// Load data from file on startup
async function loadData() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(data);
    todos = parsed.todos || [];
    nextId = parsed.nextId || 1;
    console.log('Data loaded from file');
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('No existing data file, starting fresh');
      await saveData();
    } else {
      console.error('Error loading data:', error);
    }
  }
}

// Save data to file
async function saveData() {
  try {
    const data = JSON.stringify({ todos, nextId }, null, 2);
    await fs.writeFile(DATA_FILE, data, 'utf8');
    console.log('💾 Data saved to file');
  } catch (error) {
    console.error('❌ Error saving data:', error);
  }
}

// Routes

// Get all todos
app.get('/api/todos', (req, res) => {
  console.log(`📋 Fetching all todos (${todos.length} items)`);
  res.json({ success: true, data: todos });
});

// Get single todo
app.get('/api/todos/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const todo = todos.find(t => t.id === id);
  
  if (!todo) {
    console.log(`❌ Todo #${id} not found`);
    return res.status(404).json({ success: false, message: 'Todo not found' });
  }
  
  console.log(`✅ Found todo #${id}: "${todo.title}"`);
  res.json({ success: true, data: todo });
});

// Create new todo
app.post('/api/todos', async (req, res) => {
  const { title, description } = req.body;
  
  if (!title) {
    console.log('❌ Failed to create todo: Title is required');
    return res.status(400).json({ success: false, message: 'Title is required' });
  }
  
  const newTodo = {
    id: nextId++,
    title,
    description: description || '',
    completed: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  todos.push(newTodo);
  await saveData();
  
  console.log(`✅ Created todo #${newTodo.id}: "${title}"`);
  res.status(201).json({ success: true, data: newTodo });
});

// Update todo
app.put('/api/todos/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const { title, description, completed } = req.body;
  
  const todoIndex = todos.findIndex(t => t.id === id);
  
  if (todoIndex === -1) {
    console.log(`❌ Cannot update: Todo #${id} not found`);
    return res.status(404).json({ success: false, message: 'Todo not found' });
  }
  
  const updatedTodo = {
    ...todos[todoIndex],
    ...(title !== undefined && { title }),
    ...(description !== undefined && { description }),
    ...(completed !== undefined && { completed }),
    updatedAt: new Date().toISOString()
  };
  
  todos[todoIndex] = updatedTodo;
  await saveData();
  
  console.log(`✏️ Updated todo #${id}: "${updatedTodo.title}"`);
  res.json({ success: true, data: updatedTodo });
});

// Toggle todo completion
app.patch('/api/todos/:id/toggle', async (req, res) => {
  const id = parseInt(req.params.id);
  const todoIndex = todos.findIndex(t => t.id === id);
  
  if (todoIndex === -1) {
    console.log(`❌ Cannot toggle: Todo #${id} not found`);
    return res.status(404).json({ success: false, message: 'Todo not found' });
  }
  
  todos[todoIndex].completed = !todos[todoIndex].completed;
  todos[todoIndex].updatedAt = new Date().toISOString();
  
  await saveData();
  
  const status = todos[todoIndex].completed ? '✔️ Completed' : '⭕ Incomplete';
  console.log(`${status} todo #${id}: "${todos[todoIndex].title}"`);
  
  res.json({ success: true, data: todos[todoIndex] });
});

// Delete todo
app.delete('/api/todos/:id', async (req, res) => {
  const id = parseInt(req.params.id);
  const todoIndex = todos.findIndex(t => t.id === id);
  
  if (todoIndex === -1) {
    console.log(`❌ Cannot delete: Todo #${id} not found`);
    return res.status(404).json({ success: false, message: 'Todo not found' });
  }
  
  const deletedTodo = todos.splice(todoIndex, 1)[0];
  await saveData();
  
  console.log(`🗑️ Deleted todo #${id}: "${deletedTodo.title}"`);
  res.json({ success: true, data: deletedTodo });
});

// Delete all completed todos
app.delete('/api/todos/completed/all', async (req, res) => {
  const initialLength = todos.length;
  todos = todos.filter(t => !t.completed);
  const deletedCount = initialLength - todos.length;
  
  await saveData();
  
  console.log(`🗑️ Deleted ${deletedCount} completed todos`);
  res.json({ success: true, message: `Deleted ${deletedCount} completed todos` });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', todos: todos.length });
});

// Start server
async function startServer() {
  await loadData();
  app.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log(`🚀 Todo API server running on http://localhost:${PORT}`);
    console.log(`📊 Loaded ${todos.length} todos from storage`);
    console.log('='.repeat(50));
  });
}

startServer();