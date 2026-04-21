"use client";

import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Upload, FileText, ExternalLink, CheckCircle, AlertTriangle, Clock } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { computeComplianceStatus } from "@/lib/utils/date";
import type { ComplianceStatus } from "@/lib/utils/date";

interface ProjectDocument {
  id: string;
  docTypeId: string;
  docType: { name: string; isMandatory: boolean };
  fileUrl?: string;
  fileName?: string;
  expiryDate?: string;
  status: ComplianceStatus;
  uploadedAt?: string;
  uploadedBy?: { name: string };
}

const STATUS_CONFIG: Record<ComplianceStatus, {
  label: string;
  variant: "success" | "warning" | "destructive" | "muted";
  icon: React.ReactNode;
}> = {
  VALID: { label: "Valid", variant: "success", icon: <CheckCircle className="h-3.5 w-3.5" /> },
  EXPIRING_SOON: { label: "Expiring Soon", variant: "warning", icon: <Clock className="h-3.5 w-3.5" /> },
  EXPIRED: { label: "Expired", variant: "destructive", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  PENDING: { label: "Pending Upload", variant: "muted", icon: <Upload className="h-3.5 w-3.5" /> },
};

export default function DocumentsPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [uploadDialog, setUploadDialog] = useState<ProjectDocument | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [expiryDate, setExpiryDate] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: documents, isLoading } = useQuery<ProjectDocument[]>({
    queryKey: ["project-documents", id],
    queryFn: async () => {
      const res = await fetch(`/api/projects/${id}/documents`);
      if (!res.ok) throw new Error("Failed");
      const docs = await res.json() as ProjectDocument[];
      // Compute status client-side for real-time accuracy
      return docs.map(doc => ({
        ...doc,
        status: doc.expiryDate
          ? computeComplianceStatus(new Date(doc.expiryDate))
          : doc.fileUrl ? "VALID" : "PENDING",
      }));
    },
  });

  const handleUpload = async () => {
    if (!file || !uploadDialog) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("subfolder", "documents");
      const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
      if (!uploadRes.ok) throw new Error("Upload failed");
      const { url, filename } = await uploadRes.json();

      const res = await fetch(`/api/projects/${id}/documents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docTypeId: uploadDialog.docTypeId,
          fileUrl: url,
          fileName: filename,
          expiryDate: expiryDate || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);

      queryClient.invalidateQueries({ queryKey: ["project-documents", id] });
      toast({ title: "Document uploaded" });
      setUploadDialog(null);
      setFile(null);
      setExpiryDate("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const mandatory = documents?.filter(d => d.docType.isMandatory) ?? [];
  const optional = documents?.filter(d => !d.docType.isMandatory) ?? [];
  const allMandatoryValid = mandatory.every(d => d.status === "VALID" || d.status === "EXPIRING_SOON");

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/projects/${id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold">Documents</h1>
          <p className="text-sm text-muted-foreground">Project compliance & supporting documents</p>
        </div>
      </div>

      {/* Compliance gate status */}
      <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${
        allMandatoryValid ? "border-green-200 bg-green-50 dark:bg-green-900/20" : "border-red-200 bg-red-50 dark:bg-red-900/20"
      }`}>
        {allMandatoryValid ? (
          <CheckCircle className="h-5 w-5 text-green-600" />
        ) : (
          <AlertTriangle className="h-5 w-5 text-red-600" />
        )}
        <p className="text-sm font-medium">
          {allMandatoryValid
            ? "Compliance gate clear — invoice can be generated"
            : "Compliance gate blocked — upload missing mandatory documents to unlock invoicing"}
        </p>
      </div>

      {/* Mandatory Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mandatory Documents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            [1, 2, 3].map(n => <Skeleton key={n} className="h-16 w-full" />)
          ) : mandatory.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No mandatory documents configured for this client</p>
          ) : (
            mandatory.map((doc) => {
              const cfg = STATUS_CONFIG[doc.status];
              return (
                <div key={doc.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
                  <div className="flex items-start gap-3">
                    <FileText className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{doc.docType.name}</p>
                      {doc.fileUrl ? (
                        <a href={doc.fileUrl} target="_blank" rel="noreferrer"
                          className="text-xs text-primary underline flex items-center gap-1">
                          {doc.fileName || "View file"}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : (
                        <p className="text-xs text-muted-foreground">Not uploaded</p>
                      )}
                      {doc.expiryDate && (
                        <p className="text-xs text-muted-foreground">
                          Expires {format(new Date(doc.expiryDate), "dd MMM yyyy")}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant={cfg.variant} className="flex items-center gap-1 text-xs">
                      {cfg.icon}
                      {cfg.label}
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7"
                      onClick={() => setUploadDialog(doc)}
                    >
                      <Upload className="h-3 w-3" />
                      {doc.fileUrl ? "Update" : "Upload"}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Optional Documents */}
      {optional.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Supporting Documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {optional.map((doc) => {
              const cfg = STATUS_CONFIG[doc.status];
              return (
                <div key={doc.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
                  <div className="flex items-start gap-3">
                    <FileText className="h-4 w-4 mt-0.5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{doc.docType.name}</p>
                      {doc.fileUrl ? (
                        <a href={doc.fileUrl} target="_blank" rel="noreferrer"
                          className="text-xs text-primary underline">
                          {doc.fileName || "View"}
                        </a>
                      ) : (
                        <p className="text-xs text-muted-foreground">Not uploaded</p>
                      )}
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="h-7" onClick={() => setUploadDialog(doc)}>
                    <Upload className="h-3 w-3" />
                    {doc.fileUrl ? "Update" : "Upload"}
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Upload Dialog */}
      <Dialog open={!!uploadDialog} onOpenChange={(o) => !o && setUploadDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Upload {uploadDialog?.docType.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>File *</Label>
              <Input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Expiry Date (if applicable)</Label>
              <Input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialog(null)}>Cancel</Button>
            <Button variant="brand" onClick={handleUpload} loading={uploading} disabled={!file}>
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
