import { useState, useEffect } from "react";
import { ExternalLink, Copy, Download, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";

interface PdfAttachmentActionsProps {
  fileName: string;
  getSignedUrl: () => Promise<string | null>;
  compact?: boolean;
}

export function PdfAttachmentActions({ fileName, getSignedUrl, compact = false }: PdfAttachmentActionsProps) {
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

  async function handleCopyLink() {
    if (!signedUrl) {
      // Try to get a fresh URL
      const url = await getSignedUrl();
      if (url) {
        await navigator.clipboard.writeText(url);
        toast.success("Secure link copied.");
      } else {
        toast.error("Failed to generate link. Please try again.");
      }
      return;
    }
    
    try {
      await navigator.clipboard.writeText(signedUrl);
      toast.success("Secure link copied.");
    } catch {
      toast.error("Failed to copy link.");
    }
  }

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
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

  if (error || !signedUrl) {
    return (
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleRefresh}
        >
          Retry
        </Button>
        <span className="text-sm text-muted-foreground">Failed to load</span>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-1">
        {/* Real anchor link for Open PDF */}
        <Button
          asChild
          variant="ghost"
          size="sm"
        >
          <a
            href={signedUrl}
            target="_blank"
            rel="noreferrer"
            download={fileName}
          >
            <Download className="h-4 w-4 mr-1" />
            Download
          </a>
        </Button>
        
        {/* Real anchor link for Open in new tab */}
        <Button
          asChild
          variant="ghost"
          size="icon"
          title="Open in new tab"
        >
          <a
            href={signedUrl}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </Button>
        
        {/* Copy secure link */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleCopyLink}
          title="Copy secure link"
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Real anchor link with download attribute */}
        <Button
          asChild
          variant="default"
          size="sm"
        >
          <a
            href={signedUrl}
            target="_blank"
            rel="noreferrer"
            download={fileName}
          >
            <Download className="h-4 w-4 mr-1" />
            Download PDF
          </a>
        </Button>
        
        {/* Real anchor link for Open in new tab */}
        <Button
          asChild
          variant="outline"
          size="sm"
        >
          <a
            href={signedUrl}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            Open PDF
          </a>
        </Button>
        
        {/* Copy secure link */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleCopyLink}
        >
          <Copy className="h-4 w-4 mr-1" />
          Copy link
        </Button>
      </div>
      
      <Alert variant="default" className="bg-muted/50 border-muted">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription className="text-xs">
          If your browser blocks PDF access, use "Copy link" and paste it in a new tab, or temporarily disable ad blockers.
        </AlertDescription>
      </Alert>
    </div>
  );
}
