import React, { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ShellBar,
  ShellBarItem,
  SideNavigation,
  SideNavigationItem,
  Avatar,
  Panel,
  Title,
  Text,
  FlexBox,
  Button,
} from "@ui5/webcomponents-react";

const menuOptions = [
  { key: "inicio", text: "Inicio", icon: "home" },
  { key: "instrumentos", text: "Instrumentos", icon: "tools-opportunity" },
  { key: "mercado", text: "Mercado", icon: "trend-up" },
  { key: "estrategias", text: "Estrategias", icon: "bo-strategy-management" },
  { key: "datasets", text: "Datasets", icon: "database" },
  { key: "rendimiento", text: "Rendimiento", icon: "line-chart" },
  { key: "ordenes", text: "Órdenes", icon: "sales-order" },
  { key: "riesgos", text: "Riesgos", icon: "shield" },
  { key: "configuracion", text: "Configuración", icon: "settings" },
];

const Dashboard = ({ panelContent }) => {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!user) {
      navigate("/login", { replace: true });
    }
  }, [user, navigate]);

  const handleMenuToggle = () => setCollapsed((prev) => !prev);
  const handleMenuClick = (key) => {
    navigate(`/dashboard/${key}`);
  };

  if (!user) {
    return (
      <FlexBox
        direction="Column"
        style={{
          minHeight: "100vh",
          background: "var(--sapBackgroundColor)",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ShellBar
          primaryTitle="Estrategias de Inversión"
          profile={<Avatar icon="employee" />}
        >
          <ShellBarItem icon="locked" text="Acceso restringido" />
        </ShellBar>
        <Panel
          style={{ marginTop: 32, minWidth: 340, maxWidth: 480 }}
          headerText="Acceso restringido"
        >
          <Title level="H2">Acceso restringido</Title>
          <Text>Por favor inicia sesión para acceder al sistema.</Text>
        </Panel>
      </FlexBox>
    );
  }

  const displayName = user.name || user.email || "Usuario";
  // Determinar la ruta activa
  const activeKey = location.pathname.replace("/dashboard/", "") || "inicio";

  return (
    <FlexBox direction="Column" className="dashboard-root">
      <ShellBar
        profile={<Avatar>{displayName[0]}</Avatar>}
        className="dashboard-shellbar"
      >
        <span slot="startButton" className="dashboard-title">
          Estrategias de Inversión
        </span>
        <ShellBarItem
          icon="menu"
          text={collapsed ? "Expandir menú" : "Colapsar menú"}
          onClick={handleMenuToggle}
        />
        <ShellBarItem icon="log" text="Cerrar sesión" onClick={logout} />
      </ShellBar>
      <FlexBox className="dashboard-content">
        <SideNavigation
          collapsed={collapsed}
          className={`dashboard-sidenav${collapsed ? " collapsed" : ""}`}
          onSelectionChange={(e) => handleMenuClick(e.detail.item.dataset.key)}
          selectedItem={activeKey}
        >
          {menuOptions.map((opt) => (
            <SideNavigationItem
              key={opt.key}
              icon={opt.icon}
              text={opt.text}
              data-key={opt.key}
              selected={activeKey === opt.key}
              className="dashboard-sidenav-item"
            />
          ))}
        </SideNavigation>
        <Panel className="dashboard-panel">{panelContent}</Panel>
      </FlexBox>
    </FlexBox>
  );
};

export default Dashboard;
