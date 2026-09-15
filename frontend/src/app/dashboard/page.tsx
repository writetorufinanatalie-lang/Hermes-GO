"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./dashboard.module.css";

interface Email {
  id: string;
  sender: string;
  subject: string;
  body: string;
  received_at: string;
  priority: "Urgent" | "Important" | "Response Required" | "Low Priority";
  summary: string;
  action_items: string[];
  draft_reply: string | null;
  is_newsletter: boolean;
  list_unsubscribe_mailto: string | null;
  list_unsubscribe_url: string | null;
  is_unsubscribed: boolean;
  is_archived: boolean;
  snooze_until: string | null;
}

interface ActionProposal {
  id: string;
  goal: string;
  evidence: string;
  expected_outcome: string;
  risk_level: "read_only" | "reversible" | "external_side_effect";
  execution_state: "proposed" | "approved" | "rejected" | "running" | "verified" | "failed";
}

interface Stats {
  total: number;
  by_priority: {
    Urgent: number;
    Important: number;
    "Response Required": number;
    "Low Priority": number;
  };
  newsletters_count: number;
  unsubscribed_count: number;
  snoozed_count: number;
}

// Strips HTML tags and decodes common HTML entities for plain-text display
const stripHtml = (html: string): string => {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

// Helper to get API base URL via Next.js proxy route
const getApiBase = () => "/api";

export default function Dashboard() {
  const router = useRouter();
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // User details
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [workspaceType, setWorkspaceType] = useState<"personal" | "student" | "business">("personal");

  const categoriesMap: Record<string, string[]> = {
    personal: ["Urgent", "Important", "Response Required", "Low Priority"],
    student: ["Exams", "Assignment", "College Circulars", "Competitions"],
    business: ["Client Emails", "Meeting Invitations", "Invoice Reminders", "General Work"],
  };

  const availableCategories = categoriesMap[workspaceType] || categoriesMap.personal;

  // UI state
  const [activeTab, setActiveTab] = useState<string>("");
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Draft replying state
  const [draftText, setDraftText] = useState("");
  const [draftLoading, setDraftLoading] = useState(false);
  const [sendLoading, setSendLoading] = useState(false);


  // Snooze state
  const [snoozeLoading, setSnoozeLoading] = useState(false);
  const [customSnoozeDate, setCustomSnoozeDate] = useState("");

  // Archive state
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archivingEmail, setArchivingEmail] = useState<Email | null>(null);

  // Stats state
  const [stats, setStats] = useState<Stats | null>(null);

  // Proposals state
  const [proposals, setProposals] = useState<ActionProposal[]>([]);
  const [proposalsLoading, setProposalsLoading] = useState(false);

  // AI reply tone selector
  const [selectedTone, setSelectedTone] = useState<"Professional" | "Friendly" | "Concise">("Professional");

  // Ref to programmatically focus the reply textarea (keyboard shortcut R)
  const replyTextAreaRef = useRef<HTMLTextAreaElement>(null);

  // Notification Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }
    setUserName(localStorage.getItem("user_name") || "User");
    setUserEmail(localStorage.getItem("user_email") || "user@gmail.com");
    
    const wsType = (localStorage.getItem("workspace_type") as "personal" | "student" | "business") || "personal";
    setWorkspaceType(wsType);
    
    const initialCategories = categoriesMap[wsType] || categoriesMap.personal;
    setActiveTab(initialCategories[0]);

    const initDashboard = async () => {
      // Sync workspace type to backend so AI categorization uses correct priority labels
      try {
        await fetch(`${getApiBase()}/user/workspace`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ workspace_type: wsType }),
        });
      } catch (err) {
        console.error("Failed to sync workspace type:", err);
      }
      
      fetchEmails();
    };
    
    initDashboard();
  }, [router]);

  useEffect(() => {
    if (activeTab === "Today's Plan") {
      fetchProposals();
    }
  }, [activeTab]);

  const fetchProposals = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setProposalsLoading(true);
    try {
      const response = await fetch(`${getApiBase()}/agent/proposals`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setProposals(data);
      } else {
        triggerToast("Failed to fetch proposals");
      }
    } catch (err) {
      console.error(err);
      triggerToast("Error fetching proposals");
    } finally {
      setProposalsLoading(false);
    }
  };

  const handleProposalAction = async (id: string, action: "approve" | "reject" | "execute") => {
    const token = localStorage.getItem("token");
    try {
      const response = await fetch(`${getApiBase()}/agent/proposals/${id}/${action}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        triggerToast(`Proposal ${action}d successfully`);
        fetchProposals();
      } else {
        triggerToast(`Failed to ${action} proposal`);
      }
    } catch (err) {
      console.error(err);
      triggerToast(`Error during ${action}`);
    }
  };

  const handleApproveAllLowRisk = async () => {
    const lowRiskProposals = proposals.filter(
      p => p.execution_state === 'proposed' && (p.risk_level === 'read_only' || p.risk_level === 'reversible')
    );
    for (const p of lowRiskProposals) {
      await handleProposalAction(p.id, "approve");
    }
    triggerToast("Approved all low risk proposals");
  };

  const fetchEmails = async (isSync = false) => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/");
      return;
    }

    if (isSync) {
      setSyncing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetch(`${getApiBase()}/emails`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        localStorage.clear();
        router.push("/");
        return;
      }

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data = await response.json();
      setEmails(data);
      if (isSync) {
        triggerToast("Gmail inbox successfully synchronized and classified!");
      }

      // Fetch stats after emails load
      fetchStats(token);
    } catch (err: any) {
      const isNetworkErr = err.name === "TypeError" || err.message?.includes("Failed to fetch");
      setError(
        isNetworkErr
          ? "Unable to connect to Hermes backend. Please make sure uvicorn is running on port 8000."
          : err.message || "An error occurred while fetching emails."
      );
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  const fetchStats = async (token: string) => {
    try {
      const res = await fetch(`${getApiBase()}/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (e) {
      // Stats are non-critical; fail silently
      console.error("Failed to fetch stats:", e);
    }
  };

  const runAgent = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    setProposalsLoading(true);
    triggerToast("Agent is generating a plan...");
    try {
      const response = await fetch(`${getApiBase()}/agent/plan`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        triggerToast("Agent finished planning!");
        fetchProposals();
      } else {
        triggerToast("Failed to run agent");
      }
    } catch (err) {
      console.error(err);
      triggerToast("Error running agent");
    } finally {
      setProposalsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    router.push("/");
  };

  // Generate Suggested AI reply (accepts optional tone override)
  const generateDraft = async (email: Email, tone?: string) => {
    const activeTone = tone ?? selectedTone;
    setDraftLoading(true);
    try {
      const response = await fetch(`${getApiBase()}/draft-reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          subject: email.subject,
          body: email.body,
          tone: activeTone,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate suggested reply");
      }

      const data = await response.json();
      setDraftText(data.draft);
      triggerToast(`AI draft generated in ${activeTone} tone!`);
    } catch (err: any) {
      console.error(err);
      triggerToast("Failed to generate AI draft: " + err.message);
    } finally {
      setDraftLoading(false);
    }
  };

  // Select an email and load/prepare draft
  const handleSelectEmail = (email: Email) => {
    setSelectedEmail(email);
    setCustomSnoozeDate("");
    if (email.draft_reply) {
      setDraftText(email.draft_reply);
    } else if (email.priority === "Response Required") {
      setDraftText("");
      generateDraft(email, selectedTone);
    } else {
      setDraftText("");
    }
    
    // Mark as read in Gmail
    const token = localStorage.getItem("token");
    if (token) {
      fetch(`${getApiBase()}/emails/${email.id}/read`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      }).catch(err => console.error("Failed to mark as read:", err));
    }
  };

  // Tone chip click: update tone and immediately re-draft if an email is open
  const handleToneChange = (tone: "Professional" | "Friendly" | "Concise") => {
    setSelectedTone(tone);
    if (selectedEmail && !selectedEmail.is_newsletter) {
      generateDraft(selectedEmail, tone);
    }
  };

  // Send the email reply
  const handleSendReply = async () => {
    if (!selectedEmail || !draftText.trim()) return;
    setSendLoading(true);
    const token = localStorage.getItem("token");
    try {
      const response = await fetch(`${getApiBase()}/emails/${selectedEmail.id}/send-reply`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reply_body: draftText,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send reply");
      }

      triggerToast("Reply sent successfully via Gmail!");
      
      // Update email priority in local state since we replied
      setEmails(prev => prev.map(e => {
        if (e.id === selectedEmail.id) {
          return { ...e, priority: "Low Priority", draft_reply: draftText };
        }
        return e;
      }));

      // Update selected email priority
      setSelectedEmail(prev => prev ? { ...prev, priority: "Low Priority", draft_reply: draftText } : null);
    } catch (err: any) {
      console.error(err);
      triggerToast("Failed to send: " + err.message);
    } finally {
      setSendLoading(false);
    }
  };

  // Perform Newsletter Unsubscribe

  // Manual Snooze
  const handleSnooze = async (email: Email, snoozeUntil: Date) => {
    setSnoozeLoading(true);
    const token = localStorage.getItem("token");
    try {
      const response = await fetch(`${getApiBase()}/emails/${email.id}/snooze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ snooze_until: snoozeUntil.toISOString() }),
      });

      if (!response.ok) {
        throw new Error("Failed to snooze email");
      }

      triggerToast(`Email snoozed until ${snoozeUntil.toLocaleString()}`);

      // Remove from current view
      setEmails(prev => prev.filter(e => e.id !== email.id));
      setSelectedEmail(null);
      setCustomSnoozeDate("");

      // Refresh stats
      const statsToken = localStorage.getItem("token");
      if (statsToken) fetchStats(statsToken);
    } catch (err: any) {
      triggerToast("Failed to snooze: " + err.message);
    } finally {
      setSnoozeLoading(false);
    }
  };

  const handleQuickSnooze = (label: string) => {
    if (!selectedEmail) return;
    const now = new Date();
    let snoozeUntil: Date;

    switch (label) {
      case "1h":
        snoozeUntil = new Date(now.getTime() + 60 * 60 * 1000);
        break;
      case "3h":
        snoozeUntil = new Date(now.getTime() + 3 * 60 * 60 * 1000);
        break;
      case "Tomorrow":
        snoozeUntil = new Date(now);
        snoozeUntil.setDate(snoozeUntil.getDate() + 1);
        snoozeUntil.setHours(9, 0, 0, 0);
        break;
      case "3 Days":
        snoozeUntil = new Date(now);
        snoozeUntil.setDate(snoozeUntil.getDate() + 3);
        snoozeUntil.setHours(9, 0, 0, 0);
        break;
      default:
        return;
    }

    handleSnooze(selectedEmail, snoozeUntil);
  };

  const handleCustomSnooze = () => {
    if (!selectedEmail || !customSnoozeDate) return;
    const snoozeUntil = new Date(customSnoozeDate);
    if (isNaN(snoozeUntil.getTime())) {
      triggerToast("Invalid date selected.");
      return;
    }
    handleSnooze(selectedEmail, snoozeUntil);
  };

  // Archive email
  const handleArchive = async () => {
    if (!archivingEmail) return;
    setArchiveLoading(true);
    const token = localStorage.getItem("token");
    try {
      const response = await fetch(`${getApiBase()}/emails/${archivingEmail.id}/archive`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to archive email");
      }

      triggerToast("Email archived from Hermes view.");
      setEmails(prev => prev.map(e => e.id === archivingEmail.id ? { ...e, is_archived: true } : e));
      if (selectedEmail?.id === archivingEmail.id) {
        setSelectedEmail(prev => prev ? { ...prev, is_archived: true } : null);
      }
      setArchivingEmail(null);

      // Refresh stats
      const statsToken = localStorage.getItem("token");
      if (statsToken) fetchStats(statsToken);
    } catch (err: any) {
      triggerToast("Failed to archive: " + err.message);
    } finally {
      setArchiveLoading(false);
    }
  };

  // Unarchive email
  const handleUnarchive = async (email: Email) => {
    setArchiveLoading(true);
    const token = localStorage.getItem("token");
    try {
      const response = await fetch(`${getApiBase()}/emails/${email.id}/unarchive`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to restore email");
      }

      triggerToast("Email restored to inbox.");
      setEmails(prev => prev.map(e => e.id === email.id ? { ...e, is_archived: false } : e));
      if (selectedEmail?.id === email.id) {
        setSelectedEmail(prev => prev ? { ...prev, is_archived: false } : null);
      }

      const statsToken = localStorage.getItem("token");
      if (statsToken) fetchStats(statsToken);
    } catch (err: any) {
      triggerToast("Failed to restore: " + err.message);
    } finally {
      setArchiveLoading(false);
    }
  };

  // Filter emails based on category tab and search query
  const filteredEmails = emails.filter((email) => {
    // 1. Archived tab filter
    if (activeTab === "Archived") {
      return email.is_archived;
    }
    // Exclude archived from active tabs
    if (email.is_archived) return false;

    // 2. Tab filter
    if (email.is_newsletter) return false; // Newsletters are excluded from main categories
    if (email.priority !== activeTab) return false;

    // 3. Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const subjectMatch = email.subject?.toLowerCase().includes(query);
      const senderMatch = email.sender?.toLowerCase().includes(query);
      const bodyMatch = email.body?.toLowerCase().includes(query);
      return subjectMatch || senderMatch || bodyMatch;
    }

    return true;
  });

  // Formatting date
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return dateStr;
    }
  };

  // Keyboard shortcuts: J/K navigate list, Esc deselect, R focus reply, S snooze tomorrow
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // Don't intercept when user is typing
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      switch (e.key.toLowerCase()) {
        case 'j': {
          e.preventDefault();
          const idx = selectedEmail
            ? filteredEmails.findIndex((em) => em.id === selectedEmail.id)
            : -1;
          const next = filteredEmails[Math.min(idx + 1, filteredEmails.length - 1)];
          if (next) handleSelectEmail(next);
          break;
        }
        case 'k': {
          e.preventDefault();
          const idx = selectedEmail
            ? filteredEmails.findIndex((em) => em.id === selectedEmail.id)
            : filteredEmails.length;
          const prev = filteredEmails[Math.max(idx - 1, 0)];
          if (prev) handleSelectEmail(prev);
          break;
        }
        case 'escape':
          setSelectedEmail(null);
          setDraftText('');
          break;
        case 'r':
          if (selectedEmail && !selectedEmail.is_newsletter) {
            e.preventDefault();
            replyTextAreaRef.current?.focus();
          }
          break;
        case 's':
          if (selectedEmail) {
            e.preventDefault();
            handleQuickSnooze('Tomorrow');
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedEmail, filteredEmails]);

  // Stats bar widths
  const statsTotal = stats
    ? Math.max(
        stats.by_priority.Urgent +
        stats.by_priority.Important +
        stats["by_priority"]["Response Required"] +
        stats.by_priority["Low Priority"],
        1
      )
    : 1;

  return (
    <div className={styles.dashboard}>
      {/* Toast Alert */}
      {toastMsg && <div className={styles.toast}>{toastMsg}</div>}

      <div className={styles.windowFrame}>
        <div className={styles.windowHeader}>
          <span>Hermes GO OS.exe</span>
          <div className={styles.windowControls}>
            <div style={{background: "var(--slate-black)", width: 14, height: 14, border: "2px solid var(--cream)"}}></div>
            <div style={{background: "var(--slate-black)", width: 14, height: 14, border: "2px solid var(--cream)"}}></div>
            <div style={{background: "var(--cream)", width: 14, height: 14, border: "2px solid var(--slate-black)"}}></div>
          </div>
        </div>
        <div className={styles.windowBody}>

          {/* Sidebar Section */}
          <aside className={styles.sidebar}>
            <div className={styles.brand}>
              <h2>Hermes GO</h2>
            </div>

            <nav className={styles.navigation}>
              <div className={styles.sectionHeader}>AUTOPILOT</div>
              <button
                className={`${styles.navItem} ${activeTab === "Today's Plan" ? styles.activeNav : ""}`}
                onClick={() => { setActiveTab("Today's Plan"); setSelectedEmail(null); }}
              >
                Today's Plan
              </button>

              <div className={styles.sectionHeader}>PRIORITY CATEGORIES</div>
          {availableCategories.map((cat) => (
            <button
              key={cat}
              className={`${styles.navItem} ${activeTab === cat ? styles.activeNav : ""}`}
              onClick={() => { setActiveTab(cat); setSelectedEmail(null); }}
            >
              <span className={styles.tabDot}></span>
              {cat}
              <span className={styles.badgeCount}>
                {emails.filter(e => e.priority === cat && !e.is_newsletter && !e.is_archived).length}
              </span>
            </button>
          ))}

          <div className={styles.sectionHeader}>FOLDERS</div>
          <button 
            className={`${styles.navItem} ${activeTab === "Archived" ? styles.activeNav : ""}`}
            onClick={() => { setActiveTab("Archived"); setSelectedEmail(null); }}
          >
            Archived
            <span className={styles.badgeCount}>
              {emails.filter(e => e.is_archived).length}
            </span>
          </button>

          {/* Stats Panel */}
          {stats && (
            <>
              <div className={styles.sectionHeader}>INBOX INSIGHTS</div>
              <div className={styles.statsPanel}>
                <div className={styles.statRow}>
                  <span className={styles.statLabel}>Total Synced</span>
                  <span className={styles.statValue}>{stats.total}</span>
                </div>

                <div className={styles.statBars}>
                  {stats.by_priority.Urgent > 0 && (
                    <div className={styles.statBarRow}>
                      <span className={`${styles.statBarLabel} ${styles.urgentLabel}`}>Urgent</span>
                      <div className={styles.statBarTrack}>
                        <div
                          className={`${styles.statBarFill} ${styles.urgentFill}`}
                          style={{ width: `${(stats.by_priority.Urgent / statsTotal) * 100}%` }}
                        />
                      </div>
                      <span className={styles.statBarCount}>{stats.by_priority.Urgent}</span>
                    </div>
                  )}
                  {stats.by_priority.Important > 0 && (
                    <div className={styles.statBarRow}>
                      <span className={`${styles.statBarLabel} ${styles.importantLabel}`}>Important</span>
                      <div className={styles.statBarTrack}>
                        <div
                          className={`${styles.statBarFill} ${styles.importantFill}`}
                          style={{ width: `${(stats.by_priority.Important / statsTotal) * 100}%` }}
                        />
                      </div>
                      <span className={styles.statBarCount}>{stats.by_priority.Important}</span>
                    </div>
                  )}
                  {stats.by_priority["Response Required"] > 0 && (
                    <div className={styles.statBarRow}>
                      <span className={`${styles.statBarLabel} ${styles.responseLabel}`}>Replies</span>
                      <div className={styles.statBarTrack}>
                        <div
                          className={`${styles.statBarFill} ${styles.responseFill}`}
                          style={{ width: `${(stats.by_priority["Response Required"] / statsTotal) * 100}%` }}
                        />
                      </div>
                      <span className={styles.statBarCount}>{stats.by_priority["Response Required"]}</span>
                    </div>
                  )}
                  {stats.by_priority["Low Priority"] > 0 && (
                    <div className={styles.statBarRow}>
                      <span className={`${styles.statBarLabel} ${styles.lowLabel}`}>Low</span>
                      <div className={styles.statBarTrack}>
                        <div
                          className={`${styles.statBarFill} ${styles.lowFill}`}
                          style={{ width: `${(stats.by_priority["Low Priority"] / statsTotal) * 100}%` }}
                        />
                      </div>
                      <span className={styles.statBarCount}>{stats.by_priority["Low Priority"]}</span>
                    </div>
                  )}
                </div>

                <div className={styles.statPills}>
                  <div className={styles.statPill}>

                    <span>{stats.snoozed_count} Snoozed</span>
                  </div>
                  <div className={styles.statPill}>

                    <span>{stats.unsubscribed_count} Unsubbed</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </nav>

        <div className={styles.userProfile}>
          <div className={styles.avatar}>{userName[0] || "U"}</div>
          <div className={styles.userInfo}>
            <h4>{userName}</h4>
            <p title={userEmail}>{userEmail}</p>
          </div>
          <button title="Log Out" aria-label="Log out" onClick={handleLogout} className={styles.logoutBtn}>
          </button>
        </div>
      </aside>

      {/* Main Email List Panel */}
      {activeTab === "Today's Plan" ? (
        <main className={styles.planPane}>
          <header className={styles.listHeader}>
            <h2 className={styles.planTitle}>Today's Plan (Autopilot)</h2>
            <button className={styles.syncBtn} onClick={runAgent} disabled={proposalsLoading}>Run Agent</button>
            <button className={styles.syncBtn} onClick={handleApproveAllLowRisk}>Approve All Low Risk</button>
            <button className={styles.syncBtn} onClick={fetchProposals} disabled={proposalsLoading}>Refresh</button>
          </header>
          <div className={styles.planContent}>
            <div className={styles.proposalsList}>
              {proposalsLoading ? (
                <div className={styles.paneLoader}>Loading proposals...</div>
              ) : proposals.length === 0 ? (
                <div className={styles.emptyPane}>No proposals for today.</div>
              ) : (
                proposals.map(p => (
                  <div key={p.id} className={styles.proposalCard}>
                    <div className={styles.proposalHeader}>
                      <h3>{p.goal}</h3>
                      <span className={`${styles.riskBadge} ${styles[`risk_${p.risk_level}`]}`}>{p.risk_level}</span>
                    </div>
                    <div className={styles.proposalBody}>
                      <p><strong>Evidence:</strong> {p.evidence}</p>
                      <p><strong>Outcome:</strong> {p.expected_outcome}</p>
                      <p><strong>Status:</strong> <span className={styles.statusText}>{p.execution_state}</span></p>
                    </div>
                    <div className={styles.proposalActions}>
                      {p.execution_state === 'proposed' && (
                        <>
                          <button className={styles.approveBtn} onClick={() => handleProposalAction(p.id, "approve")}>Approve</button>
                          <button className={styles.rejectBtn} onClick={() => handleProposalAction(p.id, "reject")}>Reject</button>
                        </>
                      )}
                      {(p.execution_state === 'approved' || p.risk_level === 'read_only') && p.execution_state !== 'running' && p.execution_state !== 'verified' && p.execution_state !== 'failed' && (
                        <button className={styles.executeBtn} onClick={() => handleProposalAction(p.id, "execute")}>Execute</button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className={styles.agentActivitySidebar}>
              <h3>Agent Activity</h3>
              <div className={styles.timeline}>
                {proposals.filter(p => p.execution_state === 'running' || p.execution_state === 'verified' || p.execution_state === 'failed').map(p => (
                  <div key={`timeline-${p.id}`} className={styles.timelineItem}>
                    <div className={styles.timelineDot}></div>
                    <div className={styles.timelineContent}>
                      <strong>{p.execution_state.toUpperCase()}</strong>: {p.goal}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      ) : (
      <main className={styles.listPane}>
        <header className={styles.listHeader}>
          <div className={styles.searchBar}>

            <input 
              type="text" 
              placeholder="Search subject, sender, or content..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button 
            disabled={syncing} 
            onClick={() => fetchEmails(true)} 
            className={styles.syncBtn}
            title="Sync recent emails from Gmail"
          >

            {syncing ? "Syncing..." : "Sync"}
          </button>
        </header>

        {loading ? (
          <div className={styles.paneLoader}>
            <div className={styles.pulseSpinner}></div>
            <p>Analyzing and classifying emails with Gemini...</p>
          </div>
        ) : error ? (
          <div className={styles.errorPane}>
            <p>Error: {error}</p>
            <button onClick={() => fetchEmails()}>Retry Connection</button>
          </div>
        ) : filteredEmails.length === 0 ? (
          <div className={styles.emptyPane}>

            <h3>All Clear!</h3>
            <p>No messages found in {activeTab}.</p>
          </div>
        ) : (
          <div className={styles.emailList}>
            {filteredEmails.map((email) => (
              <div 
                key={email.id} 
                onClick={() => handleSelectEmail(email)}
                className={`${styles.emailItem} ${selectedEmail?.id === email.id ? styles.selectedEmailItem : ""}`}
              >
                <div className={styles.emailItemHeader}>
                  <span className={styles.senderName}>
                    {email.sender.split("<")[0].trim() || email.sender.match(/<(.+)>/)?.[1] || email.sender}
                  </span>
                  <span className={styles.receivedTime}>{formatDate(email.received_at)}</span>
                </div>
                <h4 className={styles.emailSubject}>{email.subject}</h4>
                <p className={styles.emailSnippet}>{stripHtml(email.body ?? '').substring(0, 100)}...</p>
                
                <div className={styles.badgeRow}>
                  <span className={`${styles.badge} ${styles.badgeLow}`}>
                    {email.priority}
                  </span>
                  {email.snooze_until && (
                    <span className={`${styles.badge} ${styles.badgeSnooze}`}>Snoozed</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      )}

      {/* Detail Pane (Right panel) */}
      {activeTab !== "Today's Plan" && (
      <section className={styles.detailPane}>
        {selectedEmail ? (
          <div className={styles.detailWrapper}>
            {/* Header info */}
            <div className={styles.detailHeader}>
              <div className={styles.detailHeaderTop}>
                <h2 className={styles.detailSubject}>{selectedEmail.subject}</h2>
                {selectedEmail.is_archived ? (
                  <button
                    className={styles.archiveBtn}
                    onClick={() => handleUnarchive(selectedEmail)}
                    disabled={archiveLoading}
                    title="Restore this email to active inbox"
                  >
                    Restore to Inbox
                  </button>
                ) : (
                  <button
                    className={styles.archiveBtn}
                    onClick={() => setArchivingEmail(selectedEmail)}
                    disabled={archiveLoading}
                    title="Archive this email from Hermes view"
                  >
                    Archive
                  </button>
                )}
              </div>
              <div className={styles.detailMeta}>
                <div>
                  <strong>From: </strong> <span className={styles.detailFrom}>{selectedEmail.sender}</span>
                </div>
                <div>
                  <strong>Received: </strong> {formatDate(selectedEmail.received_at)}
                </div>
              </div>
            </div>

            <div className={styles.detailContentScroll}>
              {/* AI Co-Pilot Summary (Card) */}
              <div className={styles.summaryCard}>
                <div className={styles.cardHeader}>

                  <h3>AI Co-Pilot Summary</h3>
                </div>
                <p>
                  {selectedEmail.summary && selectedEmail.summary.trim().length > 3
                    ? selectedEmail.summary
                    : (stripHtml(selectedEmail.body).slice(0, 250) + (selectedEmail.body.length > 250 ? "..." : ""))}
                </p>

                {selectedEmail.action_items && selectedEmail.action_items.length > 0 && (
                  <div className={styles.actionItemsSection}>
                    <h4>Suggested Action Items</h4>
                    <ul className={styles.actionList}>
                      {selectedEmail.action_items.map((item, idx) => (
                        <li key={idx} className={styles.actionItem}>
                          <input type="checkbox" id={`action-${idx}`} />
                          <label htmlFor={`action-${idx}`}>{item}</label>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>



              {/* Manual Snooze Card */}
              <div className={styles.snoozeCard}>
                <div className={styles.cardHeader}>

                  <h3>Snooze Email</h3>
                  {snoozeLoading && <span className={styles.miniSpinner}></span>}
                </div>
                <p className={styles.snoozeSubtext}>Hide this email until a later time</p>
                <div className={styles.snoozeChips}>
                  {["1h", "3h", "Tomorrow", "3 Days"].map((label) => (
                    <button
                      key={label}
                      className={styles.snoozeChip}
                      onClick={() => handleQuickSnooze(label)}
                      disabled={snoozeLoading}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className={styles.customSnoozeRow}>
                  <input
                    type="datetime-local"
                    className={styles.customSnoozeInput}
                    value={customSnoozeDate}
                    onChange={(e) => setCustomSnoozeDate(e.target.value)}
                    min={new Date().toISOString().slice(0, 16)}
                  />
                  <button
                    className={styles.customSnoozeBtn}
                    onClick={handleCustomSnooze}
                    disabled={!customSnoozeDate || snoozeLoading}
                  >
                    Set Snooze
                  </button>
                </div>
              </div>

              {/* Email Content Body */}
              <div className={styles.emailBodyCard}>
                <div className={styles.commentThread}>
                  <div className={styles.emailItemHeader}>
                    <span className={styles.senderName}>
                      {selectedEmail.sender.split("<")[0].trim() || selectedEmail.sender}
                    </span>
                    <span className={styles.receivedTime}>
                      {formatDate(selectedEmail.received_at)} | {(selectedEmail.body?.length || 0) > 1000 ? "1.2 MB" : "14 KB"}
                    </span>
                  </div>
                  <div className={styles.emailBodyText}>
                    {selectedEmail.body ? stripHtml(selectedEmail.body) : "(No message body content)"}
                  </div>
                </div>
              </div>

              {/* Draft Reply Area (when email needs reply or option to draft is available) */}
              {!selectedEmail.is_newsletter && (
                <div className={styles.replyCard}>
                  <div className={styles.replyCardHeader}>
                    <h3>AI Smart Reply Co-Pilot</h3>
                    {draftLoading && <span className={styles.miniSpinner}></span>}
                  </div>

                  {/* Tone selector chips */}
                  <div className={styles.toneRow}>
                    <span className={styles.toneLabel}>Tone</span>
                    {(["Professional", "Friendly", "Concise"] as const).map((tone) => (
                      <button
                        key={tone}
                        className={`${styles.toneChip} ${selectedTone === tone ? styles.toneChipActive : ''}`}
                        onClick={() => handleToneChange(tone)}
                        disabled={draftLoading}
                        title={`Rewrite draft in a ${tone} tone`}
                      >
                        {tone}
                      </button>
                    ))}
                  </div>

                  <textarea
                    ref={replyTextAreaRef}
                    placeholder="Ask the co-pilot or start editing your draft reply..."
                    value={draftText}
                    onChange={(e) => setDraftText(e.target.value)}
                    className={styles.replyTextArea}
                  ></textarea>

                  <div className={styles.replyActionRow}>
                    <button 
                      onClick={() => generateDraft(selectedEmail)}
                      disabled={draftLoading || sendLoading}
                      className={styles.regenerateBtn}
                    >
                      Regenerate Draft
                    </button>
                    
                    <button 
                      onClick={handleSendReply}
                      disabled={sendLoading || !draftText.trim()}
                      className={styles.sendBtn}
                    >
                      {sendLoading ? "Sending..." : "Send Reply"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className={styles.emptyDetail}>

            <h3>No Message Selected</h3>
            <p>Select an email from the inbox list to read it and let the AI Co-Pilot summarize and draft replies.</p>
            <div className={styles.shortcutHints}>
              <div className={styles.shortcutHint}>
                <kbd className={styles.kbd}>J</kbd><kbd className={styles.kbd}>K</kbd>
                <span>Navigate</span>
              </div>
              <div className={styles.shortcutHint}>
                <kbd className={styles.kbd}>R</kbd>
                <span>Reply</span>
              </div>
              <div className={styles.shortcutHint}>
                <kbd className={styles.kbd}>S</kbd>
                <span>Snooze</span>
              </div>
              <div className={styles.shortcutHint}>
                <kbd className={styles.kbd}>Esc</kbd>
                <span>Deselect</span>
              </div>
            </div>
          </div>
        )}
      </section>
      )}



      {/* Archive Confirmation Dialog */}
      {archivingEmail && (
        <div className={styles.modalBackdrop}>
          <div className={styles.modalCard}>
            <h3>Archive Email</h3>
            <p>
              Remove <strong>"{archivingEmail.subject}"</strong> from your Hermes GO inbox?
            </p>
            <p className={styles.modalSubtext}>
              This won't delete the email from Gmail — it will simply be hidden from your Hermes view. You can re-sync to restore it.
            </p>
            <div className={styles.modalBtnRow}>
              <button
                onClick={() => setArchivingEmail(null)}
                disabled={archiveLoading}
                className={styles.cancelBtn}
              >
                Keep in Inbox
              </button>
              <button
                onClick={handleArchive}
                disabled={archiveLoading}
                className={styles.confirmArchiveBtn}
              >
                {archiveLoading ? "Archiving..." : "Archive It"}
              </button>
            </div>
          </div>
        </div>
      )}

        </div>
      </div>
    </div>
  );
}
