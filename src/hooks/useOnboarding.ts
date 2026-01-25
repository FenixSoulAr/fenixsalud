import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

const ONBOARDING_KEY = "misalud_onboarding_completed";

export function useOnboarding() {
  const { user } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsChecking(false);
      setShowOnboarding(false);
      return;
    }

    // Check if user has completed onboarding
    // Use user-specific key to handle multiple accounts on same device
    const userKey = `${ONBOARDING_KEY}_${user.id}`;
    const completed = localStorage.getItem(userKey);

    if (completed === "true") {
      setShowOnboarding(false);
    } else {
      setShowOnboarding(true);
    }
    
    setIsChecking(false);
  }, [user]);

  const completeOnboarding = () => {
    if (user) {
      const userKey = `${ONBOARDING_KEY}_${user.id}`;
      localStorage.setItem(userKey, "true");
    }
    setShowOnboarding(false);
  };

  return {
    showOnboarding,
    isChecking,
    completeOnboarding,
  };
}
