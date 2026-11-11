import { route } from "@/server/api";
import { getPreferences, getProfile } from "@/server/services/profile";

export const GET = route(async ({ ctx }) => ({ email: ctx.email, profile: await getProfile(ctx.tx), preferences: await getPreferences(ctx.tx) }));
