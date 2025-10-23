import React, { useReducer } from 'react';
import { useState } from 'react';
import Notification from '../components/Notification';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import axios from 'axios';
import {
  Input,
  Button,
  Title,
  Link as Ui5Link,
  Label
} from '@ui5/webcomponents-react';
import '../assets/globalAssets.css';

const initialState = {
  name: '',
  user: '',
  email: '',
  password: '',
  error: '',
};

function reducer(state, action) {
  switch (action.type) {
    case 'field':
      return { ...state, [action.field]: action.value };
    case 'error':
      return { ...state, error: action.value };
    case 'reset':
      return { ...initialState };
    default:
      return state;
  }
}

const Register = () => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [showNotification, setShowNotification] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    dispatch({ type: 'field', field: e.target.name, value: e.target.value });
    if (state.error) {
      dispatch({ type: 'error', value: '' });
      setShowNotification(false);
    }
  };

  const validateEmail = (email) => {
    return /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!state.name || !state.user || !state.email || !state.password) {
      dispatch({ type: 'error', value: 'Todos los campos son obligatorios' });
      setShowNotification(true);
      return;
    }
    if (!validateEmail(state.email)) {
      dispatch({ type: 'error', value: 'El correo no es válido' });
      setShowNotification(true);
      return;
    }
    if (state.password.length < 6) {
      dispatch({ type: 'error', value: 'La contraseña debe tener al menos 6 caracteres' });
      setShowNotification(true);
      return;
    }
    dispatch({ type: 'error', value: '' });

    const add = {
      name: state.name,
      user: state.user,
      email: state.email,
      pass: state.password
    };

    const result = register({
      name: state.name,
      email: state.email,
      password: state.password
    });

    if (result.success) {
      axios.post(
        `http://localhost:4004/odata/v4/catalog/SecUsers?ProcessType=AddOne&dbServer=mongo&LoggedUser=${state.user}`,
        add
      );
      dispatch({ type: 'reset' });
      navigate('/');
    } else {
      dispatch({ type: 'error', value: result.error });
      setShowNotification(true);
    }
  };

  return (
    <>
      <Notification
        message={state.error}
        open={!!state.error && showNotification}
        onClose={() => setShowNotification(false)}
      />
      <div className="register-bg">
        <div className="register-card">
          {/* Sección izquierda con imagen */}
          <div className="register-img img-portada-register"></div>

          {/* Sección derecha con formulario */}
          <div className="register-form">
            <Title level="H3" className="register-title">
              Crear <span>Cuenta</span>
            </Title>

            <div className="register-subtitle">
              Regístrate para acceder a la plataforma.
            </div>

            <form onSubmit={handleSubmit} className="register-form-fields">
              <div className="register-input">
                <span className="register-input-icon">
                  <ui5-icon name="employee" style={{ verticalAlign: 'middle' }}></ui5-icon>
                </span>
                <Input
                  id="name"
                  name="name"
                  type="Text"
                  placeholder="Nombre"
                  value={state.name}
                  onInput={handleChange}
                  required
                  className="register-input-field"
                />
              </div>

              <div className="register-input">
                <span className="register-input-icon">
                  <ui5-icon name="user-settings" style={{ verticalAlign: 'middle' }}></ui5-icon>
                </span>
                <Input
                  id="user"
                  name="user"
                  type="Text"
                  placeholder="Usuario"
                  value={state.user}
                  onInput={handleChange}
                  required
                  className="register-input-field"
                />
              </div>

              <div className="register-input">
                <span className="register-input-icon">
                  <ui5-icon name="email" style={{ verticalAlign: 'middle' }}></ui5-icon>
                </span>
                <Input
                  id="email"
                  name="email"
                  type="Email"
                  placeholder="Correo electrónico"
                  value={state.email}
                  onInput={handleChange}
                  required
                  className="register-input-field"
                />
              </div>

              <div className="register-input">
                <span className="register-input-icon">
                  <ui5-icon name="locked" style={{ verticalAlign: 'middle' }}></ui5-icon>
                </span>
                <Input
                  id="password"
                  name="password"
                  type="Password"
                  placeholder="Contraseña"
                  value={state.password}
                  onInput={handleChange}
                  required
                  className="register-input-field"
                />
              </div>

              <Button type="Submit" design="Emphasized" className="register-btn">
                Registrarse
              </Button>

              <div className="register-link">¿Ya tienes cuenta? <Ui5Link href="/login" className="login-link">Inicia sesión</Ui5Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default Register;
