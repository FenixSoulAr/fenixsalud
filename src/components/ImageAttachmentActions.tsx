import { useState, useEffect } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImageAttachmentActionsProps {
  getSignedUrl: () => Promise<string | null>;
  compact?: boolean;
}

export function ImageAttachmentActions({ getSignedUrl, compact = false }: ImageAttachmentActionsProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  // Generate signed URL on mount
  useEffect(() => {
    let mounted = true;
    
    async function fetchUrl() {
      setLoading(true);
      setError(false);
      const url = await getSignedUrl();
      if (mounted) {
        setSignedUrl(url);
        setLoading(false);
        if (!url) setError(true);
      }
    }
    
    fetchUrl();
    
    return () => { mounted = false; };
  }, [getSignedUrl]);

  async function handleRefresh() {
    setLoading(true);
    setError(false);
    const url = await getSignedUrl();
    setSignedUrl(url);
    setLoading(false);
    if (!url) setError(true);
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        {!compact && <span className="text-sm text-muted-foreground">Loading...</span>}
      </div>
    );
  }

  if (error || !signedUrl) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleRefresh}
      >
        Retry
      </Button>
    );
  }

  return (
    <Button
      asChild
      variant="ghost"
      size="sm"
    >
      <a
        href={signedUrl}
        target="_blank"
        rel="noreferrer"
      >
        <ExternalLink className="h-4 w-4 mr-1" />
        {!compact && "Open"}
      </a>
    </Button>
  );
}
