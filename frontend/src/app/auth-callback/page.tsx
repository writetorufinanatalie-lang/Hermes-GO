"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./callback.module.css";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");
    const email = searchParams.get("email");
    const name = searchParams.get("name");

    if (token) {
      // Save credentials in client browser storage
      localStorage.setItem("token", token);
      localStorage.setItem("user_email", email || "");
      localStorage.setItem("user_name", name || "");

      // Redirect user to the dashboard
      router.push("/dashboard");
    } else {
      console.error("No token received in redirect url");
      // Redirect back to landing page if something goes wrong
      router.push("/");
    }
  }, [searchParams, router]);

  return (
    <div className={styles.container}>
      <div className="ambient-glow" style={{ top: "30%", left: "30%", width: "400px", height: "400px", background: "var(--accent-glow)" }}></div>
      <div className={`${styles.card} glass`}>
        <div className={styles.spinner}></div>
        <h2 className={styles.title}>Securing Connection</h2>
        <p className={styles.message}>Synchronizing your credentials and preparing your co-pilot workspace...</p>
      </div>
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense fallback={
      <div className={styles.container}>
        <div className={`${styles.card} glass`}>
          <div className={styles.spinner}></div>
          <h2 className={styles.title}>Loading Flow</h2>
        </div>
      </div>
    }>
      <CallbackContent />
    </Suspense>
  );
}
