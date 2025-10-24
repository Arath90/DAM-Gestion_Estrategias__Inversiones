import React, { useReducer } from 'react';
import { useState } from 'react';
import Notification from '../components/Notification';
import { useAuth } from '../hooks/useAuth';
import axios from 'axios';
import {
  Input,
  Button,
  Title,
  Panel,
  Link as Ui5Link,
  Form,
  Label,
  BusyIndicator
} from '@ui5/webcomponents-react';
import { useNavigate } from 'react-router-dom';

const initialState = {
  email: '',
  password: '',
  error: '',
  loading: false,
};


function reducer(state, action) {
  switch (action.type) {
    case 'field':
      return { ...state, [action.field]: action.value };
    case 'error':
      return { ...state, error: action.value, loading: false };
    case 'loading':
      return { ...state, loading: true, error: '' };
    case 'reset':
      return { ...initialState };
    default:
      return state;
  }
}


const Login = () => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [showNotification, setShowNotification] = useState(false);
  const { setUser } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    dispatch({ type: 'field', field: e.target.name, value: e.target.value });
  };

  const validateEmail = (email) => {
    return /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!state.email || !state.password) {
      dispatch({ type: 'error', value: 'Todos los campos son obligatorios' });
      setShowNotification(true);
      return;
    }
    if (!validateEmail(state.email)) {
      dispatch({ type: 'error', value: 'El correo no es válido' });
      setShowNotification(true);
      return;
    }
    if (state.password.length < 5) {
      dispatch({ type: 'error', value: 'La contraseña debe tener al menos 5 caracteres' });
      setShowNotification(true);
      return;
    }

    dispatch({ type: 'loading' });

    // Intentar login, pero si el backend no responde, mostrar error y continuar
    try {
      const response = await axios.get(
        `http://localhost:4004/odata/v4/catalog/SecUsers?ProcessType=READ&dbServer=mongo&LoggedUser=${state.email}`,
        {
          params: {
            email: state.email,
            pass: state.password,
          },
        }
      );

      const user = response.data?.value?.[0] || response.data?.dataRes?.[0];
      if (user) {
        setUser(user);
        localStorage.setItem('auth_user', JSON.stringify(user));
        if (response.data?.token) {
          localStorage.setItem('auth_token', response.data.token);
        }
        dispatch({ type: 'reset' });
        navigate('/dashboard'); // Redirige al dashboard tras login exitoso
      } else {
        dispatch({ type: 'error', value: 'Credenciales inválidas' });
        setShowNotification(true);
      }
    } catch (error) {
      dispatch({ type: 'error', value: 'No se pudo conectar al servidor. Puedes probar con datos locales.' });
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
      <div className="font-primary login-bg">
        <div className="login-card">
          {/* Left image section con portada */}
          <div className="img-portada login-img"></div>
          {/* Right form section */}
          <div className="login-form">
            <Title level="H3" className="font-title login-title">
              Bienvenido a <span>Login</span>
            </Title>
            <div className="font-secondary login-subtitle">
              Ingresa tus credenciales para acceder a tu cuenta.
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div className="login-input">
                <span className="login-input-icon">
                  <ui5-icon name="email" style={{ verticalAlign: 'middle' }}></ui5-icon>
                </span>
                <Input
                  id="email"
                  name="email"
                  type="Email"
                  placeholder="Email"
                  value={state.email}
                  onInput={handleChange}
                  required
                  className="login-input-field"
                />
              </div>
              <div className="login-input">
                <span className="login-input-icon">
                  <ui5-icon name="locked" style={{ verticalAlign: 'middle' }}></ui5-icon>
                </span>
                <Input
                  id="password"
                  name="password"
                  type="Password"
                  placeholder="Password"
                  value={state.password}
                  onInput={handleChange}
                  required
                  className="login-input-field"
                />
              </div>
              <Button type="Submit" design="Emphasized" disabled={state.loading} className="login-btn">
                {state.loading ? <BusyIndicator active size="Small" /> : 'Entrar'}
              </Button>
              <div className="login-link">
                ¿No tienes cuenta? <Ui5Link href="/register" className="register-link">Regístrate</Ui5Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

export default Login;
