// src/auth/supabaseClient.js
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Insert a new user into the Users table.
 * (If your schema uses `user_id` instead of `id`, change accordingly.)
 */
export async function handleSignUp(id, name, age, email, occupation, financial_goals) {
  const { data, error } = await supabase
    .from("Users")
    .insert({
      id,
      name,
      age,
      email,
      occupation,
      financial_goals,
    });

  if (error) {
    console.error("Error signing up:", error.message);
    throw error;
  } else {
    console.log("Sign-up successful", data);
    return data;
  }
}
