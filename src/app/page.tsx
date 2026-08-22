import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import OnboardingGate from "@/components/OnboardingGate";

export default async function OnboardingPage({
  searchParams,
}: PageProps<"/">) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims) {
    redirect("/home");
  }

  const params = await searchParams;
  const initialManualOpen = params?.manual === "1";

  return <OnboardingGate initialManualOpen={initialManualOpen} />;
}
