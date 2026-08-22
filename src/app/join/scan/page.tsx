import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ScanCamera from "@/components/ScanCamera";

export default async function ScanPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims) {
    redirect("/home");
  }

  return <ScanCamera />;
}
