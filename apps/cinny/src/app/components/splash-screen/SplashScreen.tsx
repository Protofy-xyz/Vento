import { Box, Text, color } from 'folds';
import React, { ReactNode } from 'react';

type SplashScreenProps = {
  children: ReactNode;
};
export function SplashScreen({ children }: SplashScreenProps) {
  // Usar las variables de Folds (que están mapeadas a Vento via colors.css.ts)
  const splashStyle: React.CSSProperties = {
    minHeight: '100%',
    backgroundColor: color.Background.Container,
    color: color.Background.OnContainer,
    display: 'flex',
    flexDirection: 'column',
    // Patrón de puntos
    backgroundImage: `radial-gradient(${color.Background.ContainerActive} 2px, ${color.Background.Container} 2px)`,
    backgroundSize: '40px 40px',
  };

  const footerStyle: React.CSSProperties = {
    padding: '16px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <div style={splashStyle}>
      {children}
      <div style={footerStyle}>
        <Text size="H2" align="Center">
          Vento
        </Text>
      </div>
    </div>
  );
}
