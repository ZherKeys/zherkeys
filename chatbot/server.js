const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const memoryManager = require('./core/memoryManager');
const brain = require('./core/brain');
const chatRoutes = require('./routes/chat');

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(bodyParser.json());

// mount routes
app.use('/api/chat', chatRoutes);

app.get('/', (req, res) => res.json({ ok: true, name: 'Zher Chatbot' }));

app.listen(port, () => {
  console.log(`Zher Chatbot listening on ${port}`);
});
