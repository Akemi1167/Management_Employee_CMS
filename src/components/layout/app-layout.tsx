import { Outlet } from 'react-router-dom';
import { Sidebar } from './sidebar';

export function AppLayout() {
  return (
    <div className="flex h-screen overflow-hidden bg-[#0e1016] text-[#eef0f6]">
      <Sidebar />
      <main className="relative min-w-0 flex-1 overflow-y-auto bg-[#0e1016] bg-grid text-[#eef0f6]">
        <div className="min-h-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
