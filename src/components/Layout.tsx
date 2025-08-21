import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  LogOut,
  Users,
  Calendar,
  Pill,
  BarChart3,
  UserCheck,
  Heart,
  Activity,
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const operatorNavItems = [
    { path: '/dashboard', icon: BarChart3, label: 'Dashboard' },
    { path: '/patients', icon: Users, label: 'Manajemen Pasien' },
    { path: '/medications', icon: Pill, label: 'Obat & Jadwal' },
    { path: '/consumption', icon: Activity, label: 'Riwayat Konsumsi' },
    { path: '/doctors', icon: UserCheck, label: 'Manajemen Dokter' },
  ];

  const doctorNavItems = [
    { path: '/dashboard', icon: BarChart3, label: 'Dashboard' },
    { path: '/patients', icon: Users, label: 'Data Pasien' },
    { path: '/medications', icon: Pill, label: 'Obat & Jadwal' },
    { path: '/consumption', icon: Activity, label: 'Riwayat Konsumsi' },
  ];

  const navItems = user?.role === 'operator' ? operatorNavItems : doctorNavItems;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 z-50 w-64 bg-gradient-to-b from-slate-800 to-slate-900 shadow-xl">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-center h-16 px-4 bg-slate-900 border-b border-slate-700">
            <Heart className="h-8 w-8 text-teal-400 mr-2" />
            <h1 className="text-xl font-bold text-white">BeomMed</h1>
          </div>

          {/* User Info */}
          <div className="px-4 py-4 border-b border-slate-700">
            <div className="flex items-center">
              <div className="h-10 w-10 rounded-full bg-teal-500 flex items-center justify-center">
                <span className="text-sm font-medium text-white">
                  {user?.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-white">{user?.name}</p>
                <p className="text-xs text-slate-300 capitalize">
                  {user?.role}
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-2">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-teal-600 text-white shadow-md'
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  }`
                }
              >
                <item.icon className="h-5 w-5 mr-3" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-slate-700">
            <button
              onClick={handleLogout}
              className="flex items-center w-full px-4 py-3 text-sm font-medium text-slate-300 rounded-lg hover:bg-slate-700 hover:text-white transition-colors"
            >
              <LogOut className="h-5 w-5 mr-3" />
              Keluar
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="pl-64">
        <main className="py-6 px-8">{children}</main>
      </div>
    </div>
  );
};

export default Layout;
