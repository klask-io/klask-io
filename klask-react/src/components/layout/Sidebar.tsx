import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  MagnifyingGlassIcon,
  FolderIcon,
  DocumentTextIcon,
  Cog6ToothIcon,
  UsersIcon,
} from '@heroicons/react/24/outline';

import { authSelectors } from '../../stores/auth-store';

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const isAdmin = authSelectors.isAdmin();

  const navigation = [
    { name: 'Search', href: '/search', icon: MagnifyingGlassIcon },
    { name: 'Files', href: '/files', icon: DocumentTextIcon },
  ];

  const adminNavigation = [
    { name: 'Admin Dashboard', href: '/admin', icon: Cog6ToothIcon },
    { name: 'Repositories', href: '/admin/repositories', icon: FolderIcon },
    { name: 'Users', href: '/admin/users', icon: UsersIcon },
    { name: 'Index', href: '/admin/index', icon: MagnifyingGlassIcon },
  ];

  return (
    <div className="flex grow flex-col gap-y-5 overflow-y-auto bg-white px-6 pb-4 border-r border-gray-200">
      <div className="flex h-16 shrink-0 items-center">
        {/* Logo space - already handled in navbar */}
      </div>
      
      <nav className="flex flex-1 flex-col">
        <ul role="list" className="flex flex-1 flex-col gap-y-7">
          {/* Main navigation */}
          <li>
            <ul role="list" className="-mx-2 space-y-1">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href || 
                  (item.href !== '/search' && location.pathname.startsWith(item.href));
                
                return (
                  <li key={item.name}>
                    <Link
                      to={item.href}
                      className={clsx(
                        'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold transition-colors',
                        isActive
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-700 hover:text-blue-700 hover:bg-gray-50'
                      )}
                    >
                      <item.icon
                        className={clsx(
                          'h-6 w-6 shrink-0',
                          isActive ? 'text-blue-700' : 'text-gray-400 group-hover:text-blue-700'
                        )}
                        aria-hidden="true"
                      />
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>
          
          {/* Admin navigation */}
          {isAdmin && (
            <li>
              <div className="text-xs font-semibold leading-6 text-gray-400 uppercase tracking-wide">
                Administration
              </div>
              <ul role="list" className="-mx-2 mt-2 space-y-1">
                {adminNavigation.map((item) => {
                  const isActive = location.pathname === item.href;
                  
                  return (
                    <li key={item.name}>
                      <Link
                        to={item.href}
                        className={clsx(
                          'group flex gap-x-3 rounded-md p-2 text-sm leading-6 font-semibold transition-colors',
                          isActive
                            ? 'bg-blue-50 text-blue-700'
                            : 'text-gray-700 hover:text-blue-700 hover:bg-gray-50'
                        )}
                      >
                        <item.icon
                          className={clsx(
                            'h-6 w-6 shrink-0',
                            isActive ? 'text-blue-700' : 'text-gray-400 group-hover:text-blue-700'
                          )}
                          aria-hidden="true"
                        />
                        {item.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          )}
        </ul>
      </nav>
    </div>
  );
};