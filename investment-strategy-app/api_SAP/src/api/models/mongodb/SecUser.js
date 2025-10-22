const mongoose = require('mongoose');

/**
 * SecUser
 * Usuarios del sistema con credenciales para autenticacion interna.
 */
module.exports = mongoose.models.SecUser || mongoose.model('SecUser',
  new mongoose.Schema({
    // Nombre completo del usuario, indexado para busquedas rapidas.
    name: { type: String, required: true, index: true },
    // Username para login.
    user: { type: String, required: true, index: true },
    // Correo electronico utilizado para notificaciones y recuperacion.
    email: { type: String, required: true, index: true },
    // Hash de la contraseña. String porque se almacena codificado.
    pass: { type: String, required: true },
    // Auditoria (fecha de alta y ultima actualizacion).
    createdAt: Date,
    updatedAt: Date
  }, { versionKey: false })
);
