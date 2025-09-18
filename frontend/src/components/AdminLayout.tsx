import React from 'react';
import Navigation from './Navigation';

interface AdminLayoutProps {
  children: React.ReactNode;
  headerContent?: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children, headerContent }) => {
  return (
    <Navigation headerContent={headerContent}>
      {children}
    </Navigation>
  );
};

export default AdminLayout;
