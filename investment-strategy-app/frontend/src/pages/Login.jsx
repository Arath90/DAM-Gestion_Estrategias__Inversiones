import React, { useReducer, useState } from 'react';
import Notification from '../components/Notification';
import { useAuth } from '../hooks/useAuth';
import axios from 'axios';
import {
  Input,
  Button,
  Title,
  Link as Ui5Link,
  BusyIndicator,
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

const API_BASE =
  (import.meta?.env?.VITE_API_URL && String(import.meta.env.VITE_API_URL).trim()) ||
  'http://localhost:4004/odata/v4/catalog';

const buildUrl = (path) => `${API_BASE.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;

const collectDataRes = (node) => {
  if (!node || typeof node !== 'object') return [];
  const bucket = [];
  const dataRes = node.dataRes;
  if (Array.isArray(dataRes)) bucket.push(...dataRes);
  else if (dataRes && typeof dataRes === 'object') bucket.push(dataRes);
  if (Array.isArray(node.data)) {
    for (const entry of node.data) bucket.push(...collectDataRes(entry));
  }
  return bucket;
};

const normalizePayload = (payload) => {
  if (Array.isArray(payload?.value)) {
    const collected = payload.value.flatMap(collectDataRes);
    return collected.length ? collected : payload.value;
  }
  const collected = collectDataRes(payload);
  if (collected.length) return collected;
  return Array.isArray(payload) ? payload : payload ? [payload] : [];
};

const serializeParams = (params = {}) => {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    searchParams.append(key, value);
  });
  return searchParams.toString().replace(/\+/g, '%20');
};

const Login = () => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [showNotification, setShowNotification] = useState(false);
  const { setUser } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    dispatch({ type: 'field', field: e.target.name, value: e.target.value });
  };

  const validateEmail = (email) =>
    /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/.test(email);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!state.email || !state.password) {
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
      dispatch({
        type: 'error',
        value: 'La contrasena debe tener al menos 5 caracteres',
      });
      setShowNotification(true);
      return;
    }

    dispatch({ type: 'loading' });

    try {
      const sanitize = (value = '') => String(value).replace(/'/g, "''");
      const params = {
        ProcessType: 'READ',
        dbServer: 'MongoDB',
        LoggedUser: state.email,
        $filter: `email eq '${sanitize(state.email)}' and pass eq '${sanitize(state.password)}'`,
        $top: 1,
      };

      const { data } = await axios.get(buildUrl('SecUsers'), {
        params,
        paramsSerializer: { serialize: serializeParams },
      });

      const records = normalizePayload(data);
      const userRecord =
        Array.isArray(records) && records.length ? records[0] : null;

      if (userRecord) {
        const sessionUser = {
          ID: userRecord.ID,
          name: userRecord.name || userRecord.user || '',
          user: userRecord.user || '',
          email: userRecord.email || state.email,
        };
        setUser(sessionUser);
        localStorage.setItem('auth_user', JSON.stringify(sessionUser));
        dispatch({ type: 'reset' });
        navigate('/dashboard');
        return;
      }
    } catch (error) {
      console.error('Login error', error);
      dispatch({
        type: 'error',
        value:
          'No se pudo conectar al servidor. Puedes probar con datos locales.',
      });
      setShowNotification(true);
      return;
    }

    dispatch({ type: 'error', value: 'Credenciales invalidas' });
    setShowNotification(true);
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
          <div className="img-portada login-img"></div>
          <div className="login-form">
            <Title level="H3" className="font-title login-title">
              Bienvenido a <span>Login</span>
            </Title>
            <div className="font-secondary login-subtitle">
              Ingresa tus credenciales para acceder a tu cuenta.
            </div>
            <form
              onSubmit={handleSubmit}
              style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
            >
              <div className="login-input">
                <span className="login-input-icon">
                  <ui5-icon
                    name="email"
                    style={{ verticalAlign: 'middle' }}
                  ></ui5-icon>
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
                  <ui5-icon
                    name="locked"
                    style={{ verticalAlign: 'middle' }}
                  ></ui5-icon>
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
              <Button
                type="Submit"
                design="Emphasized"
                disabled={state.loading}
                className="login-btn"
              >
                {state.loading ? <BusyIndicator active size="Small" /> : 'Entrar'}
              </Button>
              <div className="login-link">
                No tienes cuenta?{' '}
                <Ui5Link href="/register" className="register-link">
                  Registrate
                </Ui5Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default Login;
