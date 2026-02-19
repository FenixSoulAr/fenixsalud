
-- Attach the existing check_share_limit_by_plan function as a BEFORE INSERT trigger
CREATE TRIGGER enforce_share_limit_before_insert
BEFORE INSERT ON public.profile_shares
FOR EACH ROW
EXECUTE FUNCTION public.check_share_limit_by_plan();
