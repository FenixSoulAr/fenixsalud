import { useAndroidBackButton } from "@/hooks/useAndroidBackButton";
import { isAndroidNative } from "@/utils/platform";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Exit-confirmation dialog for Android back button at root screen.
 * Mount inside <BrowserRouter>.
 */
export function AndroidBackHandler() {
  const { showExitDialog, confirmExit, cancelExit } = useAndroidBackButton();

  if (!isAndroidNative) return null;

  return (
    <AlertDialog open={showExitDialog} onOpenChange={(open) => { if (!open) cancelExit(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Salir de My Health Hub?</AlertDialogTitle>
          <AlertDialogDescription>
            Vas a salir de la aplicación. ¿Querés continuar?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={cancelExit}>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={confirmExit}>Salir</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
