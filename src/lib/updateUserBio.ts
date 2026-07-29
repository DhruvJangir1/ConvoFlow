import { clerkFetch } from "./clerkFetch";
import type { AppDispatch } from "../store/store";
import { updateUserBio } from "../store/userAuthSlice";

export async function updateUserBioAction(userId: string, bio: string, dispatch: AppDispatch): Promise<boolean> {
  try {
    const res = await clerkFetch(`/api/users/${userId}/update-bio`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bio }),
    });

    if (!res.ok) return false;

    const data = await res.json();
    dispatch(updateUserBio(data.bio));
    return true;
  } catch {
    return false;
  }
}
