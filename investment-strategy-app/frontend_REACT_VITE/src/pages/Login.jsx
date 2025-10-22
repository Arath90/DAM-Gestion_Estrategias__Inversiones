import React, { useReducer } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import axios from 'axios';
import '../css/auth.css';

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
  const { setUser } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    dispatch({ type: 'field', field: e.target.name, value: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!state.email || !state.password) {
      dispatch({ type: 'error', value: 'Todos los campos son obligatorios' });
      return;
    }

    dispatch({ type: 'loading' });

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
        // Guardar usuario y token en el contexto y localStorage
        setUser(user);
        localStorage.setItem('auth_user', JSON.stringify(user));
        if (response.data?.token) {
          localStorage.setItem('auth_token', response.data.token);
        }
        dispatch({ type: 'reset' });
        navigate('/');
      } else {
        dispatch({ type: 'error', value: 'Credenciales inválidas' });
      }
    } catch (error) {
      const errorMessage =
        error.response?.data?.error?.message || 'Error de conexión o credenciales inválidas';
      dispatch({ type: 'error', value: errorMessage });
    }
  };

  const inputProps = [
    { type: 'email', name: 'email', placeholder: 'Correo electrónico', value: state.email },
    { type: 'password', name: 'password', placeholder: 'Contraseña', value: state.password },
  ];

  return (
    <div className="auth-container">
      <h2>Iniciar Sesión</h2>
      <form onSubmit={handleSubmit} className="auth-form">
        {inputProps.map((props) => (
          <input
            key={props.name}
            {...props}
            onChange={handleChange}
            required
          />
        ))}
        {state.error && <div className="error">{state.error}</div>}
        <button type="submit" disabled={state.loading}>
          {state.loading ? 'Cargando...' : 'Entrar'}
        </button>
        <div className="auth-link">
          <Link to="/register">¿No tienes cuenta? Regístrate</Link>
        </div>
      </form>
    </div>
  );
};

export default Login;