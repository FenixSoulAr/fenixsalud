-- Update handle_new_user to set owner_user_id (required NOT NULL column)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, owner_user_id, full_name)
  VALUES (NEW.id, NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$function$;