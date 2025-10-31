import React from "react";
import { FlexBox, Title, Text } from "@ui5/webcomponents-react";
import "../assets/css/Inicio.css";

const Inicio = () => (
  <FlexBox direction="Column" alignItems="Start" className="inicio-container">
    <Title level="H2" className="inicio-title">
      Inicio
    </Title>
    <Text className="inicio-desc">
      Bienvenido al panel principal de estrategias de inversión.
    </Text>
  </FlexBox>
);

export default Inicio;
