
import { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';

interface Props {
  children: React.ReactNode;
}

export default function AppLayout({ children }: Props) {
  const [sidebarWidth, setSidebarWidth] = useState(240);

  useEffect(() => {
    // Helper to safely read the sidebar width
    const updateWidth = () => {
      const aside = document.querySelector('aside');
      if (aside) {
        setSidebarWidth(aside.offsetWidth);
      }
    };

    // Observe class changes that may affect the width
    const observer = new MutationObserver(updateWidth);
    const aside = document.querySelector('aside');

    if (aside) {
      updateWidth();
      observer.observe(aside, {
        attributes: true,
        attributeFilter: ['class'],
      });
    }

    // Fallback polling (in case the observer misses a change)
    const interval = setInterval(updateWidth, 350);

    // Cleanup
    return () => {
      observer.disconnect();
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <div
        className="transition-all duration-300"
        style={{ marginLeft: sidebarWidth }}
      >
        <TopBar />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
