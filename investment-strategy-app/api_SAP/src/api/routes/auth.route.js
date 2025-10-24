'use strict';

const express = require('express');
const SecUser = require('../models/mongodb/SecUser');
const { createSession, destroySession, getSession } = require('../services/session.service');

const router = express.Router();

// Permitimos que el token llegue por header, body o query (el front usa header).
const pickToken = (req) =>
  req.headers['x-session-token'] ||
  req.headers['x-session'] ||
  req.body?.sessionToken ||
  req.query?.sessionToken ||
  null;

const normalizeEmail = (email = '') => String(email).trim().toLowerCase();

// Payload limpio que recibe el frontend; no exponemos pass ni campos internos.
const buildUserResponse = (userDoc) => ({
  ID: userDoc?._id?.toString?.() || userDoc?.ID || null,
  name: userDoc?.name || userDoc?.user || '',
  user: userDoc?.user || '',
  email: userDoc?.email || '',
});

// LOGIN: recibe credenciales, valida contra Mongo y entrega token + usuario.
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email y password son requeridos.' });
    }

    const sanitizedEmail = normalizeEmail(email);
    const user = await SecUser.findOne({ email: sanitizedEmail });
    if (!user || user.pass !== password) {
      return res.status(401).json({ success: false, message: 'Credenciales invalidas.' });
    }

    const session = createSession({ id: user._id, email: user.email, name: user.name, user: user.user });
    return res.json({
      success: true,
      token: session.token,
      expiresAt: session.expiresAt,
      user: buildUserResponse(user),
    });
  } catch (err) {
    console.error('[auth.login] error', err);
    return res.status(500).json({ success: false, message: 'No se pudo iniciar sesion.' });
  }
});

// REGISTER: crea el usuario y devuelve sesión activa para que el front no tenga que loguearse después.
router.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password, user: username } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Nombre, email y password son requeridos.' });
    }

    const sanitizedEmail = normalizeEmail(email);
    const existing = await SecUser.findOne({ email: sanitizedEmail });
    if (existing) {
      return res.status(409).json({ success: false, message: 'El correo ya esta registrado.' });
    }

    const now = new Date();
    const newUser = await SecUser.create({
      name,
      user: username || sanitizedEmail,
      email: sanitizedEmail,
      pass: password,
      createdAt: now,
      updatedAt: now,
    });

    const session = createSession({ id: newUser._id, email: newUser.email, name: newUser.name, user: newUser.user });
    return res.status(201).json({
      success: true,
      token: session.token,
      expiresAt: session.expiresAt,
      user: buildUserResponse(newUser),
    });
  } catch (err) {
    console.error('[auth.register] error', err);
    return res.status(500).json({ success: false, message: 'No se pudo registrar el usuario.' });
  }
});

// LOGOUT: invalidamos el token en memoria (si ya expiró simplemente no pasa nada).
router.post('/auth/logout', (req, res) => {
  const token = pickToken(req);
  if (token) destroySession(token);
  return res.json({ success: true });
});

// Helper opcional: el front podría usarlo para refrescar sesión si se quiere.
router.get('/auth/session', (req, res) => {
  const token = pickToken(req);
  if (!token) return res.status(401).json({ success: false, message: 'Token requerido.' });
  const session = getSession(token);
  if (!session) return res.status(401).json({ success: false, message: 'Sesion expirada o invalida.' });
  return res.json({
    success: true,
    token: session.token,
    expiresAt: session.expiresAt,
    user: session.user,
  });
});

module.exports = function registerAuthRoutes(app) {
  if (!app || typeof app.use !== 'function') return;
  app.use('/api', router); // montamos todo bajo /api para mantener orden con las rutas públicas.
};
