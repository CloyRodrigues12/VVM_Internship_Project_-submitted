import React, { useState, useEffect } from "react";
import UploadForm from "./components/UploadForm";
import LoginPage from "./components/LoginPage";
import DataViewer from "./components/DataViewer";
import BulkUpdate from "./components/BulkUpdate";
import Dashboard from "./components/Dashboard";
import Students from "./components/Students";
import Institutions from "./components/Institutions";
import Fees from "./components/Fees";
import "./App.css";
import { jwtDecode } from "jwt-decode";

// --- API Helper for sending authenticated requests ---
const api = {
  get: async (url) => {
    const token = localStorage.getItem("token");
    return fetch(`http://localhost:5000${url}`, {
      headers: { "x-access-token": token },
    });
  },
  post: async (url, body) => {
    const token = localStorage.getItem("token");
    return fetch(`http://localhost:5000${url}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-access-token": token,
      },
      body: JSON.stringify(body),
    });
  },
};

// --- SVG Icons ---
const DashboardIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2z" />
    <polyline points="9 22 9 12 15 12 15 22" />
  </svg>
);

const StudentsIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const FeesIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17 14h-2.5a1.5 1.5 0 0 0 0 3h1a1.5 1.5 0 0 1 0 3H12a2 2 0 0 0-2 2v2a2 2 0 0 0 2 2h5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2Z" />
    <path d="M12 2H2v10h10V2Z" />
  </svg>
);

const ReportsIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M8 6h13" />
    <path d="M8 12h13" />
    <path d="M8 18h13" />
    <path d="M3 6h.01" />
    <path d="M3 12h.01" />
    <path d="M3 18h.01" />
  </svg>
);

const UploadIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const EditIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const SettingsIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 2l-.15.08a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l-.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1 0-2l.15-.08a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const LogoutIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const DataViewerIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 7v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V7" />
    <path d="M8 7V5c0-1.1.9-2 2-2h4c1.1 0 2 .9 2 2v2" />
    <path d="M5 12h14" />
  </svg>
);

// Placeholder components
const Reports = () => (
  <div className="dashboard-content">
    <h2>Reports</h2>
    <p>Generated reports will be available here.</p>
  </div>
);

const Settings = () => (
  <div className="dashboard-content">
    <h2>Settings</h2>
    <p>Application settings will be configured here.</p>
  </div>
);

const DashboardLayout = ({ user, onLogout }) => {
  const [activeComponent, setActiveComponent] = useState("dashboard");
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [userDetails, setUserDetails] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const getInitials = (name) => {
    if (!name) return "";
    const nameParts = name.split(" ");
    if (nameParts.length > 1 && nameParts[1]) {
      return (
        nameParts[0][0] + nameParts[nameParts.length - 1][0]
      ).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const fetchUserDetails = async () => {
    try {
      const response = await api.get(`/api/user/${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setUserDetails(data);
      } else {
        console.error("Failed to fetch user details");
        // Fallback to the basic user info from token
        setUserDetails({
          id: user.id,
          full_name: user.full_name,
          username: user.username,
          email: user.email,
          role: user.role,
          institution_code: user.institution_code,
          created_at: user.created_at || new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("Error fetching user details:", error);
      // Fallback to the basic user info from token
      setUserDetails({
        id: user.id,
        full_name: user.full_name,
        username: user.username,
        email: user.email,
        role: user.role,
        institution_code: user.institution_code,
        created_at: user.created_at || new Date().toISOString(),
      });
    }
  };

  const handleProfileClick = async () => {
    setShowProfileMenu(false);
    if (!userDetails) {
      await fetchUserDetails();
    }
    setShowProfileModal(true);
  };

  const renderComponent = () => {
    switch (activeComponent) {
      case "upload":
        return <UploadForm user={user} />;
      case "students":
        return <Students />;

      case "fees":
        return <Fees />;
      case "data-viewer":
        return <DataViewer />;
      case "bulkUpdate":
        return <BulkUpdate />;
      case "reports":
        return <Reports />;
      case "settings":
        return <Settings />;
      case "dashboard":
      default:
        return <Dashboard user={user} />;
    }
  };

  const NavItem = ({ name, icon, componentName, onClick }) => (
    <li
      className={activeComponent === componentName ? "active" : ""}
      onClick={onClick || (() => setActiveComponent(componentName))}
    >
      <div className="nav-icon">{icon}</div>
      <span className="nav-label">{name}</span>
    </li>
  );

  return (
    <div className="app-container">
      <aside className={`app-sidebar ${isNavCollapsed ? "collapsed" : ""}`}>
        <div className="sidebar-header">
          <h1 className="app-logo">Vidya Vikas Mandal</h1>
          <button
            className="nav-toggle"
            onClick={() => setIsNavCollapsed(!isNavCollapsed)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
        </div>

        <nav className="sidebar-nav">
          <ul>
            <NavItem
              name="Dashboard"
              icon={<DashboardIcon />}
              componentName="dashboard"
            />
            <NavItem
              name="Students"
              icon={<StudentsIcon />}
              componentName="students"
            />

            <NavItem name="Fees" icon={<FeesIcon />} componentName="fees" />
            <NavItem
              name="Data Viewer"
              icon={<DataViewerIcon />}
              componentName="data-viewer"
            />
            <NavItem
              name="Bulk Update"
              icon={<EditIcon />}
              componentName="bulkUpdate"
            />
            <NavItem
              name="Reports"
              icon={<ReportsIcon />}
              componentName="reports"
            />
            {user && (
              <NavItem
                name="Upload Data"
                icon={<UploadIcon />}
                componentName="upload"
              />
            )}
          </ul>
        </nav>

        <div className="sidebar-footer">
          <ul>
            <NavItem
              name="Settings"
              icon={<SettingsIcon />}
              componentName="settings"
            />
            <NavItem
              name="Logout"
              icon={<LogoutIcon />}
              componentName="logout"
              onClick={onLogout}
            />
          </ul>
        </div>
      </aside>

      <main className="app-content">
        <header className="content-header">
          <div className="header-actions">
            <div className="profile-menu-container">
              <button
                className="profile-btn"
                onClick={() => setShowProfileMenu(!showProfileMenu)}
              >
                <div className="profile-avatar">
                  {getInitials(user.full_name)}
                </div>
                <span className="profile-name">{user.full_name}</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  stroke极速Linejoin="round"
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>

              {showProfileMenu && (
                <div className="profile-dropdown">
                  <div className="dropdown-item" onClick={handleProfileClick}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                      <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                    <span>Profile</span>
                  </div>

                  <div className="dropdown-divider"></div>
                  <div className="dropdown-item" onClick={onLogout}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 4 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                      <polyline points="16 17 21 12 16 7"></polyline>
                      <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                    <span>Logout</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="content-body">{renderComponent()}</div>
      </main>

      {/* Profile Modal */}
      {showProfileModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowProfileModal(false)}
        >
          <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>User Profile</h2>
              <button
                className="modal-close"
                onClick={() => setShowProfileModal(false)}
              >
                &times;
              </button>
            </div>
            <div className="modal-content">
              <div className="profile-avatar-large">
                {getInitials(user.full_name)}
              </div>
              <div className="profile-details">
                <div className="detail-row">
                  <span className="detail-label">Full Name:</span>
                  <span className="detail-value">
                    {userDetails?.full_name || user.full_name}
                  </span>
                </div>

                <div className="detail-row">
                  <span className="detail-label">Role:</span>
                  <span className="detail-value role-badge">
                    {userDetails?.role || user.role}
                  </span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Institution Code:</span>
                  <span className="detail-value">
                    {userDetails?.institution_code || user.institution_code}
                  </span>
                </div>

                {userDetails?.created_at && (
                  <div className="detail-row">
                    <span className="detail-label">Member Since:</span>
                    <span className="detail-value">
                      {new Date(userDetails.created_at).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn-primary"
                onClick={() => setShowProfileModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Main App Component (Router and Session Manager) ---
function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const decodedUser = jwtDecode(token);
        if (decodedUser.exp * 1000 > Date.now()) {
          setUser(decodedUser);
        } else {
          localStorage.removeItem("token");
        }
      } catch (error) {
        console.error("Invalid token found in storage:", error);
        localStorage.removeItem("token");
      }
    }
    setLoading(false);
  }, []);

  const handleLoginSuccess = (token) => {
    localStorage.setItem("token", token);
    try {
      const decodedUser = jwtDecode(token);
      setUser(decodedUser);
    } catch (error) {
      console.error("Failed to decode token on login:", error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setUser(null);
  };

  if (loading) {
    return <div className="loading-screen">Loading Application...</div>;
  }

  return (
    <>
      {user ? (
        <DashboardLayout user={user} onLogout={handleLogout} />
      ) : (
        <LoginPage onLoginSuccess={handleLoginSuccess} />
      )}
    </>
  );
}

export default App;
