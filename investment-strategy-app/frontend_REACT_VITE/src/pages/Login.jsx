import React, { useReducer } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import axios from 'axios';
import '../css/auth.css';

const initialState = {
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

const Login = () => {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { login } = useAuth();
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
    dispatch({ type: 'error', value: '' });

    // Enviar datos del login al backend con Axios
    try {
      const response = await axios.post('http://localhost:4004/odata/v4/catalog/SecUsers', {
        email: state.email,
        pass: state.password,
      });
      // Maneja la respuesta del backend aquí
      // Si el login es exitoso, navega y resetea el form
      if (response.data.success) {
        dispatch({ type: 'reset' });
        navigate('/');
      } else {
        dispatch({ type: 'error', value: response.data.error || 'Credenciales inválidas' });
      }
    } catch (error) {
      dispatch({ type: 'error', value: 'Error de conexión o credenciales inválidas' });
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
        <button type="submit">Entrar</button>
        <div className="auth-link">
          <Link to="/register">¿No tienes cuenta? Regístrate</Link>
        </div>
      </form>
    </div>
  );
};

export default Login;