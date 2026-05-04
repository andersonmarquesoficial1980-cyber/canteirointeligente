import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const [isSubscribed, setIsSubscribed] = useState(false);

  const isSupported = useMemo(() => {
    if (typeof window === "undefined") return false;
    return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  }, []);

  const refreshSubscriptionState = useCallback(async () => {
    if (!isSupported) {
      setIsSubscribed(false);
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(Boolean(subscription));
    } catch {
      setIsSubscribed(false);
    }
  }, [isSupported]);

  useEffect(() => {
    refreshSubscriptionState();
  }, [refreshSubscriptionState]);

  const requestPermission = useCallback(async () => {
    if (!isSupported) return false;

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return false;

      if (Notification.permission === "denied") return false;

      const permission =
        Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();

      if (permission !== "granted") return false;

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
        if (!vapidPublicKey) return false;

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        });
      }

      const subscriptionJson = subscription.toJSON();
      const p256dh = subscriptionJson.keys?.p256dh;
      const auth = subscriptionJson.keys?.auth;
      if (!subscription.endpoint || !p256dh || !auth) return false;

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", user.id)
        .maybeSingle();

      const { error } = await (supabase as any)
        .from("push_subscriptions")
        .upsert(
          {
            user_id: user.id,
            company_id: (profile as any)?.company_id ?? null,
            endpoint: subscription.endpoint,
            p256dh,
            auth,
          },
          { onConflict: "user_id,endpoint" }
        );

      if (error) return false;

      setIsSubscribed(true);
      return true;
    } catch {
      return false;
    }
  }, [isSupported]);

  return {
    requestPermission,
    isSupported,
    isSubscribed,
  };
}
