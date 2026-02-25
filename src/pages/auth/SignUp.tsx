import { Navigate } from "react-router-dom";

// Sign up is now handled in the unified SignIn page via tabs
export default function SignUp() {
  return <Navigate to="/auth/sign-in?tab=sign-up" replace />;
}
