"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { SurveillanceAlert } from "@/types";

interface Notification extends SurveillanceAlert {
  displayId: string;
  dismissed: boolean;
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (alert: SurveillanceAlert) => void;
  dismissNotification: (displayId: string) => void;
  dismissAll: () => void;
  unreadCount: number;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((alert: SurveillanceAlert) => {
    const displayId = `${alert.id}-${Date.now()}`;
    const notification: Notification = {
      ...alert,
      displayId,
      dismissed: false,
    };
    setNotifications((prev) => [notification, ...prev].slice(0, 20));

    // Auto-dismiss after 10 seconds
    setTimeout(() => {
      setNotifications((prev) =>
        prev.map((n) => (n.displayId === displayId ? { ...n, dismissed: true } : n)),
      );
    }, 10000);
  }, []);

  const dismissNotification = useCallback((displayId: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.displayId === displayId ? { ...n, dismissed: true } : n)),
    );
  }, []);

  const dismissAll = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, dismissed: true })));
  }, []);

  const unreadCount = notifications.filter((n) => !n.dismissed).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        addNotification,
        dismissNotification,
        dismissAll,
        unreadCount,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return context;
}
