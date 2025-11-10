import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Title,
  Text,
  List,
  Avatar,
  Icon,
} from "@ui5/webcomponents-react";
import "../assets/css/Inicio.css";
import "../assets/fonts/projectFonts.css";
import { useAuth } from "../hooks/useAuth";

const quickAccess = [
  { key: "instrumentos", text: "Instrumentos", icon: "tools-opportunity" },
  { key: "estrategias", text: "Estrategias", icon: "bo-strategy-management" },
  { key: "mercado", text: "Mercado", icon: "trend-up" },
];

const news = [
  { title: "Mercado al alza", desc: "El mercado muestra señales positivas esta semana." },
  { title: "Nueva estrategia disponible", desc: "Explora la nueva estrategia de momentum en tu panel." },
  { title: "Tip: Diversifica", desc: "Recuerda diversificar tu portafolio para reducir riesgos." },
];

const Inicio = ({ navigate: propNavigate }) => {
  const { user } = useAuth();
  const displayName = user?.name || user?.email || "Usuario";
  const navigate = propNavigate || useNavigate();

  return (
    <div className="inicio-root">
      <div className="inicio-card">
        <div className="inicio-header">
          <Avatar icon="user-settings" backgroundColorSet="Accent1" size="L" />
          <Title level="H2" className="inicio-title">
            Bienvenido a la Plataforma de Estrategias de Inversión
          </Title>
          <Text className="inicio-saludo">{`Hola, ${displayName}`}</Text>
        </div>
        <div className="inicio-content">
          <Title level="H4" className="inicio-subtitle">
            Gestiona, analiza y potencia tus inversiones de manera inteligente
          </Title>
          <Text className="inicio-desc">
            Accede a herramientas avanzadas, estrategias personalizadas y monitorea el mercado en tiempo real.
          </Text>
          <div className="inicio-quickaccess">
            {quickAccess.map((item) => (
              <Button
                key={item.key}
                icon={item.icon}
                design="Emphasized"
                className="inicio-btn"
                onClick={() => navigate(`/dashboard/${item.key}`)}
              >
                {item.text}
              </Button>
            ))}
          </div>
        </div>
        <div className="inicio-news-wrapper">
          <div className="inicio-news-card">
            <div className="inicio-news-header">
              <Icon name="message-information" className="inicio-news-icon" />
              <Title level="H5" className="inicio-news-title">Noticias y Tips</Title>
            </div>
            <div className="inicio-news-list-wrapper">
              <List className="inicio-news-list">
                <ul className="inicio-news-ul">
                  {news.map((n, idx) => (
                    <li key={idx} className="inicio-news-li">
                      <b>{n.title}:</b> {n.desc}
                    </li>
                  ))}
                </ul>
              </List>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


export default Inicio;
