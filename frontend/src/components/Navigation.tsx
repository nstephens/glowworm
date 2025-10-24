import React from 'react';
import { Navigation as NewNavigation } from './layout/Navigation';

interface NavigationProps {
  children: React.ReactNode;
  headerContent?: React.ReactNode;
}

export const Navigation: React.FC<NavigationProps> = ({ children, headerContent }) => {
  return (
    <NewNavigation headerContent={headerContent}>
      {children}
    </NewNavigation>
  );
};

export default Navigation;
