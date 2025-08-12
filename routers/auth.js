import express from 'express';
import { register, login } from '../controllers/authController.js';

const router = express.Router();

// NB : register should be removed !!
router.post('/register', register);
router.post('/login', login);

export default router;
