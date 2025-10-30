import React, { useReducer, useState } from 'react';
import Notification from '../components/Notification';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  Input,
  Button,
  Title,
  Link as Ui5Link,
} from '@ui5/webcomponents-react';
import '../assets/globalAssets.css';

// Mismo patrón que Login: usamos reducer para mantener el form prolijo.
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
  const { register } = useAuth(); // hook reutiliza el mismo backend auth.
  const navigate = useNavigate();

  const handleChange = (e) => {
    dispatch({ type: 'field', field: e.target.name, value: e.target.value });
    if (state.error) {
      dispatch({ type: 'error', value: '' });
      setShowNotification(false);
    }
  };

  const validateEmail = (email) => /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!state.name || !state.user || !state.email || !state.password) {
      dispatch({ type: 'error', value: 'Todos los campos son obligatorios' });
      setShowNotification(true);
      return;
    }
    if (!validateEmail(state.email)) {
      dispatch({ type: 'error', value: 'El correo no es valido' });
      setShowNotification(true);
      return;
    }
    if (state.password.length < 5) {
      dispatch({ type: 'error', value: 'La contrasena debe tener al menos 5 caracteres' });
      setShowNotification(true);
      return;
    }
    dispatch({ type: 'error', value: '' });

    const result = await register({
      name: state.name,
      user: state.user,
      email: state.email,
      password: state.password,
    });

    if (result.success) {
      dispatch({ type: 'reset' });
      navigate('/dashboard'); // ya inicia sesión automáticamente.
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
          <div className="register-img img-portada-register"></div>
          <div className="register-form">
            <Title level="H3" className="register-title">
              Crear <span>Cuenta</span>
            </Title>

            <div className="register-subtitle">
              Registrate para acceder a la plataforma.
            </div>

            <form onSubmit={handleSubmit} className="register-form-fields">
              <div className="register-input">
                <span className="register-input-icon">
                  <ui5-icon name="employee" style={{ verticalAlign: 'middle' }}></ui5-icon>
                </span>
                <Input
                  id="register-name"
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
                  id="register-user"
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
                  id="register-email"
                  name="email"
                  type="Email"
                  placeholder="Correo electronico"
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
                  id="register-password"
                  name="password"
                  type="Password"
                  placeholder="Contrasena"
                  value={state.password}
                  onInput={handleChange}
                  required
                  className="register-input-field"
                />
              </div>

              <Button type="Submit" design="Emphasized" className="register-btn">
                Registrarse
              </Button>

              <div className="register-link">
                Ya tienes cuenta?{' '}
                <Ui5Link href="/login" className="login-link">
                  Inicia sesion
                </Ui5Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default Register;
