
import React, { useReducer } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import '../css/auth.css';
import axios from 'axios';

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
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    dispatch({ type: 'field', field: e.target.name, value: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!state.name || !state.email || !state.password) {
      dispatch({ type: 'error', value: 'Todos los campos son obligatorios' });
      return;
    }
    dispatch({ type: 'error', value: '' });
    const result = register({ name: state.name, email: state.email, password: state.password });
    const add = ({ name: state.name,user: state.user , email: state.email, pass: state.password });
    if (result.success) {
      axios.post('http://localhost:4004/odata/v4/catalog/SecUsers?ProcessType=AddOne&dbServer=mongo&LoggedUser='+state.user,add)
      dispatch({ type: 'reset' });
      navigate('/');
    } else {
      dispatch({ type: 'error', value: result.error });
    }
  };

  const inputProps = [
    { type: 'text', name: 'name', placeholder: 'Nombre', value: state.name },
    { type: 'email', name: 'email', placeholder: 'Correo electrónico', value: state.email },
    { type: 'text', name: 'user', placeholder: 'Usuario', value: state.user},
    { type: 'password', name: 'password', placeholder: 'Contraseña', value: state.password },
    
  ];

  return (
    <div className="auth-container">
      <h2>Registro</h2>
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
        <button type="submit">Registrarse</button>
        <div className="auth-link">
          <Link to="/login">¿Ya tienes cuenta? Inicia sesión</Link>
        </div>
      </form>
    </div>
  );
};

export default Register;
