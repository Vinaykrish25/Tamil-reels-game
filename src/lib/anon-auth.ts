import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AnonSession = {
  userId: string;
};

export function useAnonSession(): AnonSession | null {
  const [session, setSession] = useState<AnonSession | null>(null);

  useEffect(() => {
    let mounted = true;

    async function ensure() {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user?.id) {
        if (mounted) setSession({ userId: data.session.user.id });
        return;
      }
      const { data: signIn, error } = await supabase.auth.signInAnonymously();
      if (error) {
        console.error("anon sign-in failed", error);
        return;
      }
      if (signIn.session?.user?.id && mounted) {
        setSession({ userId: signIn.session.user.id });
      }
    }
    void ensure();

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      if (s?.user?.id) setSession({ userId: s.user.id });
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return session;
}
