import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { handleProcessAnswer } from './api';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

// API Endpoints
app.post('/api/process-answer', async (req, res) => {
  try {
    const result = await handleProcessAnswer(req.body);
    res.json(result);
  } catch (error) {
    console.error('Error processing answer:', error);
    res.status(500).json({ error: 'Failed to process answer' });
  }
});

// Production Static Serving
const distPath = path.resolve(process.cwd(), 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(distPath, 'index.html'));
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
