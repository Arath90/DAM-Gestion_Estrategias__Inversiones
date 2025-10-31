import React, { useEffect, useState } from "react";
import "../assets/css/Configuracion.css";
import "../assets/globalAssets.css";
import { Button, Switch } from "@ui5/webcomponents-react";
import { useConfiguracionController } from "../controllers/ConfiguracionController";


const Configuracion = () => {
  const { onLogoutPress, currentTheme, onThemeSwitch } =
    useConfiguracionController();

  const [theme, setThemeState] = useState(currentTheme);
  useEffect(() => {
    setThemeState(currentTheme);
  }, [currentTheme]);

  return (
    <div className="page-configuracion">
      <h2>Configuración</h2>
      <p>Opciones de configuración del sistema.</p>

      {/* Sección Interfaz */}
      <h3
        style={{
          marginTop: 32,
          marginBottom: 8,
          color: "var(--project-color4)",
          fontWeight: 700,
        }}
      >
        Interfaz
      </h3>
      <hr
        style={{
          border: 0,
          borderTop: "2px solid var(--project-color3)",
          margin: "0 0 24px 0",
        }}
      />
      <div
        style={{
          margin: "0 0 16px 0",
          display: "flex",
          alignItems: "center",
          gap: 24,
          width: "fit-content",
        }}
      >
        <span style={{ fontWeight: 500, color: "var(--project-color4)" }}>
          Modo {theme === "dark" ? "Oscuro" : "Claro"}
        </span>
        <Switch
          checked={theme === "dark"}
          onChange={() => {
            onThemeSwitch();
            setThemeState(theme === "dark" ? "light" : "dark");
          }}
          textOn="O"
          textOff="C"
        />
      </div>

      {/* Sección Sistema */}
      <h3
        style={{
          marginTop: 32,
          marginBottom: 8,
          color: "var(--project-color4)",
          fontWeight: 700,
        }}
      >
        Sistema
      </h3>
      <hr
        style={{
          border: 0,
          borderTop: "2px solid var(--project-color3)",
          margin: "0 0 24px 0",
        }}
      />
      <Button
        design="Negative"
        icon="log"
        onClick={onLogoutPress}
        style={{ marginTop: 0 }}
      >
        Cerrar sesión?
      </Button>
    </div>
  );
};

export default Configuracion;
