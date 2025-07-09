import { HardDrive } from "lucide-react";
import { useLocation } from "wouter";

const Navigation = () => {
  const [location, setLocation] = useLocation();

  const navItems = [
    { path: "/", label: "Home", id: "dashboard" },
    { path: "/scan-results", label: "Scan Results", id: "scan-results" },
    { path: "/space-cleanup", label: "Space Cleanup", id: "space-cleanup" },
    { path: "/error-page", label: "Error Page", id: "error-page" },
  ];

  return (
    <header className="nav-header px-6 py-4">
      <div className="flex justify-between items-center max-w-7xl mx-auto">
        <div className="flex items-center space-x-2">
          <HardDrive className="text-xl" />
          <span className="text-lg font-semibold">Disk Space</span>
        </div>
        <nav className="flex space-x-6">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setLocation(item.path)}
              className={`nav-tab px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                location === item.path
                  ? "border-white"
                  : "border-transparent hover:border-gray-300"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
};

export default Navigation;
