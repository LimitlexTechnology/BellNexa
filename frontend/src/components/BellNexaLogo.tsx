import React from 'react';

interface BellNexaLogoProps {
  className?: string;
}

export const BellNexaLogo: React.FC<BellNexaLogoProps> = ({ className = '' }) => (
  <img
    src="/bellnexa-logo.png"
    alt="BellNexa"
    className={`object-contain ${className}`}
  />
);
