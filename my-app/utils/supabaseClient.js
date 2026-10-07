import { createClient } from '@supabase/supabase-js';

// Replace with your actual Supabase URL and anon key
const SUPABASE_URL =  process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export async function handleSignUp(auth_user_id, name, age, email, occupation, financial_goals) {
  const { data, error } = await supabase
    .from('Users')
    .insert({
      auth_user_id,  // Store the Supabase Auth UUID as a reference
      name,
      age,
      email,
      occupation,
      financial_goals
    })
    .select(); // Get back the inserted record with auto-generated ID
  
  if (error) {
    console.error('Error saving user data:', error.message);
    throw error;
  }


  
  console.log('User data saved successfully', data);
  return data[0]; // Return the inserted record
}
