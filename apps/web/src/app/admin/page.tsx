"use client";

import Link from "next/link";
import { createElement as h, useEffect, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  ArrowLeftRight,
  BarChart3,
  BadgeCheck,
  ClipboardList,
  Gamepad2,
  Gift,
  LayoutDashboard,
  LogOut,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import { signOutAdministrator } from "../../admin/admin-gate";
import { adminRequest } from "../../admin/auth-client";
import styles from "./admin-page.module.css";

const navigation = [
  { label: "Overview", icon: LayoutDashboard, active: true },
  { label: "Players", icon: Users },
  { label: "Challenges", icon: ClipboardList },
  { label: "Rewards", icon: BarChart3 },
];
export default function AdminPage() {
  const [verifiedUsers, setVerifiedUsers] = useState<number | null>(null);
  const signOut = signOutAdministrator;
  useEffect(() => {
    let active = true;
    void (async () => {
      const response = await adminRequest(
        "/api/v1/admin/gooddollar/verification-count",
      );
      if (!response.ok || !active) return;
      const body = (await response.json()) as {
        data?: { verifiedCount?: number };
      };
      if (typeof body.data?.verifiedCount === "number")
        setVerifiedUsers(body.data.verifiedCount);
    })();
    return () => {
      active = false;
    };
  }, []);
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div>
          <Link
            href="/admin"
            className="brand admin-brand"
            aria-label="Slyce admin home"
          >
            slyce<span className="brand-dot">/</span>
          </Link>
          <p className="admin-console-label">OPERATIONS CONSOLE</p>
        </div>
        <nav className="admin-nav" aria-label="Admin navigation">
          {navigation.map(({ label, icon: Icon, active }) => (
            <button
              key={label}
              className="admin-nav-item"
              aria-current={active ? "page" : undefined}
              disabled={!active}
            >
              <Icon size={18} />
              <span className="admin-nav-label">{label}</span>
              {!active && <span className="admin-soon">Soon</span>}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-footer">
          <div className="admin-secure-note">
            <ShieldCheck size={16} />
            <span>
              Protected by
              <br />
              <strong>Slyce Admin Auth</strong>
            </span>
          </div>
          <button
            className="admin-nav-item admin-signout"
            onClick={() => void signOut()}
          >
            <LogOut size={17} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>
      <main className="admin-main" id="main">
        <header className="admin-topbar">
          <div>
            <p className="eyebrow">TUESDAY · SEASON 05</p>
            <h1>Good morning, operator.</h1>
            <p className="admin-topbar-subtitle">A clear read on the Slyce player ecosystem.</p>
          </div>
          <div className="admin-top-actions">
            <span className="admin-season-label">SEASON 05 <span aria-hidden="true">/</span> LIVE</span>
            <span className="admin-live">
              <Activity size={14} /> Systems nominal
            </span>
            <button className="admin-icon-button" aria-label="Settings">
              <Settings size={18} />
            </button>
          </div>
        </header>
        <div className="admin-scroll-area">
        <section className="admin-section">
          <div className="admin-section-heading">
            <div>
              <p className="eyebrow">AT A GLANCE</p>
              <h2>Platform pulse</h2>
            </div>
            <span className="muted">
              Live data connects in the next service milestone.
            </span>
          </div>
          <div className={`admin-metric-grid ${styles.transactionGrid}`}>
            <Metric
              label="Verified GoodDollar users"
              value={
                verifiedUsers === null ? "—" : verifiedUsers.toLocaleString()
              }
              detail={
                verifiedUsers === null
                  ? "Awaiting on-chain checks"
                  : "Recorded from Celo Identity"
              }
              icon={Users}
              tone="mango"
            />
            <Metric
              label="Active rounds"
              value="—"
              detail="Awaiting gameplay service"
              icon={Gamepad2}
              tone="leaf"
            />
            <Metric
              label="Verified scores"
              value="—"
              detail="Awaiting leaderboard service"
              icon={BadgeCheck}
              tone="sky"
            />
            <Metric
              label="Rewards pending"
              value="—"
              detail="Awaiting rewards service"
              icon={Gift}
              tone="melon"
            />
            <Metric
              label="Total transactions"
              value="—"
              detail="Awaiting transaction service"
              icon={ArrowLeftRight}
              tone="sky"
            />
          </div>
        </section>
        <section className="admin-lower-grid">
          <div className="admin-panel">
            <div className="admin-panel-heading">
              <div>
                <p className="eyebrow">NEXT UP</p>
                <h2>Operational queue</h2>
              </div>
              <span className="admin-panel-status">CLEAR</span>
            </div>
            <div className="admin-empty">
              <ClipboardList size={28} />
              <p>Verified gameplay and reward workflows will appear here.</p>
              <span>
                Nothing is fabricated while the backend services are being
                connected.
              </span>
            </div>
          </div>
          <div className="admin-panel admin-quick-panel">
            <div className="admin-panel-heading">
              <div>
                <p className="eyebrow">SHORTCUTS</p>
                <h2>Quick actions</h2>
              </div>
            </div>
            <button disabled className="admin-quick-action">
              <Users size={18} />
              <span>
                <strong>Review players</strong>
                <small>Coming with P6</small>
              </span>
              <ArrowUpRight size={16} />
            </button>
            <button disabled className="admin-quick-action">
              <ClipboardList size={18} />
              <span>
                <strong>Publish a challenge</strong>
                <small>Coming with P8</small>
              </span>
              <ArrowUpRight size={16} />
            </button>
          </div>
        </section>
        <footer className="admin-footer">
          <span>Slyce / Operator workspace</span>
          <span>Build foundation · P5</span>
        </footer>
        </div>
      </main>
    </div>
  );
}

export function Metric({
  label,
  value,
  detail,
  icon: Icon = Activity,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  icon?: typeof Activity;
  tone: string;
}) {
  return h(
    "article",
    { className: `admin-metric admin-tone-${tone}` },
    h(
      "span",
      { className: "admin-metric-icon", "aria-hidden": true },
      h(Icon, { size: 17 }),
    ),
    h("p", null, label),
    h("strong", null, value),
    h("small", null, detail),
  );
}
