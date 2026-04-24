import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { ActionIcon } from '@mantine/core';
import { IconMenu2 } from '@tabler/icons-react';
import Sidebar from './Sidebar';

export default function AppLayout() {
  const [sidebarOpened, setSidebarOpened] = useState(false);

  return (
    <div className="app-layout">
      <Sidebar
        opened={sidebarOpened}
        onClose={() => setSidebarOpened(false)}
      />

      <div className="content-area">
        <div className="content-topbar">
          <ActionIcon
            variant="subtle"
            color="gray"
            hiddenFrom="sm"
            onClick={() => setSidebarOpened(!sidebarOpened)}
            size="lg"
          >
            <IconMenu2 size={20} />
          </ActionIcon>
          <div />
        </div>

        <div className="content-main">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
