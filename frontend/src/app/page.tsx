"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./page.module.css";

const getApiBase = () => {
  if (typeof window !== "undefined") {
    return `http://${window.location.hostname}:8000`;
  }
  return "http://127.0.0.1:8000";
};

function HomeContent() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workspaceType, setWorkspaceType] = useState<"personal" | "student" | "business">("personal");
  const searchParams = useSearchParams();

  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam) {
      setError(`Sign in error: ${decodeURIComponent(errorParam)}`);
    }
    // Load previously selected workspace type if available
    const savedType = localStorage.getItem("workspace_type") as "personal" | "student" | "business";
    if (savedType) {
      setWorkspaceType(savedType);
    }
  }, [searchParams]);

  const handleWorkspaceChange = (type: "personal" | "student" | "business") => {
    setWorkspaceType(type);
    localStorage.setItem("workspace_type", type);
  };

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    localStorage.setItem("workspace_type", workspaceType);
    try {
      const response = await fetch("/api/auth/login");
      if (!response.ok) {
        throw new Error("Failed to initialize authentication flow");
      }
      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error("Invalid OAuth URL returned from server");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred. Please make sure the backend is running.");
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <main className={`${styles.main} glass`}>
        <div className={styles.mainContent}>
          <div className={styles.header}>
            <h1 className={styles.title}>Hermes GO</h1>
            <p className={styles.subtitle}>Saving Money Saving Time</p>
          </div>

          <div className={styles.roleSelection}>
            <p className={styles.rolePrompt}>Select your account type:</p>
            <div className={styles.roleOptions}>
              <button
                type="button"
                className={`${styles.roleOption} ${workspaceType === "personal" ? styles.activeRole : ""}`}
                onClick={() => handleWorkspaceChange("personal")}
              >
                Personal Use
              </button>
              <button
                type="button"
                className={`${styles.roleOption} ${workspaceType === "student" ? styles.activeRole : ""}`}
                onClick={() => handleWorkspaceChange("student")}
              >
                Student / Education
              </button>
              <button
                type="button"
                className={`${styles.roleOption} ${workspaceType === "business" ? styles.activeRole : ""}`}
                onClick={() => handleWorkspaceChange("business")}
              >
                Business
              </button>
            </div>
          </div>

          {error && <div className={styles.errorAlert}>{error}</div>}

          <button 
            onClick={handleLogin} 
            disabled={loading} 
            className={styles.loginBtn}
          >
            {loading ? (
              <div className={styles.spinner}></div>
            ) : (
              <>
                <div className={styles.googleIcon}></div>
                Sign in with Google
              </>
            )}
          </button>
        </div>
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className={styles.container}>Loading...</div>}>
      <HomeContent />
    </Suspense>
  );
}
