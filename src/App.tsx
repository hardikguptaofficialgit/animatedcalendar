import { AppProviders } from "@/components/providers/app-providers";
import { WallCalendarApp } from "@/components/calendar/wall-calendar-app";

export default function App() {
  return (
    <AppProviders>
      <WallCalendarApp />
    </AppProviders>
  );
}
