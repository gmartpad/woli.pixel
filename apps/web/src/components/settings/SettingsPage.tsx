import { ProfileCard } from "./ProfileCard";
import { SecurityCard } from "./SecurityCard";
import { SessionsCard } from "./SessionsCard";
import { AppearanceCard } from "./AppearanceCard";
import { DangerZoneCard } from "./DangerZoneCard";

interface SettingsPageProps {
  session: {
    user: {
      name: string | null;
      email: string;
      emailVerified: boolean;
      image?: string | null;
      username?: string | null;
      [key: string]: unknown;
    };
  };
}

export function SettingsPage({ session }: SettingsPageProps) {
  return (
    <div className="mx-auto max-w-2xl py-8 space-y-6">
      <h1 className="text-2xl font-bold text-on-surface font-headline">Configurações</h1>

      <ProfileCard session={session} />
      <SecurityCard />
      <SessionsCard />
      <AppearanceCard />
      <DangerZoneCard />
    </div>
  );
}
