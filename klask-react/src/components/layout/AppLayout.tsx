import React from "react";
import { Outlet } from "react-router-dom";
import { Navbar } from "./Navbar";
import { Sidebar } from "./Sidebar";
import { searchSelectors, useSearchStore } from "../../stores/search-store";

export const AppLayout: React.FC = () => {
    const sidebarOpen = searchSelectors.sidebarOpen();
    const toggleSidebar = useSearchStore((state) => state.toggleSidebar);

    return (
        <div className="min-h-screen bg-gray-50">
            <Navbar />

            <div className="flex">
                {/* Sidebar */}
                {sidebarOpen && (
                    <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col lg:pt-16">
                        <Sidebar />
                    </div>
                )}

                {/* Mobile sidebar overlay */}
                {sidebarOpen && (
                    <div className="lg:hidden">
                        <div
                            className="fixed top-16 bottom-0 left-0 right-0 bg-gray-600 bg-opacity-75 z-40"
                            onClick={toggleSidebar}
                        />
                        <div className="fixed top-16 bottom-0 left-0 z-50 w-72 bg-white overflow-y-auto">
                            <Sidebar />
                        </div>
                    </div>
                )}

                {/* Main content */}
                <main
                    className={`flex-1 transition-all duration-300 ${
                        sidebarOpen ? "lg:pl-72" : ""
                    }`}
                >
                    <div className="px-4 pt-20 pb-8 sm:px-6 lg:px-8">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
};
